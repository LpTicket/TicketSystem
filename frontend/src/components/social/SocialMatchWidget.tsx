'use client';

import { useState, useEffect, useRef } from 'react';
import {
  HiOutlineMail,
  HiOutlineMailOpen,
  HiOutlineX,
  HiOutlinePaperAirplane,
  HiOutlineChevronLeft,
  HiOutlineBriefcase,
} from 'react-icons/hi';
import { useLang } from '@/context/LanguageContext';
import { useAuthStore } from '@/stores/auth';
import { useSocialMatchWidgetStore } from '@/stores/socialMatchWidget';
import {
  getMySocialMatch,
  getSocialMatchMessages,
  sendSocialMatchMessage,
  updateSocialMatchConnection,
  SocialMatchConnection,
  SocialMatchMessage,
  socialMatchInterestOptions,
} from '@/lib/socialMatch';
import { FaInstagram } from 'react-icons/fa';

const LAST_READ_KEY = 'sm_last_read';
const FLOATING_PANEL_EVENT = 'lpticket-floating-panel-open';
const SOCIAL_MATCH_PANEL = 'social-match';

function getLastRead(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LAST_READ_KEY) || '{}'); } catch { return {}; }
}

function markAsRead(connId: string) {
  const data = getLastRead();
  data[connId] = new Date().toISOString();
  localStorage.setItem(LAST_READ_KEY, JSON.stringify(data));
}

