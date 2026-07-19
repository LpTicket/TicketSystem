# LPTicket - Estado del Proyecto

Última revisión documental: 2026-07-19
Fuente: revisión de código local.
Estado de servicios externos y producción: `NO COMPROBADO` salvo prueba explícita.

## Estado Git Actual

- Rama actual: `codex-unify-lpticket`.
- Último commit visible: `7330f341 feat(mobile): complete Tap to Pay onboarding flow`.
- Cambio local sin commit detectado:
  - `/Users/sundingalue/Documents/TicketSystem/mobile/src/screens/DoorSaleScreen.tsx`

No se debe asumir que ese cambio local está probado, subido o desplegado.

## Arquitectura Confirmada

- Backend: `/Users/sundingalue/Documents/TicketSystem/backend`
- Frontend: `/Users/sundingalue/Documents/TicketSystem/frontend`
- Móvil: `/Users/sundingalue/Documents/TicketSystem/mobile`

El backend es la fuente de verdad para eventos, mapas, asientos, bloqueos, órdenes, tickets, usuarios y permisos.

## Funcionalidades

| Área | Estado | Evidencia |
| --- | --- | --- |
| Registro, login y JWT | IMPLEMENTADO | Backend y clientes contienen autenticación, refresh y perfil. |
| Google, Facebook y Apple Sign In | IMPLEMENTADO, NO PROBADO | Rutas y configuración presentes; proveedor externo no verificado. |
| Eventos públicos | IMPLEMENTADO | API, web y móvil consumen eventos publicados. |
| Creación y edición de eventos | IMPLEMENTADO | Panel organizador, API y entidades presentes. |
| Categorías | IMPLEMENTADO | Administración y consumo público presentes. |
| Banners de inicio | IMPLEMENTADO | Marketing administra banners de web y móvil. |
| Mapas, secciones y asientos | IMPLEMENTADO | Editor web/móvil, entidades y endpoints presentes. |
| Bloqueo y desbloqueo | IMPLEMENTADO, NO PROBADO | Endpoint e invalidación de caché presentes; validar móvil-web-cliente en cada cambio sensible. |
| Compra de tickets | IMPLEMENTADO | Stripe Checkout y emisión de tickets presentes. |
| Tickets QR y validación | IMPLEMENTADO | QR, escaneo, asistentes y estadísticas presentes. |
| Apple Wallet y Google Wallet | IMPLEMENTADO, NO PROBADO | Servicios y endpoints presentes; dependen de credenciales externas. |
| Ventas en puerta | IMPLEMENTADO | Preview, checkout, facturación y tickets presentes. |
| Tap to Pay en iPhone | IMPLEMENTADO, NO PROBADO | Código nativo y backend presentes; depende de Apple, Stripe y pruebas físicas. |
| Métodos de pago | IMPLEMENTADO | Módulo de pagos presente. |
| Social Match y chat | IMPLEMENTADO | Preferencias, sugerencias, conexiones, descartes y mensajes presentes. |
| Escáner de empleados | IMPLEMENTADO | Solicitudes, aprobación, búsqueda y validación presentes. |
| Panel organizador | IMPLEMENTADO | Eventos, asistentes, analítica, bloques, comisiones y escaneo presentes. |
| Panel administrador | IMPLEMENTADO | Usuarios, eventos, facturas, marketing, categorías y analítica presentes. |
| Marketing email, SMS, WhatsApp y push | IMPLEMENTADO, NO PROBADO | Código presente; entrega depende de proveedores externos. |
| Asistente AI | IMPLEMENTADO, NO PROBADO | Servicio presente; requiere configuración externa. |
| Integración Square | NO ENCONTRADA | No se localizó un módulo de backend relacionado. |

## Rendimiento y Caché

Implementado:

- Caché breve para eventos públicos, destacados y detalle.
- Caché breve para mapas de asientos.
- Caché breve para panel organizador y administrador.
- Caché breve para Social Match.
- Invalidación de caché después de cambios relevantes.
- Reintentos GET en móvil.

Riesgos:

- La caché parece depender del proceso del backend.
- Un reinicio del backend vacía la caché.
- Reintentos móviles pueden aumentar el tiempo visible de una falla de red.
- Los datos de mapas y disponibilidad requieren invalidación correcta.

## Seguridad

Implementado:

- JWT de acceso y refresh.
- Validación global de DTOs.
- CORS configurable.
- Rate limiting.
- Helmet.
- Guards de autenticación y roles.
- Validaciones de propiedad en recursos sensibles.
- Filtro global de errores.

Pendientes conocidos:

- La web guarda tokens en `localStorage`.
- La migración futura a cookies `httpOnly` está documentada en `/Users/sundingalue/Documents/TicketSystem/SECURITY.md`.
- No se encontraron migraciones TypeORM versionadas.
- TypeORM usa `synchronize: true`.

## Datos y Archivos

Entidades principales: usuarios, eventos, secciones, asientos, órdenes, tickets, categorías, métodos de pago, plantillas de mapas, marketing, tokens push, Social Match, códigos especiales, pagos, accesos de escáner y analítica.

Las imágenes nuevas se almacenan como Base64 en la base de datos.

## Tap to Pay

Implementado en código:

- Capacidad iOS.
- Plugin de educación.
- Puente Stripe Terminal.
- Términos y configuración.
- Conexión Tap to Pay.
- Payment Intent presencial.
- Confirmación de pago.
- Emisión de tickets y comprobante.

Pendiente externo:

- Aprobación Apple.
- Configuración Stripe Terminal.
- Ubicación de Stripe Terminal.
- Prueba real en dispositivo autorizado.
- Validación completa desde una compilación nativa.

## Cobertura de Pruebas

Comandos disponibles:

```bash
cd /Users/sundingalue/Documents/TicketSystem/backend
npm run test
npm run test:e2e

cd /Users/sundingalue/Documents/TicketSystem/mobile
npx tsc --noEmit

cd /Users/sundingalue/Documents/TicketSystem/frontend
npm run build

cd /Users/sundingalue/Documents/TicketSystem/backend
npm run build
```

Limitación actual: la prueba E2E localizada parece inicial y no cubre flujos críticos de negocio.

## Próximos Objetivos

1. Validar completamente Tap to Pay en dispositivo físico autorizado.
2. Mantener estable la sincronización de mapas, bloques y disponibilidad entre móvil, web y clientes.
3. Crear migraciones versionadas antes de cambios futuros de base de datos.
4. Ampliar pruebas reales para pagos, tickets, asientos, permisos y escaneo.
5. Evaluar almacenamiento externo seguro para imágenes pesadas.
6. Revisar estrategia de caché si el backend usa múltiples instancias.
7. Mantener documentación actualizada después de cada tarea importante.
