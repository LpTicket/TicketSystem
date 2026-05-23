'use client';

import { useState, useCallback } from 'react';
import {
  HiOutlineX,
  HiOutlineCheck,
  HiOutlineSparkles,
  HiOutlineBriefcase,
  HiOutlineLocationMarker,
} from 'react-icons/hi';
import { SocialMatchSuggestion, socialMatchInterestOptions } from '@/lib/socialMatch';
import { getImageUrl } from '@/lib/api';

type Props = {
  suggestions: SocialMatchSuggestion[];
  lang: 'es' | 'en';
  onConnect: (userId: string) => Promise<void>;
  onSkip?: (userId: string) => void;
};

export default function SocialMatchSwiper({ suggestions, lang, onConnect, onSkip }: Props) {
  const [deck, setDeck] = useState<SocialMatchSuggestion[]>(suggestions);
  const [animating, setAnimating] = useState<'left' | 'right' | null>(null);
  const [processing, setProcessing] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  const currentCard = deck[0] || null;
  const nextCard = deck[1] || null;

  const interestLabel = useCallback(
    (id: string) => {
      const option = socialMatchInterestOptions.find((o) => o.id === id);
      return option ? (lang === 'es' ? option.es : option.en) : id;
    },
    [lang],
  );

  const handleAction = async (action: 'connect' | 'skip') => {
    if (!currentCard || processing || animating) return;

    setAnimating(action === 'connect' ? 'right' : 'left');
    setProcessing(true);

    try {
      if (action === 'connect') {
        await onConnect(currentCard.userId);
      } else {
        onSkip?.(currentCard.userId);
      }
    } catch {
      // handled by parent
    }

    // Wait for animation
    setTimeout(() => {
      setDeck((prev) => prev.slice(1));
      setAnimating(null);
      setProcessing(false);
    }, 350);
  };

  // Compatibility percentage based on score (max ~10)
  const getCompatibility = (score: number) => Math.min(99, Math.round((score / 6) * 100));

  if (!currentCard) {
    return (
      <div className="text-center py-16 px-6">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center">
          <HiOutlineSparkles className="w-9 h-9 text-[#F97316]" />
        </div>
        <h3 className="font-bold text-xl text-gray-900 mb-2">
          {lang === 'es' ? '¡No hay más perfiles!' : 'No more profiles!'}
        </h3>
        <p className="text-sm text-gray-500 max-w-xs mx-auto">
          {lang === 'es'
            ? 'Ya revisaste todos los perfiles compatibles para este evento. Vuelve más tarde, nuevos asistentes podrían unirse.'
            : 'You\'ve reviewed all compatible profiles for this event. Come back later, new attendees might join.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      {/* Card stack */}
      <div className="relative w-full max-w-sm mx-auto" style={{ height: 600 }}>
        {/* Next card (behind) */}
        {nextCard && (
          <div className="absolute inset-0 rounded-3xl bg-white border border-gray-100 shadow-md" style={{ transform: 'scale(0.95) translateY(12px)', opacity: 0.6 }} />
        )}

        {/* Current card */}
        <div
          className="absolute inset-0 rounded-3xl bg-white border border-gray-100 shadow-[0_20px_60px_rgba(0,0,0,0.08)] flex flex-col overflow-hidden transition-transform duration-300 ease-out"
          style={{
            transform: animating === 'left'
              ? 'translateX(-120%) rotate(-15deg)'
              : animating === 'right'
              ? 'translateX(120%) rotate(15deg)'
              : 'translateX(0) rotate(0deg)',
            opacity: animating ? 0.5 : 1,
          }}
        >
          {/* Top section — photo carousel or avatar */}
          {(() => {
            const allPhotos = [
              ...(currentCard.avatarUrl ? [getImageUrl(currentCard.avatarUrl)] : []),
              ...(currentCard.photos || []),
            ];
            const clampedIndex = Math.min(photoIndex, allPhotos.length - 1);
            if (allPhotos.length > 0) {
              return (
                <div className="relative h-80 bg-[#0A375A] overflow-hidden">
                  <img src={allPhotos[clampedIndex]} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  {allPhotos.length > 1 && (
                    <>
                      <button type="button" onClick={() => setPhotoIndex((p) => Math.max(0, p - 1))} className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/30 text-white flex items-center justify-center text-lg font-bold">‹</button>
                      <button type="button" onClick={() => setPhotoIndex((p) => Math.min(allPhotos.length - 1, p + 1))} className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/30 text-white flex items-center justify-center text-lg font-bold">›</button>
                      <div className="absolute bottom-14 left-0 right-0 flex justify-center gap-1">
                        {allPhotos.map((_, i) => <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === clampedIndex ? 'bg-white' : 'bg-white/40'}`} />)}
                      </div>
                    </>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 text-white">
                    <div className="absolute top-[-40px] right-3 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-[10px] font-black tracking-wider uppercase">
                      {getCompatibility(currentCard.score)}% {lang === 'es' ? 'compatible' : 'match'}
                    </div>
                    <h3 className="font-black text-lg leading-tight">{currentCard.displayName}</h3>
                    {currentCard.industry && (
                      <div className="flex items-center gap-1.5 text-white/80">
                        <HiOutlineBriefcase className="w-3 h-3" />
                        <span className="text-xs font-semibold">{currentCard.industry}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            }
            return (
              <div className="relative px-6 pt-12 pb-8 bg-gradient-to-br from-[#0A375A] to-[#134E7A] text-white">
                <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-[10px] font-black tracking-wider uppercase">
                  {getCompatibility(currentCard.score)}% {lang === 'es' ? 'compatible' : 'match'}
                </div>
                <div className="w-20 h-20 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center text-3xl font-black uppercase mx-auto mb-4">
                  {currentCard.displayName.charAt(0)}
                </div>
                <h3 className="font-black text-xl text-center leading-tight">{currentCard.displayName}</h3>
                {currentCard.industry && (
                  <div className="flex items-center justify-center gap-1.5 mt-2 text-white/70">
                    <HiOutlineBriefcase className="w-3.5 h-3.5" />
                    <span className="text-xs font-semibold">{currentCard.industry}</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Card body */}
          <div className="flex-1 px-6 py-5 flex flex-col gap-4">
            {/* Shared interests */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">
                {lang === 'es' ? 'Intereses en común' : 'Shared interests'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {currentCard.sharedInterests.map((interest) => (
                  <span
                    key={interest}
                    className="px-2.5 py-1 rounded-lg bg-orange-50 text-[#F97316] text-[10px] font-bold border border-orange-100"
                  >
                    {interestLabel(interest)}
                  </span>
                ))}
              </div>
            </div>

            {/* Info chips */}
            <div className="flex flex-wrap gap-2 mt-auto">
              {currentCard.industryMatch && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-[#0A375A] border border-blue-100">
                  <HiOutlineBriefcase className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold">
                    {lang === 'es' ? 'Misma industria' : 'Same industry'}
                  </span>
                </div>
              )}
              {currentCard.canShareLocationLater && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 border border-green-100">
                  <HiOutlineLocationMarker className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold">
                    {lang === 'es' ? 'Ubicación disponible' : 'Location available'}
                  </span>
                </div>
              )}
            </div>

            {/* Score dots */}
            <div className="flex items-center justify-center gap-1 pt-1">
              {Array.from({ length: Math.min(5, Math.max(1, currentCard.score)) }).map((_, i) => (
                <div key={i} className="w-2 h-2 rounded-full bg-[#F97316]" />
              ))}
              {Array.from({ length: Math.max(0, 5 - currentCard.score) }).map((_, i) => (
                <div key={`e-${i}`} className="w-2 h-2 rounded-full bg-gray-200" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-8">
        {/* Skip */}
        <button
          type="button"
          onClick={() => handleAction('skip')}
          disabled={processing}
          className="w-16 h-16 rounded-full bg-white border-2 border-red-200 flex items-center justify-center text-red-400 hover:bg-red-50 hover:border-red-300 hover:text-red-500 hover:scale-110 active:scale-95 transition-all shadow-lg shadow-red-100/50 disabled:opacity-50 cursor-pointer"
        >
          <HiOutlineX className="w-7 h-7" strokeWidth={2.5} />
        </button>

        {/* Connect */}
        <button
          type="button"
          onClick={() => handleAction('connect')}
          disabled={processing}
          className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-green-500 flex items-center justify-center text-white hover:from-green-500 hover:to-green-600 hover:scale-110 active:scale-95 transition-all shadow-lg shadow-green-200/50 disabled:opacity-50 cursor-pointer"
        >
          <HiOutlineCheck className="w-9 h-9" strokeWidth={2.5} />
        </button>
      </div>

      {/* Card counter */}
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
        {deck.length} {lang === 'es' ? 'perfiles restantes' : 'profiles remaining'}
      </p>
    </div>
  );
}
