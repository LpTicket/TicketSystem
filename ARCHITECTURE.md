# LPTicket — Architecture Guide / Guía de Arquitectura

> Bilingual (English / Español). Each section is given in English first, then Spanish.
> Bilingüe (Inglés / Español). Cada sección se da primero en inglés y luego en español.

---

## 1. Overview / Visión general

**EN —** LPTicket is an event ticketing platform with three independent applications that share one backend API:

- **`backend/`** — NestJS + Fastify REST API (TypeScript), PostgreSQL via TypeORM. Handles auth, events, seat maps, orders/payments (Stripe), tickets, marketing, analytics and admin.
- **`frontend/`** — Next.js (App Router) web app for buyers, organizers and admins.
- **`mobile/`** — React Native + Expo app (iOS/Android) mirroring the web features.

The web and mobile clients talk to the same API. The backend is the single source of truth.

**ES —** LPTicket es una plataforma de venta de entradas para eventos con tres aplicaciones independientes que comparten una sola API de backend:

- **`backend/`** — API REST en NestJS + Fastify (TypeScript), PostgreSQL mediante TypeORM. Gestiona autenticación, eventos, mapas de asientos, órdenes/pagos (Stripe), tickets, marketing, analítica y administración.
- **`frontend/`** — App web en Next.js (App Router) para compradores, organizadores y administradores.
- **`mobile/`** — App en React Native + Expo (iOS/Android) que replica las funciones de la web.

Los clientes web y mobile consumen la misma API. El backend es la única fuente de verdad.

---

## 2. High-level flow / Flujo de alto nivel

```
[ mobile (Expo) ]  ──┐
                     ├──►  [ backend API (NestJS/Fastify) ]  ──►  [ PostgreSQL ]
[ frontend (Next) ] ─┘                  │
                                        ├──►  Stripe (payments / webhooks)
                                        ├──►  Email (nodemailer)
                                        └──►  WhatsApp / Push (marketing)
```

**EN —** Buyers browse events, pick seats, pay via Stripe, and receive a QR ticket (Apple/Google Wallet supported). Organizers manage their events, seat maps, pricing, attendees, blocks/invites and reminders. Admins manage users, events, fees, categories, marketing and payouts.

**ES —** Los compradores exploran eventos, eligen asientos, pagan con Stripe y reciben un ticket con QR (compatible con Apple/Google Wallet). Los organizadores gestionan sus eventos, mapas de asientos, precios, asistentes, bloqueos/invitaciones y recordatorios. Los administradores gestionan usuarios, eventos, tarifas, categorías, marketing y pagos.

---

## 3. Backend modules / Módulos del backend

**EN —** Each folder under `backend/src/` is a NestJS module (controller + service + DTOs):

| Module | Responsibility |
| --- | --- |
| `auth` | Registration, login, JWT access/refresh, Google/Facebook OAuth, password reset, profile. |
| `events` | Events CRUD, publishing, seat maps/sections, images, organizer-owned listings, price/commission change requests. |
| `orders` | Stripe checkout, webhooks, ticket issuance & validation (scanning), sales/attendees, door sales, reminders, free invites, seat blocking. |
| `payments` | Stored payment methods for a user. |
| `admin` | Admin dashboard, user/event management, fees, prices, payouts. |
| `categories` | Event categories (+ realtime version polling for web/mobile sync). |
| `marketing` | Home banners, email/SMS/WhatsApp/push campaigns, push tokens. |
| `analytics` | Page-view tracking and summaries. |
| `special-codes` | Promoter/creator codes and commission payouts. |
| `scanner-access` | Door-scanner access requests/approvals for staff. |
| `social-match` | Optional social/matchmaking feature between attendees. |
| `venue-templates` | Reusable venue/seat-map templates. |
| `common` | Shared guards, decorators, filters, services (mail, storage, wallet). |
| `database` | TypeORM entities and one-off migration/fix scripts. |

**ES —** Cada carpeta dentro de `backend/src/` es un módulo de NestJS (controlador + servicio + DTOs):

