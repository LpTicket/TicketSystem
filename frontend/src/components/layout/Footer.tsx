import Link from 'next/link';
import { FaWhatsapp, FaInstagram } from 'react-icons/fa';
import { useLang } from '@/context/LanguageContext';

export default function Footer() {
  const { t, lang } = useLang();
  
  return (
    <footer className="bg-[#0A375A] text-white print:hidden border-t border-white/5">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-10">
        
        {/* Top Section: Logo & Socials (As in Passline) */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-6 pb-10 border-b border-white/5 mb-10">
          <Link href="/" className="flex-shrink-0">
            <img
              src="/logo.png"
              alt="LPTicket"
              className="h-10 md:h-12 w-auto object-contain"
            />
          </Link>

          <div className="flex items-center gap-4">
            <a
              href="https://wa.me/18323790809"
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white hover:bg-white/10 hover:border-white transition-all"
            >
              <FaWhatsapp className="w-5 h-5" />
            </a>
            <a
              href="https://www.instagram.com/lpticket"
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white hover:bg-white/10 hover:border-white transition-all"
            >
              <FaInstagram className="w-5 h-5" />
            </a>
          </div>
        </div>

        {/* Middle Section: Links Grid (4 Columns as in Passline) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-12 gap-y-12 mb-12">
          {/* Column 1: LPTICKET */}
          <div className="flex flex-col gap-5">
            <h4 className="text-[14px] font-black uppercase tracking-wider text-white/90">LPTICKET</h4>
            <div className="flex flex-col gap-3">
              <Link href="/about" className="text-[13px] font-bold text-white/60 hover:text-blue-400 transition-colors">{t('whoWeAre')}</Link>
            </div>
          </div>
          
          {/* Column 2: TU EVENTO */}
          <div className="flex flex-col gap-5">
            <h4 className="text-[14px] font-black uppercase tracking-wider text-white/90">{lang === 'es' ? 'TU EVENTO' : 'YOUR EVENT'}</h4>
            <div className="flex flex-col gap-3">
              <Link href="/events" className="text-[13px] font-bold text-white/60 hover:text-blue-400 transition-colors">{t('events')}</Link>
              <Link href="/refunds" className="text-[13px] font-bold text-white/60 hover:text-blue-400 transition-colors">{lang === 'es' ? 'Reembolsos' : 'Refunds'}</Link>
              <Link href="/dashboard" className="text-[13px] font-bold text-white/60 hover:text-blue-400 transition-colors">{t('myTickets')}</Link>
            </div>
          </div>

          {/* Column 3: LEGAL */}
          <div className="flex flex-col gap-5">
            <h4 className="text-[14px] font-black uppercase tracking-wider text-white/90">{lang === 'es' ? 'LEGAL' : 'LEGAL'}</h4>
            <div className="flex flex-col gap-3">
              <Link href="/terms" className="text-[13px] font-bold text-white/60 hover:text-blue-400 transition-colors">{t('terms')}</Link>
              <Link href="/privacy" className="text-[13px] font-bold text-white/60 hover:text-blue-400 transition-colors">{lang === 'es' ? 'Privacidad' : 'Privacy'}</Link>
              <Link href="/support" className="text-[13px] font-bold text-white/60 hover:text-blue-400 transition-colors">{t('support')}</Link>
              <Link href="/organizer-agreement" className="text-[13px] font-bold text-white/60 hover:text-blue-400 transition-colors">{lang === 'es' ? 'Acuerdo de Organizador' : 'Organizer Agreement'}</Link>
            </div>
          </div>
          
          {/* Column 4: CONTACTO */}
          <div className="flex flex-col gap-5">
            <h4 className="text-[14px] font-black uppercase tracking-wider text-white/90">{lang === 'es' ? 'CONTACTO' : 'CONTACT'}</h4>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-white/30">{lang === 'es' ? 'Dirección' : 'Address'}</span>
                <p className="text-[12px] font-bold text-white/70">1325 Main St Suite 203, Katy, TX 77494</p>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-white/30">{lang === 'es' ? 'Teléfono' : 'Phone'}</span>
                <p className="text-[12px] font-bold text-white/70">832.379.0809</p>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-white/30">{lang === 'es' ? 'Correo' : 'Email'}</span>
                <p className="text-[12px] font-bold text-white/70">info@lpticket.com</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section: Legal Disclaimer & Copyright */}
        <div className="pt-10 border-t border-white/5 text-center">
          <p className="max-w-5xl mx-auto text-[11px] leading-relaxed text-white/25 font-medium italic mb-8">
            {lang === 'es' 
              ? 'Importante: LP Ticket no se hace responsable por la calidad, organización, cambios, cancelaciones o satisfacción de los eventos publicados. LP Ticket es una plataforma que brinda servicios de venta de entradas en línea y gestión de acceso a eventos. Al usar este sitio, usted acepta los términos y condiciones de la aplicación.'
              : 'Important: LP Ticket is not responsible for the quality, organization, changes, cancellation, or satisfaction of the published events. LP Ticket is a platform that provides online ticket sales and event access management services. By using this site, you accept the terms and conditions of the application.'
            }
          </p>
          <div className="flex justify-center items-center gap-4 text-[10px] font-black uppercase tracking-[0.3em] text-white/15">
            <span>Copyright © 2026 LP Ticket</span>
            <span className="w-1 h-1 bg-white/10 rounded-full" />
            <span>{t('copyright')}</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
