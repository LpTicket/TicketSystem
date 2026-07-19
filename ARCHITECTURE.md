# LPTicket - Arquitectura Comprobada

**Proyecto:** LPTicket / TicketSystem
**Repositorio principal:** `/Users/sundingalue/Documents/TicketSystem`
**Última revisión documental:** 2026-07-19

## Vista General

LPTicket es una plataforma de gestión de eventos y venta de entradas. Reúne una aplicación móvil para clientes, organizadores y administradores, una plataforma web y un backend compartido.

La arquitectura busca mantener una única fuente de verdad para datos críticos, una experiencia consistente entre móvil y web, y una separación clara entre interfaz, reglas de negocio y almacenamiento.

```text
Cliente web / App móvil
        |
        v
Backend NestJS + Fastify
        |
        v
PostgreSQL + servicios externos
```

## Estructura del Repositorio

| Área | Ruta absoluta | Tecnología principal |
|---|---|---|
| Repositorio | `/Users/sundingalue/Documents/TicketSystem` | Git |
| Aplicación móvil | `/Users/sundingalue/Documents/TicketSystem/mobile` | React Native, Expo, TypeScript |
| Aplicación web | `/Users/sundingalue/Documents/TicketSystem/frontend` | Next.js, React, TypeScript |
| Backend | `/Users/sundingalue/Documents/TicketSystem/backend` | NestJS, Fastify, TypeORM, PostgreSQL |

## Principios Arquitectónicos

1. **Una fuente de verdad para datos críticos.** Pagos, órdenes, tickets, disponibilidad, mapas, bloqueos y permisos deben confirmarse en el backend. Ninguna interfaz debe asumir éxito antes de recibir la respuesta válida del servidor.
2. **Paridad funcional entre clientes.** Móvil y web pueden tener interfaces diferentes, pero deben usar las mismas reglas de negocio y reflejar el mismo estado cuando una función aplica a ambos.
3. **Límites claros de responsabilidad.** La interfaz presenta y solicita acciones; el backend valida, autoriza y persiste; la base de datos conserva el estado definitivo.
4. **Cambios compatibles y pequeños.** Mantener contratos de API existentes, DTOs, roles, entidades y flujos actuales. Cualquier modificación de un contrato compartido requiere revisar ambos clientes y el backend.
5. **Seguridad por defecto.** La autorización y validación deben ocurrir en el servidor, incluso cuando la interfaz ya limita una acción.
6. **Rendimiento sin sacrificar exactitud.** Usar caché de lectura para mejorar la carga, pero invalidar o refrescar datos después de cambios críticos. Nunca mostrar disponibilidad, pagos o bloqueos falsos por una caché desactualizada.
7. **Observabilidad y recuperación.** Los errores deben ser trazables, explicables al usuario sin exponer datos sensibles y recuperables con una nueva consulta al estado real.

### Cambios que Requieren Especial Cuidado

Los siguientes cambios deben investigarse, probarse y revisarse de forma ampliada antes de integrarse:

- Entidades TypeORM, relaciones, columnas, `synchronize`, migraciones o consultas de PostgreSQL.
- Endpoints de autenticación, autorización, roles, tokens, CORS, sesiones, validación o rate limiting.
- Órdenes, pagos, Stripe, Tap to Pay on iPhone, Apple Pay, reembolsos, recibos y venta en puerta.
- Disponibilidad de tickets, mapas de venue, bloqueo/desbloqueo de asientos o mesas y escaneo.
- Variables de entorno, secretos, dominios, Railway, almacenamiento de archivos y proveedores externos.
- Cambios que alteren una respuesta consumida por móvil y web.
- Configuración nativa de iOS, Expo, `app.json`, plugins, capacidades Xcode y perfiles de firma.

## Backend

### Base Técnica

- **Framework:** NestJS con adaptador Fastify.
- **ORM:** TypeORM.
- **Base de datos:** PostgreSQL.
- **Punto de entrada:** `/Users/sundingalue/Documents/TicketSystem/backend/src/main.ts`.
- **Prefijo API:** `/api`.

### Módulos Principales

El backend contiene módulos para autenticación, usuarios, eventos, categorías, órdenes, pagos, administración, marketing, analítica, escáner, acceso de puerta, Social Match, códigos especiales, plantillas de venue, soporte con IA y servicios comunes.