| Módulo | Responsabilidad |
| --- | --- |
| `auth` | Registro, login, JWT de acceso/refresco, OAuth de Google/Facebook, restablecimiento de contraseña, perfil. |
| `events` | CRUD de eventos, publicación, mapas de asientos/secciones, imágenes, listados del organizador, solicitudes de cambio de precio/comisión. |
| `orders` | Checkout de Stripe, webhooks, emisión y validación de tickets (escaneo), ventas/asistentes, ventas en puerta, recordatorios, invitaciones gratis, bloqueo de asientos. |
| `payments` | Métodos de pago guardados de un usuario. |
| `admin` | Panel de administración, gestión de usuarios/eventos, tarifas, precios, pagos. |
| `categories` | Categorías de eventos (+ sondeo de versión en tiempo real para sincronizar web/mobile). |
| `marketing` | Banners de inicio, campañas de email/SMS/WhatsApp/push, tokens de push. |
| `analytics` | Registro y resúmenes de vistas de página. |
| `special-codes` | Códigos de promotor/creador y pagos de comisiones. |
| `scanner-access` | Solicitudes/aprobaciones de acceso al escáner de puerta para el personal. |
| `social-match` | Función social/de emparejamiento opcional entre asistentes. |
| `venue-templates` | Plantillas reutilizables de recinto/mapa de asientos. |
| `common` | Guards, decoradores, filtros y servicios compartidos (correo, almacenamiento, wallet). |
| `database` | Entidades de TypeORM y scripts puntuales de migración/corrección. |

### Request lifecycle / Ciclo de vida de una petición

**EN —** `main.ts` boots Fastify with: a 10MB body limit, `@fastify/helmet` (security headers), `@fastify/secure-session`, static `/uploads`, a global `ValidationPipe` (`whitelist` + `forbidNonWhitelisted`), a strict CORS allow-list, the `/api` global prefix, and a global exception filter. Rate limiting is applied globally via `@nestjs/throttler` (see `app.module.ts`), with stricter per-route limits on auth endpoints.

**ES —** `main.ts` arranca Fastify con: límite de cuerpo de 10MB, `@fastify/helmet` (cabeceras de seguridad), `@fastify/secure-session`, `/uploads` estáticos, un `ValidationPipe` global (`whitelist` + `forbidNonWhitelisted`), una lista blanca estricta de CORS, el prefijo global `/api` y un filtro global de excepciones. El rate limiting se aplica globalmente con `@nestjs/throttler` (ver `app.module.ts`), con límites más estrictos por ruta en los endpoints de autenticación.

---

## 4. Authentication / Autenticación

**EN —**
- JWT **access** token (short-lived, default 1h) + **refresh** token (default 7d, separate secret).
- Tokens are issued by `AuthService.generateTokens()` and validated by `JwtStrategy`.
- Routes are protected with `@UseGuards(AuthGuard('jwt'))`; role-restricted routes add `RolesGuard` + `@Roles(UserRole.ADMIN | CLIENT)`.
- **Security:** the server refuses to start without `JWT_SECRET` / `JWT_REFRESH_SECRET` in production (no insecure fallbacks). Self-registration is always `CLIENT` — `role` is never accepted from the client.
- **Clients:** web stores tokens in `localStorage`; mobile stores them in `AsyncStorage` and sends `Authorization: Bearer`. See `SECURITY.md` for the deferred httpOnly-cookie migration.

**ES —**
- Token JWT de **acceso** (corta duración, 1h por defecto) + token de **refresco** (7d por defecto, con secreto separado).
- Los tokens los emite `AuthService.generateTokens()` y los valida `JwtStrategy`.
- Las rutas se protegen con `@UseGuards(AuthGuard('jwt'))`; las rutas restringidas por rol añaden `RolesGuard` + `@Roles(UserRole.ADMIN | CLIENT)`.
- **Seguridad:** el servidor se niega a arrancar sin `JWT_SECRET` / `JWT_REFRESH_SECRET` en producción (sin valores por defecto inseguros). El auto-registro siempre es `CLIENT` — el `role` nunca se acepta desde el cliente.
- **Clientes:** la web guarda los tokens en `localStorage`; el mobile los guarda en `AsyncStorage` y envía `Authorization: Bearer`. Ver `SECURITY.md` para la migración pendiente a cookies httpOnly.

---

## 5. Frontend (web) / Frontend (web)

**EN —** Next.js App Router under `frontend/src/app/`. Key areas:

- Public: `/` (home), `/events`, `/events/[slug]` (detail + purchase), `/login`, `/register`, `/verify/[code]` (gate verification), legal pages.
- Authenticated: `/dashboard` (my tickets), `/orders`, `/checkout/*`.
- Organizer: `/organizer`, `/organizer/events/[id]` (the full event editor with 7 tabs).
- Admin: `/admin/*` (users, events, categories, marketing, special-codes, analytics).
- API helper: `frontend/src/lib/api.ts` (axios instance + token interceptor). Error messages: `frontend/src/lib/apiError.ts` (friendly 429 / network / server messages).
- State: `frontend/src/stores/auth.ts` (Zustand). i18n: `frontend/src/context/LanguageContext.tsx`.

**ES —** App Router de Next.js bajo `frontend/src/app/`. Áreas clave:

