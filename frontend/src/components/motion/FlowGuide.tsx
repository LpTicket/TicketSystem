'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useLang } from '@/context/LanguageContext';

export default function FlowGuide({ organizer = false }: { organizer?: boolean }) {
  const { lang } = useLang();
  const reduced = useReducedMotion();
  const es = lang === 'es';
  const steps = organizer
    ? (es ? ['Crea tu evento', 'Configura tus entradas', 'Publica el evento', 'Valida el acceso'] : ['Create your event', 'Set up tickets', 'Publish the event', 'Validate entry'])
    : (es ? ['Elige un evento', 'Selecciona tus entradas', 'Completa el pago', 'Consulta Mis Tickets'] : ['Choose an event', 'Select your tickets', 'Complete payment', 'Open My Tickets']);
  return <section className="lp-flow-guide" aria-label={es ? (organizer ? 'Cómo organizar tu evento' : 'Cómo comprar entradas') : (organizer ? 'How to organize your event' : 'How to buy tickets')}>
    <h2 className="text-lg font-semibold text-white mb-5">{es ? (organizer ? 'De tu evento al acceso' : 'Tu próxima experiencia, en cuatro pasos') : (organizer ? 'From your event to entry' : 'Your next experience in four steps')}</h2>
    <ol className="grid grid-cols-1 sm:grid-cols-4 gap-4">
      {steps.map((step, index) => <li key={step} className="relative min-w-0">
        <span className="lp-flow-number">{index + 1}</span>
        {index < 3 && <svg aria-hidden="true" className="lp-flow-line" viewBox="0 0 100 4" preserveAspectRatio="none"><motion.path d="M0 2 H100" fill="none" stroke="currentColor" strokeWidth="2" initial={reduced ? false : { pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: reduced ? 0 : .5, delay: reduced ? 0 : index * .12 }} /></svg>}
        <p className="mt-3 text-sm text-slate-200">{step}</p>
      </li>)}
    </ol>
  </section>;
}