Las áreas de mayor impacto son:

- **Auth y Users:** acceso, identidad, roles y permisos.
- **Events y Venue Templates:** eventos, mapas, inventario de asientos, mesas y zonas.
- **Orders y Payments:** compras, cobros, tickets y estados de pago.
- **Scanner Access y Door Sale:** validación de entradas y ventas presenciales.
- **Social Match:** perfiles, sugerencias, conexiones y mensajería.
- **Admin, Marketing y Analytics:** operación interna, campañas y métricas.

### Ciclo de una Solicitud

1. Web o móvil realiza una solicitud a `/api`.
2. El backend aplica límites de tamaño, seguridad HTTP, CORS, validación y autenticación según el endpoint.
3. Los controladores reciben DTOs validados.
4. Los servicios aplican las reglas de negocio y autorización.
5. TypeORM consulta o modifica PostgreSQL.
6. El backend devuelve una respuesta compatible con el cliente consumidor.

### Controles Actuales Relevantes

De acuerdo con el arranque del backend, se mantienen estos controles:

- Límite aproximado de 10 MB para cuerpos de solicitud.
- Cabeceras de seguridad con Helmet.
- Sesión segura y contenido estático de cargas bajo `/uploads`.
- `ValidationPipe` con `whitelist` y rechazo de campos no permitidos.
- CORS restringido a orígenes configurados.
- Filtro global de excepciones y limitación global de solicitudes.

No se deben relajar estos controles para resolver un problema de interfaz sin investigar primero su causa real.

### Roles

Los roles y permisos se controlan desde el backend. La interfaz no debe convertirse en la única barrera de acceso. Antes de cambiar un flujo de cliente, organizador o administrador, verificar cómo se autoriza en guards, servicios y entidades.

## Base de Datos y Estado

PostgreSQL conserva el estado definitivo de usuarios, eventos, órdenes, tickets, relaciones sociales, disponibilidad y operaciones administrativas.

### Reglas de Integridad

- Las operaciones de compra, bloqueo y desbloqueo deben ser idempotentes cuando sea posible.
- La disponibilidad final siempre se valida en servidor.
- Los cambios de mapa deben reflejarse para organizadores y compradores después de que el backend confirma la operación.
- Las respuestas de error no deben dejar al cliente mostrando un estado local como definitivo.

### Datos y Archivos

Hay datos visuales y cargas asociadas a eventos. Antes de modificar almacenamiento, formato de imágenes o tamaño de payloads, evaluar el impacto en base de datos, red y rendimiento de dispositivos.

## Frontend Web

**Ruta:** `/Users/sundingalue/Documents/TicketSystem/frontend`
**Framework:** Next.js con React y TypeScript.

La web consume el mismo backend que móvil. Sus responsabilidades principales son presentación, interacción, navegación y manejo de estado de interfaz. Las reglas críticas no se deben duplicar sólo en componentes.

Áreas sensibles de la web:

- Compra y verificación de tickets.
- Paneles de organizador y administrador.
- Mapas y disponibilidad de eventos.
- Marketing y banners.
- Social Match y chat.

Después de modificar la web debe ejecutarse:

```bash
cd /Users/sundingalue/Documents/TicketSystem/frontend
npm run build
```

## Aplicación Móvil

**Ruta:** `/Users/sundingalue/Documents/TicketSystem/mobile`
**Tecnología:** React Native, Expo y TypeScript.

La app contiene experiencias de cliente, organizador y administrador. El estado temporal puede residir localmente, pero los datos críticos se consultan y confirman contra el backend.

### Estado Local y Caché

La caché móvil debe:

- Usar claves separadas por usuario autenticado.
- Mostrar datos previos sólo como mejora de carga cuando sea seguro.
- Refrescar en segundo plano.
- Invalidarse después de acciones que cambian disponibilidad, órdenes, perfiles, mensajes o permisos.
- No reemplazar la confirmación del backend para pagos, bloqueos, ventas o tickets.

### Tap to Pay on iPhone

La implementación de Tap to Pay se relaciona con:

