import Link from 'next/link';

export const revalidate = 3600;

export default function AboutPage() {
  return (
    <div className="page-dark-shell min-h-screen py-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">

        {/* Hero */}
        <div className="text-center space-y-4 animate-fade-in">
          <span className="inline-flex items-center px-3 py-1 bg-primary-50 text-primary-600 rounded-full text-xs font-bold tracking-wider uppercase">
            LPTicket
          </span>
          <h1 className="public-premium-title text-4xl sm:text-5xl font-black tracking-tight">
            Quiénes somos
          </h1>
          <p className="text-gray-500 max-w-3xl mx-auto text-base sm:text-lg leading-relaxed">
            LPTicket es una plataforma de boletería digital creada en Estados Unidos para conectar eventos, organizadores y asistentes a través de una experiencia moderna, segura y fácil de usar.
          </p>
        </div>

        {/* Main description */}
        <div className="public-premium-card p-8 space-y-4 text-sm sm:text-base leading-7 text-slate-700 transition-all">
          <p>
            Nacemos con el propósito de ofrecer una solución confiable para la venta de tickets en línea, ayudando a productores, promotores, empresas, marcas y organizaciones a gestionar sus eventos de manera profesional, desde la publicación del evento hasta el control de acceso.
          </p>
          <p>
            Nuestra plataforma está diseñada para todo tipo de eventos: conciertos, conferencias, networking, teatros, exposiciones, festivales, eventos corporativos, sociales, culturales y experiencias especiales.
          </p>
          <p>
            En LPTicket creemos que cada evento merece una presentación profesional, una venta organizada y una experiencia de entrada confiable. Por eso trabajamos para que organizadores y asistentes tengan una plataforma clara, elegante, segura y preparada para el mercado actual.
          </p>
        </div>

        {/* Mission & Vision */}
        <div className="grid gap-6 md:grid-cols-2">
          <article className="public-premium-card p-8 transition-all">
            <h2 className="public-premium-title text-2xl font-black">Nuestra misión</h2>
            <p className="mt-4 text-sm sm:text-base leading-7 text-slate-600">
              Ofrecer una plataforma de boletería moderna, segura y accesible que permita a organizadores, productores, empresas y marcas vender tickets de manera profesional, rápida y confiable, brindando al público una experiencia de compra simple, clara y segura.
            </p>
          </article>

          <article className="public-premium-card p-8 transition-all">
            <h2 className="public-premium-title text-2xl font-black">Nuestra visión</h2>
            <div className="mt-4 space-y-4 text-sm sm:text-base leading-7 text-slate-600">
              <p>
                Convertirnos en una de las plataformas de boletería digital más confiables en Estados Unidos, impulsando eventos de todo tipo con tecnología, innovación y una experiencia de usuario premium.
              </p>
              <p>
                Queremos ser el puente entre grandes experiencias y las personas que desean vivirlas, ayudando a que cada evento tenga mayor alcance, mejor organización y una presentación profesional desde el primer clic.
              </p>
            </div>
          </article>
        </div>

        {/* CTA */}
        <div className="public-premium-card p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-primary-100">
          <div>
            <h2 className="public-premium-title text-lg font-black">
              Crea, vende y valida tickets con LPTicket
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Una experiencia profesional para organizadores y asistentes.
            </p>
          </div>
          <Link href="/contact" className="btn-primary shrink-0">
            Contactar
          </Link>
        </div>

      </div>
    </div>
  );
}
