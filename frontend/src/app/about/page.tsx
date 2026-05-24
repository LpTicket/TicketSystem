import Link from 'next/link';

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#f8fafc]">
      <section className="bg-[#0A375A] text-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#F97316]">
            LPTicket
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            Quiénes somos
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-blue-50 sm:text-lg">
            LPTicket es una plataforma de boletería digital creada en Estados Unidos para conectar eventos, organizadores y asistentes a través de una experiencia moderna, segura y fácil de usar.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="space-y-10">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="space-y-5 text-sm leading-7 text-slate-700 sm:text-base sm:leading-8">
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
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-2xl font-black text-[#0A375A]">
                Nuestra misión
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-700 sm:text-base sm:leading-8">
                Ofrecer una plataforma de boletería moderna, segura y accesible que permita a organizadores, productores, empresas y marcas vender tickets de manera profesional, rápida y confiable, brindando al público una experiencia de compra simple, clara y segura.
              </p>
            </article>

            <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-2xl font-black text-[#0A375A]">
                Nuestra visión
              </h2>
              <div className="mt-4 space-y-4 text-sm leading-7 text-slate-700 sm:text-base sm:leading-8">
                <p>
                  Convertirnos en una de las plataformas de boletería digital más confiables en Estados Unidos, impulsando eventos de todo tipo con tecnología, innovación y una experiencia de usuario premium.
                </p>
                <p>
                  Queremos ser el puente entre grandes experiencias y las personas que desean vivirlas, ayudando a que cada evento tenga mayor alcance, mejor organización y una presentación profesional desde el primer clic.
                </p>
              </div>
            </article>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-[#F97316]/20 bg-[#fff7ed] p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-[#0A375A]">
                Crea, vende y valida tickets con LPTicket
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Una experiencia profesional para organizadores y asistentes.
              </p>
            </div>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-md bg-[#F97316] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#ea580c]"
            >
              Contactar
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
