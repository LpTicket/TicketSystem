'use client';

import { useState, useEffect, useRef } from 'react';
import {
  HiOutlineMail,
  HiOutlineMailOpen,
  HiOutlineX,
  HiOutlinePaperAirplane,
  HiOutlineChevronLeft,
} from 'react-icons/hi';
import { useLang } from '@/context/LanguageContext';
import { useAuthStore } from '@/stores/auth';
import {
  getMySocialMatch,
  getSocialMatchMessages,
  sendSocialMatchMessage,
  SocialMatchConnection,
  SocialMatchMessage,
} from '@/lib/socialMatch';

export default function SocialMatchWidget() {
  const { lang } = useLang();
  const { isAuthenticated } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [connections, setConnections] = useState<SocialMatchConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeChatConn, setActiveChatConn] = useState<SocialMatchConnection | null>(null);
  const [messages, setMessages] = useState<SocialMatchMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const accepted = connections.filter((c) => c.status === 'accepted');

  useEffect(() => {
    if (isAuthenticated) loadConnections();
  }, [isAuthenticated]);

  useEffect(() => {
    if (isOpen && isAuthenticated) loadConnections();
  }, [isOpen]);

  useEffect(() => {
    if (!activeChatConn) return;
    const interval = setInterval(async () => {
      try {
        const data = await getSocialMatchMessages(activeChatConn.id);
        setMessages(data.messages || []);
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [activeChatConn]);

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
    setActiveChatConn(conn);
    setMessages([]);
    try {
      const data = await getSocialMatchMessages(conn.id);
      setMessages(data.messages || []);
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
    setIsOpen(false);
    setActiveChatConn(null);
    setMessages([]);
    setDraft('');
  };

  return (
    <div className="fixed bottom-6 right-24 z-[99] flex flex-col items-end gap-3 pointer-events-none print:hidden">
      {/* Popup panel */}
      {isOpen && (
        <div className="w-80 bg-white rounded-3xl shadow-elevated border border-gray-100 overflow-hidden flex flex-col pointer-events-auto animate-fade-in-up">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3.5 bg-[#0A375A] shrink-0">
            {activeChatConn && (
              <button
                onClick={() => { setActiveChatConn(null); setMessages([]); setDraft(''); }}
                className="text-white/60 hover:text-white mr-1 transition-colors"
              >
                <HiOutlineChevronLeft className="w-4 h-4" />
              </button>
            )}
            <HiOutlineMail className="w-4 h-4 text-orange-400 shrink-0" />
            <span className="flex-1 text-sm font-bold text-white truncate">
              {activeChatConn
                ? activeChatConn.otherUserName
                : (lang === 'es' ? 'Mis Matches' : 'My Matches')}
            </span>
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
                accepted.map((conn) => (
                  <button
                    key={conn.id}
                    onClick={() => openChat(conn)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-orange-50 transition-colors text-left group"
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0A375A] to-[#F97316] flex items-center justify-center text-white font-black text-sm shrink-0">
                      {conn.otherUserName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-gray-900 truncate">{conn.otherUserName}</p>
                      <p className="text-xs text-gray-400 truncate">{conn.eventTitle}</p>
                    </div>
                    <span className="text-[10px] font-bold text-[#F97316] opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      Chat →
                    </span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Chat view */}
          {activeChatConn && (
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

      {/* Floating trigger button — same style as cart / chatbot */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-14 h-14 floating-action-pill rounded-full flex items-center justify-center transition-all duration-300 relative group active:scale-90 pointer-events-auto"
        title={lang === 'es' ? 'Mis Matches' : 'My Matches'}
      >
        {isOpen
          ? <HiOutlineX className="w-6 h-6" />
          : <HiOutlineMail className="w-7 h-7" />
        }
        {!isOpen && accepted.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 bg-green-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-white shadow-lg">
            {accepted.length > 9 ? '9+' : accepted.length}
          </span>
        )}
      </button>
    </div>
  );
}
