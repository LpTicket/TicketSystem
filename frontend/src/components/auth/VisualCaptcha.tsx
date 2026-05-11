'use client';

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { useLang } from '@/context/LanguageContext';

interface VisualCaptchaProps {
  onVerify: (isValid: boolean) => void;
  onAnswerChange?: (answer: string) => void;
}

export interface VisualCaptchaHandle {
  refresh: () => void;
  getAnswer: () => string;
}

const VisualCaptcha = forwardRef<VisualCaptchaHandle, VisualCaptchaProps>(({ onAnswerChange }, ref) => {
  const { t } = useLang();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [answer, setAnswer] = useState('');

  const generateCaptcha = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setAnswer(result);
    if (onAnswerChange) onAnswerChange(result);
    drawCaptcha(result);
  };

  const drawCaptcha = (text: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Noise lines
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = `rgba(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255}, 0.3)`;
      ctx.beginPath();
      ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.stroke();
    }

    // Text
    ctx.font = 'bold 30px sans-serif';
    ctx.textBaseline = 'middle';
    const totalWidth = ctx.measureText(text).width;
    let startX = (canvas.width - totalWidth) / 2;

    for (let i = 0; i < text.length; i++) {
      ctx.save();
      ctx.translate(startX + i * 25, canvas.height / 2);
      ctx.rotate((Math.random() - 0.5) * 0.4);
      ctx.fillStyle = `rgb(${Math.random() * 150},${Math.random() * 150},${Math.random() * 150})`;
      ctx.fillText(text[i], 0, 0);
      ctx.restore();
    }

    // Noise dots
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.2})`;
      ctx.beginPath();
      ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  useEffect(() => {
    generateCaptcha();
  }, []);

  useImperativeHandle(ref, () => ({
    refresh: generateCaptcha,
    getAnswer: () => answer
  }));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <canvas 
          ref={canvasRef} 
          width={180} 
          height={50} 
          className="rounded border border-gray-200 cursor-pointer" 
          onClick={generateCaptcha}
          title={t('clickToRefresh' as any)}
        />
        <button 
          type="button" 
          onClick={generateCaptcha}
          className="text-xs text-blue-600 hover:underline font-medium"
        >
          {t('refresh' as any)}
        </button>
      </div>
    </div>
  );
});

VisualCaptcha.displayName = 'VisualCaptcha';

export default VisualCaptcha;
