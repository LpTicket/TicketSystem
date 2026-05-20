'use client';

import { useLang } from '@/context/LanguageContext';
import { HiOutlineUserGroup, HiOutlineLightBulb, HiOutlineEye } from 'react-icons/hi';

export default function AboutPage() {
  const { t } = useLang();

  return (
    <div className="bg-gray-50 min-h-screen py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-16 animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold text-[#0a375a] mb-4">{t('aboutTitle')}</h1>
          <div className="w-24 h-1 bg-primary-500 mx-auto rounded-full"></div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12 mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <HiOutlineUserGroup className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">{t('aboutTitle')}</h2>
          </div>
          <p className="text-gray-600 leading-relaxed text-lg">
            {t('aboutText1')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-10 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center">
                <HiOutlineLightBulb className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">{t('aboutMissionTitle')}</h2>
            </div>
            <p className="text-gray-600 leading-relaxed">
              {t('aboutMissionText')}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-10 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
                <HiOutlineEye className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">{t('aboutVisionTitle')}</h2>
            </div>
            <p className="text-gray-600 leading-relaxed">
              {t('aboutVisionText')}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
