'use client';

import { useState, useEffect, useRef } from 'react';
import { useLang } from '@/context/LanguageContext';
import api from '@/lib/api';
import { 
  HiOutlineChatBubbleLeftRight, 
  HiXMark, 
  HiPaperAirplane,
  HiOutlineSparkles,
  HiOutlineUser
} from 'react-icons/hi2';
import { HiOutlineSupport } from 'react-icons/hi';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function Chatbot() {
  const { lang } = useLang();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
    <div className="fixed bottom-0 left-0 p-6 pointer-events-none z-50">
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 hover:bg-blue-700 transition-all pointer-events-auto group relative"
      >
        {isOpen ? (
          <HiXMark className="w-7 h-7" />
        ) : (
          <>
            <HiOutlineChatBubbleLeftRight className="w-7 h-7" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 border-white rounded-full animate-pulse" />
          </>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="absolute bottom-24 left-6 w-[90vw] sm:w-[380px] h-[500px] bg-white rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-gray-100 flex flex-col overflow-hidden pointer-events-auto animate-in slide-in-from-bottom-10 duration-300">
          
          {/* Header */}
          <div className="bg-[#0b1a2e] p-5 text-white flex items-center gap-3">
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
              <HiXMark className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gray-50/50 custom-scrollbar">
            {messages.map((m, i) => (
              <div 
                key={i} 
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-2 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    m.role === 'user' ? 'bg-primary-100 text-primary-600' : 'bg-white border border-gray-100 text-gray-400'
                  }`}>
                    {m.role === 'user' ? <HiOutlineUser className="w-4 h-4" /> : <HiOutlineSparkles className="w-4 h-4" />}
                  </div>
                  <div className={`p-3 rounded-2xl text-xs sm:text-sm shadow-sm ${
                    m.role === 'user' 
                      ? 'bg-primary-600 text-white rounded-tr-none' 
                      : 'bg-white text-gray-700 border border-gray-100 rounded-tl-none'
                  }`}>
                    {m.content}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-100 p-3 rounded-2xl rounded-tl-none shadow-sm flex gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="p-4 bg-white border-t border-gray-100">
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={lang === 'es' ? 'Escribe tu pregunta...' : 'Type your question...'}
                className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
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
