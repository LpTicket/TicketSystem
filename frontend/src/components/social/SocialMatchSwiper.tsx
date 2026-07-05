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

type Props = {
  suggestions: SocialMatchSuggestion[];
  lang: 'es' | 'en';
  onConnect: (userId: string) => Promise<void>;
  onSkip?: (userId: string) => Promise<void> | void;
};

export default function SocialMatchSwiper({ suggestions, lang, onConnect, onSkip }: Props) {
  const [deck, setDeck] = useState<SocialMatchSuggestion[]>(suggestions);
  const [animating, setAnimating] = useState<'left' | 'right' | null>(null);
  const [processing, setProcessing] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [brokenPhotos, setBrokenPhotos] = useState<Set<string>>(new Set());

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
        await onSkip?.(currentCard.userId);
      }
    } catch {
      // handled by parent
    }

    // Wait for animation
    setTimeout(() => {
      setDeck((prev) => prev.slice(1));
      setPhotoIndex(0);
      setBrokenPhotos(new Set());
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
      <div className="relative w-full max-w-lg mx-auto" style={{ height: 720 }}>
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
            const allPhotos = (currentCard.photos || []).filter((src) => !brokenPhotos.has(src));
            const clampedIndex = Math.min(photoIndex, Math.max(0, allPhotos.length - 1));
            if (allPhotos.length > 0) {
              return (
                <div className="relative h-[420px] bg-[#0A375A] overflow-hidden">
                  <img
                    src={allPhotos[clampedIndex]}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={() => {
                      setBrokenPhotos((prev) => new Set([...prev, allPhotos[clampedIndex]]));
                      setPhotoIndex((p) => Math.max(0, p - 1));
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                  {/* Tap zones — left half goes back, right half goes forward */}
                  {allPhotos.length > 1 && (
                    <>
                      <button
                        type="button"
                        className="absolute left-0 top-0 w-1/2 h-full z-10 flex items-center justify-start pl-3"
                        onClick={(e) => { e.stopPropagation(); setPhotoIndex((p) => Math.max(0, p - 1)); }}
                      >
                        {clampedIndex > 0 && (
                          <div className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white text-xl font-bold shadow-lg">‹</div>
                        )}
                      </button>
                      <button
                        type="button"
                        className="absolute right-0 top-0 w-1/2 h-full z-10 flex items-center justify-end pr-3"
                        onClick={(e) => { e.stopPropagation(); setPhotoIndex((p) => Math.min(allPhotos.length - 1, p + 1)); }}
                      >
                        {clampedIndex < allPhotos.length - 1 && (
                          <div className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white text-xl font-bold shadow-lg">›</div>
                        )}
                      </button>
                      {/* Progress bars (Instagram-style) */}
                      <div className="absolute top-3 left-3 right-3 flex gap-1 z-20">
                        {allPhotos.map((_, i) => (
                          <div key={i} className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden">
                            <div className={`h-full rounded-full bg-white transition-all duration-300 ${i <= clampedIndex ? 'w-full' : 'w-0'}`} />
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Name + info overlay */}
                  <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 text-white z-20">
                    <div className="absolute top-[-44px] right-3 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-[10px] font-black tracking-wider uppercase">
                      {getCompatibility(currentCard.score)}% {lang === 'es' ? 'compatible' : 'match'}
                    </div>
                    <h3 className="font-black text-xl leading-tight">{currentCard.displayName}</h3>
                    {currentCard.industry && (
                      <div className="flex items-center gap-1.5 text-white/80 mt-0.5">
                        <HiOutlineBriefcase className="w-3.5 h-3.5" />
                        <span className="text-sm font-semibold">{currentCard.industry}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            }
            return (
              <div className="relative px-8 pt-16 pb-10 bg-gradient-to-br from-[#0A375A] to-[#134E7A] text-white">
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
          <div className="flex-1 px-5 py-5 flex flex-col gap-5 overflow-y-auto">
            {/* All interests — shared ones highlighted */}
            {(currentCard.interests || []).length > 0 && (
              <div>
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3">
                  {lang === 'es' ? 'Intereses' : 'Interests'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(currentCard.interests || []).map((interest) => {
                    const isShared = currentCard.sharedInterests.includes(interest);
                    return (
                      <span
                        key={interest}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
                          isShared
                            ? 'bg-orange-50 text-[#F97316] border-orange-300 shadow-sm shadow-orange-100'
                            : 'bg-gray-50 text-gray-500 border-gray-200'
                        }`}
                      >
                        {isShared && <span className="mr-1 font-black">✓</span>}{interestLabel(interest)}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Info chips */}
            <div className="flex flex-wrap gap-2">
              {currentCard.industryMatch && (
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-50 text-[#0A375A] border border-blue-100">
                  <HiOutlineBriefcase className="w-4 h-4" />
                  <span className="text-xs font-bold">{lang === 'es' ? 'Misma industria' : 'Same industry'}</span>
                </div>
              )}
              {currentCard.canShareLocationLater && (
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-green-50 text-green-700 border border-green-100">
                  <HiOutlineLocationMarker className="w-4 h-4" />
                  <span className="text-xs font-bold">{lang === 'es' ? 'Ubicación disponible' : 'Location available'}</span>
                </div>
              )}
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-orange-50 text-[#F97316] border border-orange-200 ml-auto">
                <HiOutlineSparkles className="w-4 h-4" />
                <span className="text-xs font-black">{getCompatibility(currentCard.score)}% match</span>
              </div>
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