export default function SocialMatchWidget() {
  const { lang } = useLang();
  const { isAuthenticated } = useAuthStore();
  const { isOpen, setOpen, setUnreadCount } = useSocialMatchWidgetStore();
  const [connections, setConnections] = useState<SocialMatchConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeChatConn, setActiveChatConn] = useState<SocialMatchConnection | null>(null);
  const [messages, setMessages] = useState<SocialMatchMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [viewingProfile, setViewingProfile] = useState(false);
  const [profilePhotoIdx, setProfilePhotoIdx] = useState(0);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socialShellRef = useRef<HTMLDivElement>(null);
  const activeChatConnRef = useRef<SocialMatchConnection | null>(null);

  const accepted = connections.filter((c) => c.status === 'accepted');

  const notifyFloatingPanelOpen = (panel: string) => {
    window.dispatchEvent(new CustomEvent(FLOATING_PANEL_EVENT, { detail: panel }));
  };
  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);
  useEffect(() => { setUnreadCount(totalUnread); }, [totalUnread]);

  useEffect(() => { activeChatConnRef.current = activeChatConn; }, [activeChatConn]);

  useEffect(() => {
    const handleOtherFloatingPanel = (event: Event) => {
      const panel = (event as CustomEvent<string>).detail;
      if (panel !== SOCIAL_MATCH_PANEL) handleClose();
    };
    window.addEventListener(FLOATING_PANEL_EVENT, handleOtherFloatingPanel);
    return () => window.removeEventListener(FLOATING_PANEL_EVENT, handleOtherFloatingPanel);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (socialShellRef.current && !socialShellRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  useEffect(() => {
    if (isAuthenticated) loadConnections();
  }, [isAuthenticated]);

  useEffect(() => {
    if (isOpen && isAuthenticated) loadConnections();
  }, [isOpen]);

  // Poll active chat messages
  useEffect(() => {
    if (!activeChatConn) return;
    const interval = setInterval(async () => {
      try {
        const data = await getSocialMatchMessages(activeChatConn.id);
        setMessages(data.messages || []);
        // Mark as read while chat is open
        markAsRead(activeChatConn.id);
        setUnreadCounts((prev) => ({ ...prev, [activeChatConn.id]: 0 }));
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [activeChatConn]);

  // Background poll for unread messages across all accepted connections
  useEffect(() => {
    if (!isAuthenticated || accepted.length === 0) return;

    const checkAll = async () => {
      const lastRead = getLastRead();
      for (const conn of accepted) {
        if (activeChatConnRef.current?.id === conn.id) continue;
        try {
          const data = await getSocialMatchMessages(conn.id);
          const msgs: SocialMatchMessage[] = data.messages || [];
          const lastReadAt = lastRead[conn.id];
          const unread = msgs.filter(
            (m) => !m.isMine && (!lastReadAt || m.createdAt > lastReadAt)
          ).length;
          setUnreadCounts((prev) => ({ ...prev, [conn.id]: unread }));
        } catch {}
      }
    };

    checkAll();
    const interval = setInterval(checkAll, 30000);
    return () => clearInterval(interval);
  }, [accepted.length, isAuthenticated]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isAuthenticated) return null;

  const loadConnections = async () => {
    try {
      setLoading(true);
      const data = await getMySocialMatch();
      setConnections(data.connections || []);
    } catch {}
    finally { setLoading(false); }
  };

  const openChat = async (conn: SocialMatchConnection) => {
    markAsRead(conn.id);
    setUnreadCounts((prev) => ({ ...prev, [conn.id]: 0 }));
    setActiveChatConn(conn);
    setViewingProfile(false);
    setProfilePhotoIdx(0);
    setMessages([]);
    try {
      const data = await getSocialMatchMessages(conn.id);
      setMessages(data.messages || []);
    } catch {}
  };

  const handleUnmatch = async () => {
    if (!activeChatConn) return;
    try {
      await updateSocialMatchConnection(activeChatConn.id, 'cancelled');
      await loadConnections();
      setActiveChatConn(null);
      setViewingProfile(false);
      setMessages([]);
    } catch {}
  };

  const handleSend = async () => {
    if (!activeChatConn || !draft.trim() || sending) return;
    try {
      setSending(true);
      const saved = await sendSocialMatchMessage(activeChatConn.id, draft.trim());
      setMessages((prev) => [...prev, saved]);
      setDraft('');
    } catch {}
    finally { setSending(false); }
  };

  const handleClose = () => {
    setOpen(false);
    setActiveChatConn(null);
    setViewingProfile(false);
    setMessages([]);
    setDraft('');
  };

  return (
    <div ref={socialShellRef} className="fixed bottom-20 right-0 px-5 z-[300] flex flex-col items-end gap-3 pointer-events-none print:hidden">
      {/* Popup panel */}
      {isOpen && (
        <div className="w-80 bg-white rounded-3xl shadow-elevated border border-gray-100 overflow-hidden flex flex-col pointer-events-auto animate-fade-in-up">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3.5 bg-[#0A375A] shrink-0">
            {activeChatConn && (
              <button
                onClick={() => viewingProfile ? setViewingProfile(false) : (setActiveChatConn(null), setMessages([]), setDraft(''))}
                className="text-white/60 hover:text-white mr-1 transition-colors"
              >
                <HiOutlineChevronLeft className="w-4 h-4" />
              </button>
            )}
            <HiOutlineMail className="w-4 h-4 text-orange-400 shrink-0" />
            {activeChatConn ? (
              <button
                onClick={() => setViewingProfile((v) => !v)}
                className="flex-1 text-sm font-bold text-white truncate text-left hover:text-orange-300 transition-colors"
              >
                {activeChatConn.otherUserName}
              </button>
            ) : (
              <span className="flex-1 text-sm font-bold text-white truncate">
                {lang === 'es' ? 'Mis Matches' : 'My Matches'}
              </span>
            )}
            {activeChatConn && (
              <span className="text-[10px] text-white/50 truncate max-w-[80px]">{activeChatConn.eventTitle}</span>
            )}
            <button onClick={handleClose} className="text-white/60 hover:text-white ml-2 shrink-0 transition-colors">
              <HiOutlineX className="w-4 h-4" />
            </button>
          </div>

          {/* Connections list */}
          {!activeChatConn && (
            <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
              {loading ? (
                <div className="flex flex-col gap-2 p-4">
                  {[1, 2].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
                </div>
              ) : accepted.length === 0 ? (
                <div className="py-10 px-6 text-center">
                  <HiOutlineMailOpen className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400 font-medium">
                    {lang === 'es' ? 'Aún no tienes matches' : 'No matches yet'}
                  </p>
                  <p className="text-xs text-gray-300 mt-1">
                    {lang === 'es' ? 'Activa Social Match para conectar' : 'Activate Social Match to connect'}
                  </p>
                </div>
              ) : (
                accepted.map((conn) => {
                  const unread = unreadCounts[conn.id] || 0;
                  return (
                    <button
                      key={conn.id}
                      onClick={() => openChat(conn)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-orange-50 transition-colors text-left group"
                    >
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0A375A] to-[#F97316] flex items-center justify-center text-white font-black text-sm shrink-0">
                        {conn.otherUserName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm truncate ${unread > 0 ? 'font-black text-gray-900' : 'font-bold text-gray-900'}`}>
                          {conn.otherUserName}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{conn.eventTitle}</p>
                      </div>
                      {unread > 0 ? (
                        <span className="min-w-[20px] h-5 px-1 bg-orange-500 text-white rounded-full text-[10px] font-black flex items-center justify-center shrink-0">
                          {unread > 9 ? '9+' : unread}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-[#F97316] opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          Chat →
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* Profile view */}
          {activeChatConn && viewingProfile && (() => {
            const photos = activeChatConn.profile?.photos || [];
            const idx = Math.min(profilePhotoIdx, Math.max(0, photos.length - 1));
            return (
              <div className="overflow-y-auto max-h-[420px]">
                {photos.length > 0 ? (
                  <div className="relative h-52 bg-[#0A375A]">
                    <img src={photos[idx]} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    {photos.length > 1 && (
                      <>
                        <button type="button" onClick={() => setProfilePhotoIdx((p) => Math.max(0, p - 1))} className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/30 text-white flex items-center justify-center text-lg font-bold">{idx > 0 ? '‹' : ''}</button>
                        <button type="button" onClick={() => setProfilePhotoIdx((p) => Math.min(photos.length - 1, p + 1))} className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/30 text-white flex items-center justify-center text-lg font-bold">{idx < photos.length - 1 ? '›' : ''}</button>
                        <div className="absolute top-2 left-2 right-2 flex gap-1">
                          {photos.map((_, i) => <div key={i} className={`flex-1 h-0.5 rounded-full ${i <= idx ? 'bg-white' : 'bg-white/30'}`} />)}
                        </div>
                      </>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 px-3 pb-2 text-white">
                      <p className="font-black text-sm">{activeChatConn.otherUserName}</p>
                      {activeChatConn.profile?.industry && (
                        <div className="flex items-center gap-1 text-white/80">
                          <HiOutlineBriefcase className="w-3 h-3" />
                          <span className="text-xs">{activeChatConn.profile.industry}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-4 bg-gradient-to-r from-[#0A375A] to-[#134E7A]">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white font-black text-lg shrink-0">
                      {activeChatConn.otherUserName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-black text-sm text-white">{activeChatConn.otherUserName}</p>
                      {activeChatConn.profile?.industry && <p className="text-xs text-white/70">{activeChatConn.profile.industry}</p>}
                    </div>
                  </div>
                )}

                <div className="p-4 space-y-3">
                  {(activeChatConn.profile?.interests || []).length > 0 && (
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{lang === 'es' ? 'Intereses' : 'Interests'}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(activeChatConn.profile?.interests || []).map((id) => {
                          const opt = socialMatchInterestOptions.find((o) => o.id === id);
                          return (
                            <span key={id} className="px-2.5 py-1 rounded-lg bg-orange-50 text-[#F97316] text-xs font-bold border border-orange-200">
                              {opt ? (lang === 'es' ? opt.es : opt.en) : id}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {activeChatConn.profile?.instagram && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-orange-50 to-pink-50 border border-orange-200">
                      <FaInstagram className="w-4 h-4 text-[#E1306C] shrink-0" />
                      <span className="text-sm font-black text-gray-800">@{activeChatConn.profile.instagram.replace(/^@/, '')}</span>
                    </div>
                  )}

                  <button
                    onClick={handleUnmatch}
                    className="w-full py-2 rounded-xl border border-red-200 text-red-500 text-xs font-bold hover:bg-red-50 transition-colors"
                  >
                    {lang === 'es' ? 'Cancelar match' : 'Unmatch'}
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Chat view */}
          {activeChatConn && !viewingProfile && (
            <>
              <div className="h-60 overflow-y-auto p-3 space-y-2 bg-gray-50/50">
                {messages.length === 0 ? (
                  <p className="text-center text-xs text-gray-400 pt-10">
                    {lang === 'es' ? 'Di hola 👋' : 'Say hi 👋'}
                  </p>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-snug ${
                        msg.isMine
                          ? 'bg-[#0A375A] text-white rounded-br-sm'
                          : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm'
                      }`}>
                        {msg.message}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className="flex items-center gap-2 p-3 border-t border-gray-100 bg-white shrink-0">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder={lang === 'es' ? 'Escribe un mensaje...' : 'Write a message...'}
                  className="flex-1 text-sm px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 outline-none focus:border-orange-300 transition-colors"
                />
                <button
                  onClick={handleSend}
                  disabled={!draft.trim() || sending}
                  className="w-8 h-8 rounded-full bg-[#F97316] text-white flex items-center justify-center hover:bg-orange-600 disabled:opacity-40 transition-colors shrink-0"
                >
                  <HiOutlinePaperAirplane className="w-4 h-4 -rotate-45" />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Floating trigger button */}
      <button
        onClick={() => {
          if (!isOpen) notifyFloatingPanelOpen(SOCIAL_MATCH_PANEL);
          setOpen(!isOpen);
        }}
        className="w-14 h-14 floating-action-pill rounded-full flex items-center justify-center transition-all duration-300 relative group active:scale-90 pointer-events-auto shrink-0"
        title={lang === 'es' ? 'Mis Matches' : 'My Matches'}
      >
        {isOpen ? <HiOutlineX className="w-6 h-6" /> : <HiOutlineMail className="w-7 h-7" />}
        {!isOpen && totalUnread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 bg-orange-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-white shadow-lg w-14 h-14">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>
    </div>
  );
}
