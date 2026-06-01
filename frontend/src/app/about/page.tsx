'use client';

import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';

export default function AboutPage() {
  const { lang } = useLang();
  const es = lang === 'es';

  return (
    <div className="page-dark-shell min-h-screen pt-28 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 mt-12 md:mt-16">

        {/* Hero */}
        <div className="text-center space-y-4 animate-fade-in">
          <span className="inline-flex items-center px-3 py-1 bg-primary-50 text-primary-600 rounded-full text-xs font-bold tracking-wider uppercase">
            LPTicket
          </span>
          <h1 className="public-premium-title text-4xl sm:text-5xl font-black tracking-tight">
            {es ? 'Quiénes somos' : 'About us'}
          </h1>
          <p className="text-gray-500 max-w-3xl mx-auto text-base sm:text-lg leading-relaxed">
            {es
              ? 'LPTicket es una plataforma de boletería digital creada en Estados Unidos para conectar eventos, organizadores y asistentes a través de una experiencia moderna, segura y fácil de usar.'
              : 'LPTicket is a digital ticketing platform built in the United States to connect events, organizers and attendees through a modern, secure and easy-to-use experience.'}
          </p>
        </div>

        {/* Main description */}
        <div className="public-premium-card p-8 space-y-4 text-sm sm:text-base leading-7 text-slate-700 transition-all">
          <p>
            {es
              ? 'Nacemos con el propósito de ofrecer una solución confiable para la venta de tickets en línea, ayudando a productores, promotores, empresas, marcas y organizaciones a gestionar sus eventos de manera profesional, desde la publicación del evento hasta el control de acceso.'
              : 'We were born to offer a reliable solution for online ticket sales, helping producers, promoters, companies, brands and organizations manage their events professionally — from publishing the event to access control.'}
          </p>
          <p>
            {es
              ? 'Nuestra plataforma está diseñada para todo tipo de eventos: conciertos, conferencias, networking, teatros, exposiciones, festivales, eventos corporativos, sociales, culturales y experiencias especiales.'
              : 'Our platform is designed for every kind of event: concerts, conferences, networking, theater, exhibitions, festivals, corporate, social and cultural events, and special experiences.'}
          </p>
          <p>
            {es
              ? 'En LPTicket creemos que cada evento merece una presentación profesional, una venta organizada y una experiencia de entrada confiable. Por eso trabajamos para que organizadores y asistentes tengan una plataforma clara, elegante, segura y preparada para el mercado actual.'
              : 'At LPTicket we believe every event deserves a professional presentation, organized sales and a reliable entry experience. That is why we work so organizers and attendees have a clear, elegant, secure platform ready for today’s market.'}
          </p>
        </div>

        {/* Mission & Vision */}
        <div className="grid gap-6 md:grid-cols-2">
          <article className="public-premium-card p-8 transition-all">
            <h2 className="public-premium-title text-2xl font-black">{es ? 'Nuestra misión' : 'Our mission'}</h2>
            <p className="mt-4 text-sm sm:text-base leading-7 text-slate-600">
              {es
                ? 'Ofrecer una plataforma de boletería moderna, segura y accesible que permita a organizadores, productores, empresas y marcas vender tickets de manera profesional, rápida y confiable, brindando al público una experiencia de compra simple, clara y segura.'
                : 'To offer a modern, secure and accessible ticketing platform that lets organizers, producers, companies and brands sell tickets professionally, quickly and reliably, giving the public a simple, clear and secure buying experience.'}
            </p>
          </article>

          <article className="public-premium-card p-8 transition-all">
            <h2 className="public-premium-title text-2xl font-black">{es ? 'Nuestra visión' : 'Our vision'}</h2>
            <div className="mt-4 space-y-4 text-sm sm:text-base leading-7 text-slate-600">
              <p>
                {es
                  ? 'Convertirnos en una de las plataformas de boletería digital más confiables en Estados Unidos, impulsando eventos de todo tipo con tecnología, innovación y una experiencia de usuario premium.'
                  : 'To become one of the most trusted digital ticketing platforms in the United States, powering all kinds of events with technology, innovation and a premium user experience.'}
              </p>
              <p>
                {es
                  ? 'Queremos ser el puente entre grandes experiencias y las personas que desean vivirlas, ayudando a que cada evento tenga mayor alcance, mejor organización y una presentación profesional desde el primer clic.'
                  : 'We want to be the bridge between great experiences and the people who want to live them, helping every event reach more people with better organization and a professional presentation from the first click.'}
              </p>
            </div>
          </article>
        </div>

        {/* CTA */}
        <div className="public-premium-card p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-primary-100">
          <div>
            <h2 className="public-premium-title text-lg font-black">
              {es ? 'Crea, vende y valida tickets con LPTicket' : 'Create, sell and validate tickets with LPTicket'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {es ? 'Una experiencia profesional para organizadores y asistentes.' : 'A professional experience for organizers and attendees.'}
            </p>
          </div>
          <Link href="/contact" className="btn-primary shrink-0">
            {es ? 'Contactar' : 'Contact'}
          </Link>
        </div>

      </div>
    </div>
  );
}
