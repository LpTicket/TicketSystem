'use client';

import { useState } from 'react';
import { HiOutlineCheck, HiOutlineShare } from 'react-icons/hi';

interface ShareEventButtonProps {
  eventTitle: string;
  eventPath: string;
  label?: string;
  compact?: boolean;
  className?: string;
}

export default function ShareEventButton({
  eventTitle,
  eventPath,
  label = 'Comparte con tus amigos',
  compact = false,
  className = '',
}: ShareEventButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = eventPath.startsWith('http') ? eventPath : `${origin}${eventPath}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: eventTitle,
          text: `${label}: ${eventTitle}`,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className={`inline-flex items-center justify-center gap-2 border border-blue-900/10 bg-white/92 text-blue-900 shadow-[0_12px_28px_rgba(10,55,90,0.12)] backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-primary-500/30 hover:text-primary-600 ${compact ? 'h-10 w-10 rounded-lg' : 'h-11 rounded-lg px-4'} ${className}`}
      aria-label={copied ? 'Link copiado' : label}
    >
      {copied ? <HiOutlineCheck className="h-5 w-5" /> : <HiOutlineShare className="h-5 w-5" />}
      {!compact && (
        <span className="text-xs font-black uppercase tracking-[0.1em]">
          {copied ? 'Link copiado' : label}
        </span>
      )}
    </button>
  );
}
