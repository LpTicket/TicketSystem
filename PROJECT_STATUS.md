# LPTicket - Estado del Proyecto

Última revisión documental: 2026-07-31
Fuente: revisión de código local y respuesta de Apple Tap to Pay.
Estado de servicios externos y producción: `NO COMPROBADO` salvo prueba explícita.

## Estado Git Actual

- Rama actual: `codex-unify-lpticket`, iniciada sobre `origin/main` en `0a134e1c` antes de este cambio.
- Hay cambios locales sin commit para crear una copia operativa única después de cada venta Tap to Pay.
- No se debe asumir que este envío interno está desplegado ni probado con SMTP real hasta completar la publicación y la prueba física.

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
| Mapas, secciones y asientos | IMPLEMENTADO | Editor web/móvil, entidades y endpoints presentes; el editor web permite seleccionar varias secciones y aplicar un precio al grupo o a una seleccionada antes de guardar. |
| Bloqueo y desbloqueo | IMPLEMENTADO, NO PROBADO | Endpoint e invalidación de caché presentes; validar móvil-web-cliente en cada cambio sensible. |
| Compra de tickets | IMPLEMENTADO | Stripe Checkout y emisión de tickets presentes. |
| Tickets QR y validación | IMPLEMENTADO | QR, escaneo, asistentes y estadísticas presentes. |
| Apple Wallet y Google Wallet | IMPLEMENTADO, NO PROBADO | Servicios y endpoints presentes; Apple Wallet conserva QR, usa el flyer como fondo y miniatura, y muestra evento, titular y venue; pendiente de prueba física. |
| Ventas en puerta | IMPLEMENTADO, NO PROBADO | Preview, checkout, facturación y tickets presentes; las entradas de Tap to Pay confirmado nacen usadas para contabilizar la admisión presencial. |
| Tap to Pay en iPhone | IMPLEMENTADO, NO PROBADO | Entitlement de Apple concedido y perfil renovado para el build iOS 30; pendiente prueba física con Stripe Terminal. |
| Entrega postventa por SMS/correo | IMPLEMENTADO, NO PROBADO | La entrega se solicita después de confirmar el pago; reutiliza Twilio/SMTP, registra un historial enmascarado, genera enlaces firmados únicamente para ventas Tap to Pay y prepara una copia operativa única para LPTicket. |
| Métodos de pago | IMPLEMENTADO | Compra online mediante Stripe Checkout; no se añadió un módulo nativo adicional. |
| Social Match y chat | IMPLEMENTADO, NO PROBADO | Intereses traducidos, sugerencias solo entre asistentes activos con intereses compartidos, conexiones, descartes y mensajes presentes; pendiente de prueba móvil. |
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

- Entitlement de Apple: CONCEDIDO; compilación iOS 30 finalizada en EAS, pendiente de instalación y prueba física.
- Apple solicitó verificar en compilación nativa el icono SF Symbol oficial y el texto exacto `Tap to Pay on iPhone` antes de reenviar grabaciones.
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

1. Validar en dispositivo físico el flujo completo Tap to Pay → emisión única → SMS/correo opcional → regreso al escáner.
2. Mantener estable la sincronización de mapas, bloques y disponibilidad entre móvil, web y clientes.
3. Crear migraciones versionadas antes de cambios futuros de base de datos.
4. Ampliar pruebas reales para pagos, tickets, asientos, permisos y escaneo.
5. Evaluar almacenamiento externo seguro para imágenes pesadas.
6. Revisar estrategia de caché si el backend usa múltiples instancias.
7. Mantener documentación actualizada después de cada tarea importante.
