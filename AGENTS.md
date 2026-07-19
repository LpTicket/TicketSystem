# LPTicket - Guía Oficial de Trabajo

## Visión

LPTicket busca ser una plataforma premium, confiable y escalable para descubrir eventos, comprar entradas, gestionar asistentes, organizar ventas y conectar personas mediante experiencias digitales modernas.

## Misión

Facilitar que clientes, organizadores, administradores y equipos de puerta puedan operar eventos de forma rápida, segura y clara desde web y móvil, manteniendo una sola fuente confiable de información.

## Objetivo Comercial

La plataforma debe permitir descubrir y promocionar eventos, vender tickets digitales, gestionar mapas y disponibilidad, cobrar online y presencialmente, validar entradas, analizar ventas y asistentes, y ofrecer marketing y experiencias sociales sin comprometer seguridad, rendimiento ni diseño.

## Tipo de Plataforma

LPTicket está compuesto por:

- App móvil React Native/Expo: `/Users/sundingalue/Documents/TicketSystem/mobile`
- Web Next.js: `/Users/sundingalue/Documents/TicketSystem/frontend`
- API NestJS/Fastify/TypeORM: `/Users/sundingalue/Documents/TicketSystem/backend`

Las tres aplicaciones comparten el backend como fuente de verdad.

## Experiencia Buscada

La experiencia debe sentirse premium, rápida, oscura, elegante, clara y confiable. Debe ser consistente entre móvil y web, incluso para personas sin conocimientos técnicos.

## Prioridades del Proyecto

1. Nunca romper producción.
2. Nunca comprometer la seguridad.
3. Mantener la mejor experiencia del usuario.
4. Reutilizar código existente antes de crear código nuevo.
5. Mantener una arquitectura limpia y escalable.
6. Mantener alto rendimiento.
7. Documentar correctamente los cambios.

## Lectura Obligatoria Antes de Cada Tarea

Antes de comenzar cualquier tarea nueva, leer obligatoriamente y en este orden:

1. `/Users/sundingalue/Documents/TicketSystem/AGENTS.md`
2. `/Users/sundingalue/Documents/TicketSystem/PROJECT_STATUS.md`
3. `/Users/sundingalue/Documents/TicketSystem/CHANGELOG.md`
4. `/Users/sundingalue/Documents/TicketSystem/ROADMAP.md`
5. `/Users/sundingalue/Documents/TicketSystem/ARCHITECTURE.md`

Después, revisar el estado actual:

```bash
cd /Users/sundingalue/Documents/TicketSystem
git status --short
```

## Principios de Diseño

- Mantener el diseño premium existente.
- Usar fondos oscuros, superficies translúcidas y texto legible.
- Evitar pantallas vacías, saltos visuales, flashes y cargas bloqueantes.
- No modificar animaciones existentes sin una solicitud clara.
- Diseñar para móvil primero, sin descuidar web.
- Mantener consistencia visual entre cliente, organizador y administrador.
- No introducir componentes, librerías o estilos innecesarios.
- No realizar cambios visuales fuera del alcance solicitado.

## Principios de Programación

- Investigar antes de modificar.
- No inventar causas: comprobar con código, logs, pruebas o documentación.
- Leer el archivo exacto antes de editarlo.
- Hacer cambios pequeños, directos y fáciles de verificar.
- Reutilizar helpers, servicios, componentes y patrones existentes.
- Evitar refactors grandes durante correcciones puntuales.
- No duplicar lógica entre móvil, web y backend si puede centralizarse.
- Mantener nombres claros y consistentes.

## Principios de Arquitectura

- El backend es la fuente de verdad para usuarios, eventos, mapas, asientos, bloqueos, órdenes y tickets.
- Web y móvil deben consumir la misma lógica de negocio cuando corresponda.
- La autorización debe verificarse en backend, no solo en la interfaz.
- Los cambios de datos compartidos deben reflejarse correctamente en cliente, organizador y administrador.
- Los mapas de asientos requieren especial cuidado: bloqueo, desbloqueo, venta y disponibilidad deben sincronizarse.
- Mantener separadas presentación, servicios API, lógica de negocio y persistencia.
- No cambiar entidades, rutas, DTOs, caché o pagos sin revisar impacto cruzado.

## Principios de Escalabilidad

- Evitar consultas repetidas y cargas innecesarias.
- Usar caché solo cuando no comprometa datos correctos.
- Invalidar caché al modificar eventos, mapas, asientos, ventas o datos relevantes.
- No cargar imágenes Base64 pesadas dentro de respuestas que no las necesitan.
- Preferir operaciones por lote al actualizar secciones o asientos.
- Preparar cambios para múltiples usuarios concurrentes.
- No asumir que una caché local será suficiente si el backend escala a varias instancias.

## Principios de Seguridad

