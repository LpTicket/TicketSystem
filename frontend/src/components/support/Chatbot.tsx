'use client';

import { useState, useEffect, useRef } from 'react';
import { useLang } from '@/context/LanguageContext';
import api from '@/lib/api';
import {
  HiOutlineChatAlt2,
  HiX,
  HiPaperAirplane,
  HiOutlineSparkles,
  HiOutlineUser,
  HiOutlineSupport,
} from 'react-icons/hi';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const FLOATING_PANEL_EVENT = 'lpticket-floating-panel-open';
const SUPPORT_CHAT_PANEL = 'support-chat';

export default function Chatbot() {
  const { lang } = useLang();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatShellRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const notifyFloatingPanelOpen = (panel: string) => {
    window.dispatchEvent(new CustomEvent(FLOATING_PANEL_EVENT, { detail: panel }));
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const handleOtherFloatingPanel = (event: Event) => {
      const panel = (event as CustomEvent<string>).detail;
      if (panel !== SUPPORT_CHAT_PANEL) setIsOpen(false);
    };
    window.addEventListener(FLOATING_PANEL_EVENT, handleOtherFloatingPanel);
    return () => window.removeEventListener(FLOATING_PANEL_EVENT, handleOtherFloatingPanel);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (chatShellRef.current && !chatShellRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // Initial greeting
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        { 
          role: 'assistant', 
          content: lang === 'es' 
            ? '¡Hola! Soy el asistente virtual de LPTicket. ¿En qué puedo ayudarte hoy?' 
            : 'Hi! I am the LPTicket virtual assistant. How can I help you today?' 
        }
      ]);
    }
  }, [lang, messages.length]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const { data } = await api.post('/ai-support/chat', { 
        messages: newMessages.map(m => ({ role: m.role, content: m.content })) 
      });
      
      setMessages([...newMessages, { role: 'assistant', content: data.content }]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages([...newMessages, { 
        role: 'assistant', 
        content: lang === 'es' 
          ? 'Lo siento, tuve un problema al procesar tu mensaje. ¿Podrías intentar de nuevo?' 
          : 'Sorry, I had trouble processing your message. Could you try again?' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div ref={chatShellRef} className="fixed bottom-4 left-0 px-4 sm:px-6 pointer-events-none z-50 print:hidden">
      {/* Floating Button */}
      <button
        onClick={() => {
          if (!isOpen) notifyFloatingPanelOpen(SUPPORT_CHAT_PANEL);
          setIsOpen(!isOpen);
        }}
        className="w-12 h-12 sm:w-14 sm:h-14 floating-action-pill rounded-full flex items-center justify-center transition-all pointer-events-auto group relative active:scale-90"
      >
        {isOpen ? (
          <HiX className="w-7 h-7" />
        ) : (
          <>
            <HiOutlineChatAlt2 className="w-7 h-7" />
            <span className="absolute -top-1 -right-1 w-4 h-4 floating-action-status border-2 border-white rounded-full animate-pulse" />
          </>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="absolute bottom-24 left-0 w-[min(380px,calc(100vw-2rem))] h-[500px] max-h-[calc(100dvh-11rem)] bg-[#0b2236] rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.45)] border border-[rgba(246,198,95,0.14)] flex flex-col overflow-hidden pointer-events-auto animate-in slide-in-from-bottom-10 duration-300">
          
          {/* Header */}
          <div className="bg-orange-500 p-5 text-white flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
              <HiOutlineSupport className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm">LPTicket AI Support</h3>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-[10px] font-medium opacity-80 uppercase tracking-widest">Online</span>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="ml-auto p-1 hover:bg-white/10 rounded-lg transition-colors"
            >
              <HiX className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#071827] custom-scrollbar">
            {messages.map((m, i) => (
              <div 
                key={i} 
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-2 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    m.role === 'user' ? 'bg-primary-500/20 text-primary-400' : 'bg-[rgba(255,255,255,0.06)] border border-[rgba(246,198,95,0.14)] text-primary-400'
                  }`}>
                    {m.role === 'user' ? <HiOutlineUser className="w-4 h-4" /> : <HiOutlineSparkles className="w-4 h-4" />}
                  </div>
                  <div className={`p-3 rounded-2xl text-xs sm:text-sm shadow-sm ${
                    m.role === 'user'
                      ? 'bg-primary-600 text-white rounded-tr-none whitespace-pre-wrap'
                      : 'bg-[rgba(255,255,255,0.05)] text-slate-200 border border-[rgba(246,198,95,0.12)] rounded-tl-none'
                  }`}>
                    {m.role === 'assistant' ? (
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed break-words">{children}</p>,
                          strong: ({ children }) => <strong className="font-extrabold text-white">{children}</strong>,
                          ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                          a: ({ href, children }) => (
                            <a 
                              href={href} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-blue-600 hover:text-blue-800 hover:underline font-semibold break-all"
                            >
                              {children}
                            </a>
                          ),
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                    ) : (
                      m.content
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-[rgba(255,255,255,0.05)] border border-[rgba(246,198,95,0.12)] p-3 rounded-2xl rounded-tl-none shadow-sm flex gap-1">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="p-4 bg-[#0b2236] border-t border-[rgba(246,198,95,0.12)]">
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={lang === 'es' ? 'Escribe tu pregunta...' : 'Type your question...'}
                className="w-full pl-4 pr-12 py-3 bg-[rgba(8,31,51,0.7)] border border-[rgba(117,132,153,0.28)] text-slate-100 placeholder-slate-500 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-orange-500 text-white rounded-xl flex items-center justify-center hover:bg-orange-600 disabled:opacity-50 disabled:grayscale transition-all"
              >
                <HiPaperAirplane className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[9px] text-center text-gray-400 mt-3 uppercase tracking-widest font-medium">
              Powered by LPTicket AI Agent
            </p>
          </form>
        </div>
      )}
    </div>
  );
}
