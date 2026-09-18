# LPTicket - Estado del Proyecto

Última revisión documental: 2026-09-17
Fuente: revisión de código local, pruebas automatizadas y builds locales.
Estado de servicios externos y producción: `NO COMPROBADO` salvo prueba explícita.

## Correo y recibo de entradas de cortesía — 2026-09-17

Estado: `IMPLEMENTADO Y COMPROBADO LOCALMENTE`; recepción SMTP real pendiente.

- La causa del diseño roto al enviar varias entradas era HTML inválido: cada tarjeta cerraba `body` y `html`, por lo que la segunda entrada quedaba fuera del documento principal y algunos clientes de correo la cortaban o deformaban.
- La plantilla compartida de tickets conserva ahora un solo documento HTML para cualquier cantidad. Las cortesías reutilizan exactamente esa plantilla, muestran el nombre del invitado y distinguen `Cortesía`, `Prensa`, `Sponsor` o `Staff` en asunto, encabezado y cada entrada.
- La revisión visual con correos reales detectó que Gmail exponía los QR embebidos como adjuntos y no respetaba de forma consistente el margen entre contenedores `div`. Cada entrada usa ahora una tarjeta de tabla compatible con correo, sombra y separación fija; el QR se carga una sola vez dentro de su tarjeta y no se adjunta otra copia. En cortesías también se omite el resumen general de `$0.00` que se mostraba como un bloque blanco vacío, sin quitar el resumen individual de cada entrada.
- El recibo por orden y la entrada digital individual muestran la misma clasificación y conservan el nombre del invitado. El reenvío también recupera esos datos desde la orden.
- No cambia la emisión de QR, capacidad, asientos, pagos, Stripe, permisos, base de datos ni aplicaciones móviles.
- Comprobación: 43 pruebas de correo y órdenes aprobadas, incluidos dos tickets separados, sin adjuntos QR y dentro de un solo HTML; build de backend y build de frontend aprobados. Falta emitir y recibir una cortesía nueva en producción para confirmar el render final en Gmail y Apple Mail.

## Protección contra correos de entradas duplicados — 2026-09-16

Estado: `IMPLEMENTADO Y COMPROBADO LOCALMENTE`; prueba SMTP controlada pendiente.

- La compra investigada corresponde a una sola orden pagada con cinco entradas; no hubo cinco cobros, cinco órdenes ni entradas duplicadas.
- El reenvío estaba presentado por entrada, pero cada acción enviaba nuevamente todas las entradas vigentes de la orden. No existía una reserva atómica del envío, por lo que varios clics o solicitudes concurrentes podían generar copias idénticas y sus BCC operativos.
- El backend ahora reserva cada envío por orden y destinatario bajo bloqueo de base de datos, registra `pending`, `sent` o `failed` en el historial enmascarado existente y descarta repeticiones inmediatas. Web y móvil informan cuando una repetición fue detenida. Los reenvíos manuales van únicamente al destinatario solicitado; la copia operativa queda reservada al envío inicial que ya la incluya.
- No cambia Stripe, el pago, la orden, los cinco tickets, sus QR ni el inventario. No se añadieron columnas ni se ejecutaron migraciones.
- Comprobación: 40 pruebas de órdenes aprobadas, incluida una simulación de cinco solicitudes simultáneas que produjo un solo correo; build de backend, build web, TypeScript móvil y `git diff --check` aprobados. La entrega real del proveedor SMTP permanece sin comprobar.

## Saldo del organizador — 2026-09-15

Estado: `PARCIALMENTE IMPLEMENTADO` en distribución. Commit `a54615aa` publicado en `main`; web pública comprobada y validación autenticada pendiente.

- El panel del organizador muestra `Venta de entradas`, `Pagos registrados` y `Pendiente por pagar`; ya no presenta el cálculo incorrecto que restaba la comisión estándar de Stripe a la venta base.
- Los pagos son los registros administrativos existentes en `organizer_payouts`. El pendiente se calcula como venta base menos ajustes aplicables y pagos registrados, igual que en administración.
- El registro de un pago externo invalida las cachés financieras para reflejar el nuevo saldo inmediatamente. No envía dinero ni altera Stripe, órdenes o tickets.
- Comprobación: 39 pruebas de órdenes, build de backend, build de frontend y TypeScript móvil aprobados. La web pública ya contiene `Estado de pagos`, `Pagos registrados` y `Pendiente por pagar`; falta comparar sus valores con una cuenta real.