- Nunca mostrar, copiar, guardar ni publicar secretos, contraseñas, tokens, claves API o certificados.
- Nunca modificar `.env` ni credenciales sin autorización explícita.
- Validar entradas en backend.
- Respetar autenticación, roles, propiedad de recursos y permisos.
- Tratar pagos, webhooks, Tap to Pay, QR, tickets y datos personales como áreas críticas.
- No desactivar protecciones de seguridad para resolver errores rápidamente.
- Revisar `/Users/sundingalue/Documents/TicketSystem/SECURITY.md` al afectar autenticación, tokens o permisos.

## Principios de Rendimiento

- La interfaz debe responder inmediatamente cuando sea seguro hacerlo.
- Las operaciones críticas deben confirmar el backend antes de declararse completas.
- No introducir polling, reintentos ni caché sin verificar su impacto.
- No dejar pantallas cargando indefinidamente.
- Medir primero si el problema está en frontend, móvil, red, backend, base de datos o proveedor externo.
- Mantener invalidaciones de caché correctas para mapas, ventas y tickets.

## Principios de Experiencia del Usuario

- Cada acción debe comunicar claramente qué está ocurriendo.
- Los errores deben ser comprensibles y útiles.
- Las acciones irreversibles requieren confirmación clara.
- Los flujos de pago deben mostrar preparación, procesamiento, resultado y comprobante.
- Al reiniciar o reabrir la app móvil, debe regresar a Eventos/Home del cliente.
- No mostrar datos antiguos de otro usuario.
- No ocultar información importante detrás de estados ambiguos.

## Flujo Antes de Editar

1. Identificar si el problema pertenece a móvil, web, backend o varias capas.
2. Ejecutar `git status --short` desde `/Users/sundingalue/Documents/TicketSystem`.
3. Leer los archivos exactos involucrados.
4. Revisar API, DTOs, servicios y entidades si el dato se comparte.
5. Explicar qué se verificó, qué falla, qué cambio concreto se hará y qué riesgo existe.
6. Editar solo lo necesario.
7. Ejecutar las pruebas correspondientes.
8. Actualizar documentación y CHANGELOG cuando sea una tarea importante.

## Validaciones Obligatorias

Después de editar móvil:

```bash
cd /Users/sundingalue/Documents/TicketSystem/mobile
npx tsc --noEmit
```

Después de editar frontend:

```bash
cd /Users/sundingalue/Documents/TicketSystem/frontend
npm run build
```

Después de editar backend:

```bash
cd /Users/sundingalue/Documents/TicketSystem/backend
npm run build
```

Para iniciar Metro:

```bash
cd /Users/sundingalue/Documents/TicketSystem/mobile
npx expo start --clear
```

Para ejecutar backend local:

```bash
cd /Users/sundingalue/Documents/TicketSystem/backend
npm run start:dev
```

Para ejecutar web local:

```bash
cd /Users/sundingalue/Documents/TicketSystem/frontend
npm run dev
```

## Áreas de Alto Riesgo

Analizar y pedir confirmación explícita antes de actuar en:

- Stripe, pagos, reembolsos, webhooks y Tap to Pay.
- Railway, despliegues, base de datos y Docker.
- Apple, EAS, Xcode, App Store Connect y TestFlight.
- Entidades TypeORM, migraciones, esquemas y `synchronize`.
- Login, JWT, OAuth, roles y permisos.
- Bloqueos de mapas, tickets, QR, ventas y escaneo.
- Email, SMS, WhatsApp, push y envíos masivos.
- Borrado de usuarios, eventos, órdenes o tickets.

## Git y Producción

Nunca hacer commit, push, deploy, publicación, FTP, migración ni cambios de producción sin confirmación explícita.

Antes de subir cambios:

```bash
cd /Users/sundingalue/Documents/TicketSystem
git fetch origin
git status --short
git diff --stat
git diff
```

Luego revisar cambios nuevos en `origin/main`, confirmar qué archivos se incluirán, ejecutar validaciones y excluir caches, builds, assets temporales y archivos no rastreados.

## Documentación

Después de cada tarea importante, actualizar:

- `/Users/sundingalue/Documents/TicketSystem/PROJECT_STATUS.md`
- `/Users/sundingalue/Documents/TicketSystem/CHANGELOG.md`
- `/Users/sundingalue/Documents/TicketSystem/ROADMAP.md` cuando cambien prioridades.
- `/Users/sundingalue/Documents/TicketSystem/ARCHITECTURE.md` cuando cambien módulos, flujos, datos o integraciones.

Nunca documentar una función como terminada si no fue comprobada. Usar siempre uno de estos estados:

- `IMPLEMENTADO`
- `IMPLEMENTADO Y COMPROBADO`
- `IMPLEMENTADO, NO PROBADO`
- `PARCIALMENTE IMPLEMENTADO`
- `PENDIENTE`
- `BLOQUEADO`
- `NO COMPROBADO`
- `NO ENCONTRADA`
