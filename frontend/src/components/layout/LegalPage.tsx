'use client';

import { useLang } from '@/context/LanguageContext';

interface LegalPageProps {
  title: string;
  lastUpdated: string;
  content: string;
}

export default function LegalPage({ title, lastUpdated, content }: LegalPageProps) {
  const { lang } = useLang();

  // Simple parser for the text format (lines to paragraphs/sections)
  const renderContent = () => {
    const lines = content.split('\n');
    return lines.map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={i} className="h-4" />;
      
      // Header detection (e.g., "1. Introduction")
      if (/^\d+\.\s/.test(trimmed)) {
        return (
          <h2 key={i} className="text-xl font-bold text-gray-900 mt-8 mb-4 border-b border-gray-100 pb-2">
            {trimmed}
          </h2>
        );
      }
      
      // List detection (e.g., "* Name and last name")
      if (trimmed.startsWith('* ')) {
        return (
          <li key={i} className="ml-6 text-gray-600 mb-1 list-disc">
            {trimmed.substring(2)}
          </li>
        );
      }

      // Title/Company detection (first lines)
      if (i < 5 && trimmed.toUpperCase() === trimmed && trimmed.length > 3) {
        return null; // Skip redundant title
      }

      return (
        <p key={i} className="text-gray-600 leading-relaxed mb-4">
          {trimmed}
        </p>
      );
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="bg-primary-600 px-8 py-8 text-white text-center">
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight mb-2">
              {title}
            </h1>
            <p className="text-primary-100 text-[10px] font-bold uppercase tracking-widest">
              {lang === 'es' ? 'Última actualización' : 'Last Updated'}: {lastUpdated}
            </p>
          </div>

          {/* Content with Scrollbar */}
          <div className="px-8 py-10 sm:px-12 prose prose-blue max-w-none max-h-[600px] overflow-y-auto custom-scrollbar">
            {renderContent()}
          </div>

          {/* Footer Note */}
          <div className="bg-gray-50 px-8 py-6 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">
              © {new Date().getFullYear()} LPTicket LLC. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
