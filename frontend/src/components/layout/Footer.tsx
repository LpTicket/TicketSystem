import Link from 'next/link';
import Image from 'next/image';
import { FaWhatsapp, FaInstagram } from 'react-icons/fa';
import { useLang } from '@/context/LanguageContext';

export default function Footer() {
  const { t, lang } = useLang();
  return (
    <footer className="bg-[#0b1a2e] text-white print:hidden">
      <div className="w-full px-4 md:px-8 lg:px-12 py-12">
        <div className="flex flex-col lg:flex-row justify-between items-start gap-10">

          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/">
              <img src="/logo.png" alt="LPTicket" className="h-10 w-auto brightness-0 invert" />
            </Link>
          </div>

          {/* Links Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-12 gap-y-6 flex-grow max-w-3xl">
            <div className="space-y-6">
              <Link href="/about" className="block text-white/90 hover:text-white text-[15px] font-medium transition-colors">{t('whoWeAre')}</Link>
              <Link href="/terms" className="block text-white/90 hover:text-white text-[15px] font-medium transition-colors">{t('terms')}</Link>
              <Link href="/privacy" className="block text-white/90 hover:text-white text-[15px] font-medium transition-colors">{lang === 'es' ? 'Privacidad' : 'Privacy'}</Link>
            </div>
            <div className="space-y-6">
              <Link href="/events" className="block text-white/90 hover:text-white text-[15px] font-medium transition-colors">{t('events')}</Link>
              <Link href="/refunds" className="block text-white/90 hover:text-white text-[15px] font-medium transition-colors">{lang === 'es' ? 'Reembolsos' : 'Refunds'}</Link>
              <Link href="/dashboard" className="block text-white/90 hover:text-white text-[15px] font-medium transition-colors">{t('myTickets')}</Link>
            </div>
            <div className="space-y-6">
              <Link href="/contact" className="block text-white/90 hover:text-white text-[15px] font-medium transition-colors">{t('contact')}</Link>
              <Link href="/support" className="block text-white/90 hover:text-white text-[15px] font-medium transition-colors">{t('support')}</Link>
              <Link href="/organizer-agreement" className="block text-white/90 hover:text-white text-[15px] font-medium transition-colors">{lang === 'es' ? 'Acuerdo de Organizador' : 'Organizer Agreement'}</Link>
            </div>
          </div>

          {/* Social Icons */}
          <div className="flex items-center gap-4 lg:self-end pb-2">
            <a href="#" className="w-8 h-8 rounded-full border border-white flex items-center justify-center text-white hover:bg-white/10 transition-colors">
              <FaWhatsapp className="w-4 h-4" />
            </a>
            <a href="#" className="w-8 h-8 rounded-full border border-white flex items-center justify-center text-white hover:bg-white/10 transition-colors">
              <FaInstagram className="w-4 h-4" />
            </a>
          </div>

        </div>

        {/* Copyright */}
        <div className="border-t border-white/10 mt-10 pt-6">
          <p className="text-white/50 text-[13px]">Copyright ©{new Date().getFullYear()} LPTicket. {t('copyright')}</p>
        </div>
      </div>
    </footer>
  );
}