## Entradas de cortesía web — 2026-09-15

Estado: `PARCIALMENTE IMPLEMENTADO` en distribución. Código publicado y componentes web públicos comprobados; emisión real pendiente.

- El organizador dispone de `Entradas de cortesía` dentro de cada evento, con flujo para entrada general por cantidad o selección de sillas/mesas.
- Cada entrega permite clasificar la cortesía, añadir una nota, confirmar el destinatario y emitir QR activos por `$0.00`. Las generales descuentan capacidad de forma transaccional; las ubicaciones asignadas conservan el bloqueo permanente.
- Las órdenes se identifican como `complimentary`, no generan ingresos y quedan disponibles en el historial. El backend conserva la verificación de propiedad del evento y limita cada emisión general a 100 entradas.
- La web pública contiene `Entradas de cortesía` y `Nueva cortesía general`. Falta emitir una cortesía controlada con una cuenta autenticada y confirmar recepción del correo, QR, capacidad e historial.

## Ingreso por comprador y confirmación Tap to Pay — 2026-09-15

Estado: `PARCIALMENTE IMPLEMENTADO` en distribución. Código publicado en `main` (`ee6312eb`, versión móvil `4ef45e07`); backend activo en Railway y búsqueda nueva visible en la web. Entrega móvil y prueba física pendientes.

- Web y móvil incorporan `Escanear QR / Buscar comprador`, disponibles reales, `Registrar 1 ingreso` para entradas generales equivalentes, selección individual para sillas/tipos distintos y acceso al historial. Mantienen al comprador abierto y refrescan las búsquedas cada cinco segundos mientras se consultan. La API protege cada ingreso con el cambio condicional `active → used` y guarda empleado, fecha y método en el mismo cambio.
- La búsqueda primero identifica compradores y luego carga sus entradas completas del evento; no calcula un saldo parcial a partir de un código o de un límite de 200 tickets. Excluye anuladas/revocadas de los disponibles y enmascara el correo mostrado.
- Tap to Pay solo permite la señal `Pago confirmado · Puede ingresar` después de recibir `succeeded` del servidor y comprobar todas las entradas. Conserva referencias de la compra pendiente por operador, incluso tras reiniciar, y permite verificar, reintentar el mismo PaymentIntent o cancelar con confirmación del servidor. Nunca reintenta automáticamente el cobro. La pantalla nativa de lectura sigue controlada por Stripe/Apple.
- La confirmación comprueba monto, moneda, orden y evento; verifica el resultado de captura y mantiene compatible el endpoint anterior. El envío de correo posterior de Tap to Pay ya no bloquea la respuesta de ingreso. Es una tarea de mejor esfuerzo en el proceso, no una cola persistente; falta probar entrega real y comportamiento ante reinicios del backend.
- Validación: pruebas unitarias backend y del servicio móvil con proveedores simulados; TypeScript móvil y builds. Prueba web con datos ficticios: 3 → 2 disponibles, comprador conservado, actualización en segunda puerta y escáner a 320/390/768/1440 px. Se observó desbordamiento preexistente de la barra global a 320 px, fuera de este cambio.
- PostgreSQL temporal: TypeORM generó exactamente tres `ADD` anulables; se conservaron 10 tickets históricos, búsqueda con/sin acentos y por código devolvió el saldo completo, dos validaciones simultáneas admitieron una sola vez y las revocadas se rechazaron.
- Publicación: GET de eventos y `/verify` devolvieron 200; la web muestra `Escanear QR / Buscar comprador`. Sin sesión vigente para comprobar la búsqueda de compradores reales; no se consumieron tickets ni se hicieron cobros de producción.
- Móvil `1.0.9`: el envío EAS del build 39 (`31877ad4-6099-4a88-9053-58eb6fd99263`) fue cancelado antes de comenzar. La misma fuente se regeneró y archivó localmente con Xcode como build 40, conservando el identificador oficial y el permiso de Tap to Pay. La carga directa a App Store Connect terminó correctamente y Apple muestra `1.0.9 (40)` en estado `Procesando` desde las 2:03 p. m. del 15 de septiembre. Android build 7 permanece en la cola gratuita (`04941266-f11d-4455-b0df-31cfeee8da8e`).
- Google Play conserva `1.0.8 (5)` en revisión con los mismos ocho países; no se retiró ese envío. Falta verificar en iPhone cobro confirmado, rechazo, desconexión, recuperación y latencia.