- Público: `/` (inicio), `/events`, `/events/[slug]` (detalle + compra), `/login`, `/register`, `/verify/[code]` (verificación en puerta), páginas legales.
- Autenticado: `/dashboard` (mis tickets), `/orders`, `/checkout/*`.
- Organizador: `/organizer`, `/organizer/events/[id]` (el editor completo de evento con 7 pestañas).
- Admin: `/admin/*` (usuarios, eventos, categorías, marketing, códigos especiales, analítica).
- Helper de API: `frontend/src/lib/api.ts` (instancia de axios + interceptor de token). Mensajes de error: `frontend/src/lib/apiError.ts` (mensajes amigables de 429 / red / servidor).
- Estado: `frontend/src/stores/auth.ts` (Zustand). i18n: `frontend/src/context/LanguageContext.tsx`.

---

## 6. Mobile / Mobile

**EN —** React Native + Expo. Screens live in `mobile/src/screens/`, reusable UI in `mobile/src/components/`, and API access in `mobile/src/services/`:

- `services/api.ts` — fetch wrapper with token injection, refresh-on-401, retries, and `ApiError` (carries HTTP status + `retryAfter`).
- `services/auth.ts` — login/register/profile + token persistence in `AsyncStorage`.
- `services/biometricAuth.ts` — Face ID / fingerprint login via the stored refresh token.
- `services/doorSales.ts`, `tapToPay.ts` — in-person door sales (Stripe Terminal / Tap to Pay).
- Key screens: `HomeScreen`, `EventDetailScreen`, `PurchaseScreen`, `TicketsScreen`, `ScanScreen`, `OrganizerPanelScreen`, `AdminPanelScreen`, `ProfileScreen`.

**ES —** React Native + Expo. Las pantallas viven en `mobile/src/screens/`, la UI reutilizable en `mobile/src/components/` y el acceso a la API en `mobile/src/services/`:

- `services/api.ts` — envoltura de fetch con inyección de token, refresco ante 401, reintentos y `ApiError` (lleva el status HTTP + `retryAfter`).
- `services/auth.ts` — login/registro/perfil + persistencia de tokens en `AsyncStorage`.
- `services/biometricAuth.ts` — inicio de sesión con Face ID / huella usando el refresh token guardado.
- `services/doorSales.ts`, `tapToPay.ts` — ventas presenciales en puerta (Stripe Terminal / Tap to Pay).
- Pantallas clave: `HomeScreen`, `EventDetailScreen`, `PurchaseScreen`, `TicketsScreen`, `ScanScreen`, `OrganizerPanelScreen`, `AdminPanelScreen`, `ProfileScreen`.

---

## 7. Running locally / Ejecución local

**EN —**
```bash
# Backend (needs PostgreSQL + a .env, see backend/.env.example)
cd backend && npm install && npm run start:dev      # http://localhost:3001/api

# Frontend
cd frontend && npm install && npm run dev            # http://localhost:3000

# Mobile (Expo)
cd mobile && npm install && npx expo start
# Point the app at a local API with EXPO_PUBLIC_API_URL=http://<your-ip>:3001/api
```

**ES —**
```bash
# Backend (requiere PostgreSQL + un .env, ver backend/.env.example)
cd backend && npm install && npm run start:dev      # http://localhost:3001/api

# Frontend
cd frontend && npm install && npm run dev            # http://localhost:3000

# Mobile (Expo)
cd mobile && npm install && npx expo start
# Apunta la app a una API local con EXPO_PUBLIC_API_URL=http://<tu-ip>:3001/api
```

---

## 8. Environment variables / Variables de entorno

**EN —** See `backend/.env.example` for the full list. Required in production: `JWT_SECRET`, `JWT_REFRESH_SECRET`, database connection (`DATABASE_URL` or `DB_*`), and Stripe keys. Optional hardening: `SESSION_SECRET`, `SESSION_SALT`, `CORS_ORIGINS`. Frontend uses `NEXT_PUBLIC_API_URL`; mobile uses `EXPO_PUBLIC_API_URL`.

**ES —** Ver `backend/.env.example` para la lista completa. Requeridas en producción: `JWT_SECRET`, `JWT_REFRESH_SECRET`, conexión a la base de datos (`DATABASE_URL` o `DB_*`) y claves de Stripe. Endurecimiento opcional: `SESSION_SECRET`, `SESSION_SALT`, `CORS_ORIGINS`. El frontend usa `NEXT_PUBLIC_API_URL`; el mobile usa `EXPO_PUBLIC_API_URL`.

---

## 9. Related docs / Documentos relacionados

- `SECURITY.md` — security hardening done and the deferred httpOnly-cookie migration. / Endurecimiento de seguridad realizado y la migración pendiente a cookies httpOnly.
- `backend/.env.example` — annotated environment variables. / Variables de entorno anotadas.