- `/Users/sundingalue/Documents/TicketSystem/mobile/src/services/tapToPay.ts`
- `/Users/sundingalue/Documents/TicketSystem/mobile/src/services/doorSales.ts`
- `/Users/sundingalue/Documents/TicketSystem/mobile/src/services/tapToPayEducation.ts`
- `/Users/sundingalue/Documents/TicketSystem/mobile/src/screens/DoorSaleScreen.tsx`
- `/Users/sundingalue/Documents/TicketSystem/mobile/plugins/withTapToPayEducation`
- `/Users/sundingalue/Documents/TicketSystem/mobile/app.json`
- `/Users/sundingalue/Documents/TicketSystem/backend/src/orders/orders.service.ts`
- `/Users/sundingalue/Documents/TicketSystem/backend/src/orders/orders.controller.ts`

Este flujo requiere una compilación nativa; no puede validarse completamente desde Expo Go. La disponibilidad de la capacidad de Apple y la configuración externa de Stripe deben considerarse **no comprobadas** hasta que se prueben en un dispositivo físico y sean aprobadas por los proveedores correspondientes.

Después de modificar móvil debe ejecutarse:

```bash
cd /Users/sundingalue/Documents/TicketSystem/mobile
npx tsc --noEmit
```

## Rendimiento y Caché

La plataforma usa caché de lectura para mejorar cargas frecuentes. Los tiempos deben ser cortos y los datos deben actualizarse después de mutaciones relevantes.

Valores de referencia actuales revisados en el proyecto:

| Recurso | Tiempo de caché aproximado |
|---|---:|
| Eventos públicos, destacados y detalle | 60 segundos |
| Mapa de asientos | 15 segundos |
| Eventos y estadísticas de organizador | 30 segundos |
| Estadísticas y finanzas administrativas | 60 segundos |
| Social Match | 30 segundos |

Estos valores son una guía, no una autorización para ocultar cambios críticos. Si un usuario bloquea un asiento, compra un ticket o modifica un mapa, los clientes relacionados deben actualizar su estado de forma segura.

## Integraciones Externas

Las integraciones se administran por variables de entorno y proveedores externos. Nunca almacenar valores secretos en documentación, código cliente ni commits.

| Integración | Uso esperado | Cuidado requerido |
|---|---|---|
| Railway | Ejecución del backend | Revisar logs, variables y despliegue antes de producción |
| Stripe | Pagos y cobros | Probar estados aprobados, rechazados y recibos |
| Apple / Tap to Pay | Cobros presenciales en iPhone | Requiere capacidad, aprobación y dispositivo físico |
| Twilio / WhatsApp | Mensajería | Plantillas, consentimiento y estados de entrega |
| Email | Notificaciones y recibos | Revisar destinatario, contenido y datos privados |

Las variables se declaran en los archivos de entorno correspondientes de cada área. Documentar sus nombres, nunca sus valores.

## Pruebas y Despliegue

Las pruebas mínimas se ejecutan según el área modificada. El typecheck o build confirma compilación, pero no sustituye pruebas funcionales de pagos, mapas, caché, animaciones, proveedores externos o flujos de usuario.

Antes de cualquier despliegue o publicación:

```bash
cd /Users/sundingalue/Documents/TicketSystem
git fetch origin
git status --short
git diff --stat
git diff
```

Luego ejecutar las validaciones adecuadas y revisar si `origin/main` contiene cambios nuevos antes de integrar.

## Decisiones Pendientes

- Mantener y ampliar pruebas automatizadas para órdenes, pagos, disponibilidad y permisos.
- Definir una estrategia formal de migraciones antes de cambios de esquema de alto impacto.
- Revisar métricas de rendimiento y errores de producción antes de reducir tiempos de caché o cambiar reintentos.
- Confirmar con Apple y Stripe el estado externo de Tap to Pay antes de declararlo disponible en producción.

## Referencias Operativas

- Guía de trabajo: `/Users/sundingalue/Documents/TicketSystem/AGENTS.md`
- Estado actual: `/Users/sundingalue/Documents/TicketSystem/PROJECT_STATUS.md`
- Historial: `/Users/sundingalue/Documents/TicketSystem/CHANGELOG.md`
- Plan futuro: `/Users/sundingalue/Documents/TicketSystem/ROADMAP.md`