## Publicación Android

- `PARCIALMENTE IMPLEMENTADO`: el AAB Android `1.0.8` (`versionCode` 5) terminó correctamente en EAS y Google Play Console lo aceptó en la pista de producción de LP Ticket (`com.inhoustontexas.lpticket`). El paquete declara Android API 26+ y SDK de destino 36.
- Se seleccionaron exactamente Venezuela, Colombia, Panamá, México, Argentina, Chile, Perú y Estados Unidos. Con autorización explícita del propietario se enviaron a revisión de Google Play dos cambios: lanzamiento completo de `1.0.8 (5)` y disponibilidad en esos ocho países. Play Console los muestra en la etapa de revisión mientras ejecuta verificaciones rápidas; la publicación pública aún no está confirmada. La publicación administrada está desactivada, por lo que una aprobación puede publicarlos automáticamente.
- EAS no tiene una cuenta de servicio de Google Play configurada para envío automático. La carga del AAB se hizo manualmente desde Play Console. La advertencia sobre archivo de desofuscación no impidió aceptar el paquete.
- La configuración de envío en `mobile/eas.json` queda dirigida a la pista Android `production` para un futuro envío automatizado, una vez configurada la credencial; no modifica iOS, backend, pagos ni datos.

## Estado Git Actual

- Rama de trabajo: `codex/marketing-copy-refinement`.
- Klarna está habilitado en Stripe y el Checkout web publicado ya abre el flujo real de `Pagar en cuotas con Klarna`; la captura del proveedor confirma la selección del método, pero todavía no documenta una compra Klarna completada de extremo a extremo.
- El desglose nuevo de Klarna en dashboard y Analíticas está implementado. El error SQL que dejaba `/admin` vacío fue corregido y comprobado en producción. La nueva jerarquía cromática financiera está comprobada localmente y pendiente de revisión visual en producción.
- La API compartida de Analíticas tenía un segundo error SQL por usar `order`, palabra reservada de PostgreSQL, como alias en las consultas financieras. La corrección usa `ord`; web y móvil muestran ahora un error recuperable con `Reintentar` si la API falla. Comprobado localmente; pendiente publicación y validación en producción.

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
| Eventos públicos | IMPLEMENTADO, NO PROBADO | API, web y móvil consumen eventos publicados. En web móvil, el detalle público reúne fecha, hora y lugar en una sola superficie visual y conserva una acción de compartir compacta; pendiente revisión visual con eventos reales. |
| Creación y edición de eventos | IMPLEMENTADO, NO PROBADO | El organizador puede elegir durante la creación web entre mapa visual o entrada general. Entrada general reutiliza la sección standing existente, con nombre, precio y capacidad. El administrador dispone de `Crear evento para usuario`, selecciona un usuario activo y crea el evento en su panel sin perder el acceso administrativo. Cuando el organizador envía el borrador a aprobación, el backend avisa a `info@elpitique.com` (o `EVENT_APPROVAL_EMAIL` si está configurado) con enlace al panel administrativo; no se envía de nuevo por una solicitud repetida mientras siga pendiente. No cambia el esquema, pagos, Stripe, móvil ni eventos ya creados. Pendiente prueba SMTP real. |
| Categorías | IMPLEMENTADO | Administración y consumo público presentes. |
| Banners de inicio | IMPLEMENTADO | Marketing administra banners de web y móvil. |
| Mapas, secciones y asientos | IMPLEMENTADO, NO PROBADO | Editor web/móvil, entidades y endpoints presentes; el editor web permite seleccionar varias secciones y aplicar un precio al grupo o a una seleccionada antes de guardar. Las mesas rectangulares distribuyen automáticamente las sillas a ambos lados largos y ajustan su altura al añadir o retirar sillas, sin reemplazar ajustes manuales existentes. En móvil, tanto organizador como administrador reutilizan el visor estable del cliente y solo permiten bloquear o desbloquear mesas/asientos. La selección se activa explícitamente con `Seleccionar / Select`, admite varias sillas o mesas y conserva el encuadre al bloquear; sus asientos muestran `B` naranja cuando están bloqueados y `S` gris cuando están vendidos. Las métricas móviles incluyen también la capacidad configurada de las áreas generales sin sillas individuales, igual que la web. La vista del cliente no revela esa distinción. La edición de diseño permanece en la web de computadora. Pendiente prueba física. |
| Bloqueo y desbloqueo | IMPLEMENTADO, NO PROBADO | El backend sincroniza el inventario y la configuración visual del mapa en cada bloqueo o desbloqueo. Una cortesía de $0 mantiene el asiento bloqueado, incluso después de enviarse; solo un pago real usa el estado vendido. El mapa repara las cortesías históricas antes de responder e invalida la caché cuando corresponde; validar móvil-web-cliente en cada cambio sensible. |
| Compra de tickets | IMPLEMENTADO, NO PROBADO | Toda compra nueva usa la fórmula oficial única: servicio de 3.02% más $1.98 por entrada y procesamiento bruto de 2.9% más $0.30 por orden. El backend entrega el mismo desglose a web, móvil, Venta en Puerta y Tap to Pay; la estimación móvil y web solicitan la cotización vigente al backend, y la administración ya no permite configurarla por evento o sección. Pagos históricos, Stripe, base de datos y migraciones no se modifican; pendiente comparar manualmente una compra nueva de $40 en cada canal. |
| Tickets QR y validación | IMPLEMENTADO Y COMPROBADO LOCALMENTE | QR, escaneo, asistentes y estadísticas presentes. Desde el detalle de un asistente, el organizador o administrador puede revocar una, varias o todas sus entradas con motivo obligatorio. La operación marca permanentemente los tickets como `revoked`, registra la auditoría y libera o bloquea sus sillas dentro de una sola transacción. Un QR revocado responde `valid: false`, por lo que la aplicación móvil conserva su pantalla existente `DENEGADO` sin cambios ni nueva compilación. No se alteran órdenes, ventas, pagos ni reportes financieros. Pendiente validación manual y en producción. |
| Apple Wallet y Google Wallet | IMPLEMENTADO, NO PROBADO | Servicios y endpoints presentes; Apple Wallet conserva QR, usa el flyer como fondo y miniatura, y muestra evento, titular y venue; pendiente de prueba física. |
| Ventas en puerta | IMPLEMENTADO, NO PROBADO | Preview, checkout, facturación y tickets presentes; las entradas de Tap to Pay confirmado nacen usadas para contabilizar la admisión presencial. |
| Tap to Pay en iPhone | IMPLEMENTADO, NO PROBADO | Entitlement de Apple concedido y perfil renovado para el build iOS 30; pendiente prueba física con Stripe Terminal. |
| Entrega postventa por SMS/correo | IMPLEMENTADO, NO PROBADO | La entrega se solicita después de confirmar el pago; reutiliza Twilio/SMTP, registra un historial enmascarado, genera enlaces firmados únicamente para ventas Tap to Pay y prepara una copia operativa única para LPTicket. |
| Métodos de pago | IMPLEMENTADO, PARCIALMENTE COMPROBADO EN STRIPE REAL | El Checkout web presenta acciones separadas para tarjeta y `Pagar en cuotas con Klarna` en monedas compatibles. La acción ya abrió correctamente el Checkout real de Klarna y mostró las cuotas determinadas por el proveedor. Una solicitud explícita de Klarna nunca cambia silenciosamente a tarjeta; las opciones finales dependen de elegibilidad y aprobación. Las entradas solo se emiten cuando Stripe confirma el pago. Móvil, Tap to Pay y Venta en Puerta permanecen en sus flujos anteriores. Falta documentar una compra Klarna completada de extremo a extremo. |
| Social Match y chat | IMPLEMENTADO, NO PROBADO | Intereses traducidos, sugerencias solo entre asistentes activos con intereses compartidos, conexiones, descartes y mensajes presentes; pendiente de prueba móvil. |
| Escáner de empleados | IMPLEMENTADO Y COMPROBADO LOCALMENTE | Solicitudes, aprobación, rechazo, revocación, búsqueda y validación presentes. El administrador cuenta con el acceso directo `Empleados de eventos`, puede buscar cualquier usuario activo y evento publicado, crear una solicitud pendiente para esa persona y decidirla desde el mismo panel. La operación solo modifica `scanner_access`: no edita el evento, mapa, inventario, entradas, ventas ni pagos. |
| Panel organizador | IMPLEMENTADO Y COMPROBADO LOCALMENTE | Eventos, asistentes, analítica, bloques, comisiones y escaneo presentes. El detalle del asistente permite seleccionar entradas y confirmar su revocación irreversible, mostrando `REVOCADO` y deshabilitando su reenvío. |
| Panel administrador | IMPLEMENTADO, NO PROBADO | Usuarios, eventos, facturas, marketing, categorías y analítica presentes. Incluye el flujo `Empleados de eventos` para seleccionar un usuario y un evento de cualquier organizador, crear su solicitud de scan, aprobarla, rechazarla o revocarla y abrir la gestión del evento. Este flujo no suplanta sesiones ni edita el evento. El dashboard y Analíticas muestran compras Klarna, compradores recientes, total cobrado, ajuste adicional del organizador y conciliaciones pendientes. Los alias SQL reservados de `/api/admin/stats` y `/api/analytics/summary` fueron corregidos; el segundo está comprobado localmente y pendiente de publicación. Web y móvil ya no ocultan una falla de Analíticas: muestran un mensaje y permiten reintentar. Localmente, el desglose financiero usa superficies oscuras translúcidas y colores semánticos: Stripe morado, ganancia LPTicket verde, Klarna rojo/rosa, ajuste Klarna ámbar y pendiente rojo. Pendiente comprobar visualmente estas funciones en producción. |
| Auditoría de pagos al organizador | IMPLEMENTADO, NO PROBADO EN PRODUCCIÓN | En el detalle administrativo de cada evento, el administrador puede registrar pagos externos parciales o totales al organizador, ver el acumulado pagado, el saldo pendiente y el historial. Para una orden Klarna, el backend descuenta solo la diferencia positiva entre el costo real informado por Stripe y la base estándar de 2.9% + $0.30. El saldo exacto es venta nominal de entradas menos ese ajuste y menos pagos registrados. Cualquier orden Klarna todavía no conciliada protege el registro del pago al organizador sin detener la venta ni la emisión de entradas. Es una conciliación interna: no crea transferencias. |
| Marketing email, SMS, WhatsApp y push | IMPLEMENTADO, NO PROBADO | Las campañas nuevas usan Zoho Campaigns, no el SMTP normal de Zoho Mail. Antes de `sendcampaign`, el backend verifica la lista privada y el Topic. La preparación valida solo la sintaxis, conserva dominios privados válidos y aísla los rechazos individuales, incluido el código `2007` de `listsubscribe`: un correo rechazado queda fallido con su motivo sin detener a los destinatarios aceptados. Reutiliza listas cuando corresponde y el access token durante su vigencia. La audiencia queda serializada y limitada a 450 suscripciones por minuto para admitir campañas de 500 contactos sin alcanzar el límite de Zoho. El detalle seleccionado consulta los reportes oficiales y concilia aperturas, rebotes permanentes/temporales y correos no enviados cada dos minutos como máximo. La autorización OAuth cifra su refresh token en PostgreSQL; los secretos permanecen en Railway. El panel mantiene hasta 50 campañas y permite abrir o eliminar su análisis. El envío real de 17 destinatarios quedó comprobado; falta comprobar en producción el aislamiento de rechazados, la actualización posterior de aperturas/rebotes y una campaña de audiencia mayor. |
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
