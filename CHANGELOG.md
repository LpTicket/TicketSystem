# LPTicket - Historial de Cambios

## 2026-08-21 - Historial de boletos en el perfil administrativo

### Corrección
- Al abrir un usuario en `Administración > Usuarios`, el historial ahora consume la lista de boletos real devuelta por el backend.
- El panel ya no interpreta el objeto de respuesta completo como si fuera una lista vacía, por lo que muestra los boletos comprados por la cuenta seleccionada.

### Áreas protegidas
- No se modificaron órdenes, tickets, compras, usuarios, pagos, permisos ni base de datos.

### Estado
- IMPLEMENTADO, NO PROBADO

### Pendiente manual
- Abrir el perfil de un cliente con compras existentes y confirmar que se vean sus boletos, evento, asiento, precio y estado.

## 2026-08-21 - Búsqueda administrativa de usuarios en todos los registros

### Corrección
- El buscador de `Administración > Usuarios` dejó de filtrar solo los 20 usuarios visibles en pantalla.
- Ahora consulta el backend por nombre, apellido, usuario o correo dentro de todos los usuarios registrados y conserva el filtro por rol.
- Los contadores y la paginación muestran el total real de coincidencias, incluido el total de 206 usuarios cuando no hay filtros.

### Áreas protegidas
- No se modificaron usuarios, roles, permisos, cuentas, pagos, tickets ni base de datos.

### Estado
- IMPLEMENTADO, NO PROBADO

### Pendiente manual
- Buscar un usuario que no esté en la primera página y comprobar que aparezca; luego confirmar que `Todos` sin búsqueda muestre el total completo.

## 2026-08-13 - Aviso administrativo de eventos pendientes

### Corrección
- Cuando un organizador envía un evento a aprobación, el backend envía un correo diseñado con la identidad actual de LPTicket a `info@elpitique.com`.
- El correo muestra organizador, fecha, lugar y categoría, e incluye un enlace directo a `Administración > Eventos` para revisarlo y aprobarlo.
- Un reintento de envío mientras el evento ya está `pendiente de aprobación` no genera un correo duplicado.

### Áreas protegidas
- No se modificaron el flujo de aprobación, Stripe, pagos, órdenes, tickets, base de datos, migraciones, móvil ni eventos existentes.

### Estado
- IMPLEMENTADO, NO PROBADO

### Pendiente manual
- Publicar el backend con SMTP configurado, enviar un evento nuevo a revisión y confirmar la recepción en `info@elpitique.com` y la apertura del enlace administrativo.

## 2026-08-12 - Cotización móvil confirmada por backend y preparación 1.0.8

### Corrección
- La compra normal desde un evento móvil ya no calcula los fees en el dispositivo: solicita una cotización nueva al backend para cada selección de asientos o entradas generales.
- El botón de compra espera esa cotización y la creación final de Checkout vuelve a validarla en servidor.
- Se preparó iOS `1.0.8` build `31`, alineado con la numeración remota administrada por EAS.

### Áreas protegidas
- No se modificaron Stripe, órdenes, tickets, ventas existentes, base de datos, migraciones ni Tap to Pay.

### Estado
- IMPLEMENTADO, NO PROBADO

### Pendiente manual
- Crear e instalar la compilación iOS 1.0.8 (31) y probar una compra nueva de $40: servicio `$3.19`, procesamiento `$1.60`, total `$44.79`.

## 2026-08-12 - Tarifas globales fijas en todos los canales

### Corrección
- La estimación visible antes del checkout web ahora usa exactamente la fórmula global del backend: servicio de `3.02% + $1.98` por entrada y procesamiento bruto de `2.9% + $0.30` una vez por orden.
- La administración web y móvil informa la política fija en vez de permitir una configuración por evento o sección que no afecta las compras.
- Las rutas administrativas de modificación rechazan cambios para impedir que valores personalizados vuelvan a guardarse como si afectaran el cobro.

### Áreas protegidas
- No se recalcularon ni modificaron órdenes, tickets, ventas existentes, Stripe, base de datos, migraciones ni la emisión de tickets.

### Estado
- IMPLEMENTADO, NO PROBADO

### Pruebas automatizadas
```bash
cd /Users/sundingalue/Documents/TicketSystem/backend
npx jest --runInBand --no-watchman src/orders/orders.service.spec.ts
npx tsc --noEmit -p tsconfig.build.json

cd /Users/sundingalue/Documents/TicketSystem/frontend
npm run build

cd /Users/sundingalue/Documents/TicketSystem/mobile
npx tsc --noEmit
```

### Pendiente manual
- En web, móvil, Venta en Puerta y Tap to Pay, probar una entrada nueva de `$40.00`: servicio `$3.19`, procesamiento `$1.60`, total `$44.79`.
- Para dos entradas nuevas de `$40.00`: servicio `$6.38`, procesamiento `$2.89`, total `$89.27`; no se debe crear ni emitir una venta duplicada.

## 2026-08-12 - Cotización web siempre actualizada

### Corrección
- El resumen antes de pagar en la web solicita una cotización nueva al backend en cada intento.
- La ruta pública de previsualización ya responde con cabeceras que impiden reutilizar un cálculo antiguo desde caché del navegador o de un intermediario.

### Áreas protegidas
- No se modificaron Stripe, pagos existentes, órdenes, tickets, base de datos ni migraciones.

### Estado
- IMPLEMENTADO, NO PROBADO

### Pendiente manual
- Con una entrada nueva de $40 en la web, confirmar antes de pagar: servicio `$3.19`, procesamiento `$1.60` y total `$44.79`.

## 2026-08-12 - Fórmula oficial única para compras de entradas

### Corrección
- Toda compra nueva usa la fórmula oficial: cargo de servicio de `3.02% + $1.98 por entrada` y procesamiento bruto de `2.9% + $0.30 por orden`.
- Web, compra móvil, Venta en Puerta y Tap to Pay usan el mismo cálculo desde el backend; las pantallas móviles reflejan el mismo desglose antes de cobrar.

### Áreas protegidas
- No se modificaron Stripe, credenciales, pagos existentes, órdenes históricas, tickets, base de datos ni migraciones.

### Estado
- IMPLEMENTADO, NO PROBADO

### Pruebas ejecutadas
```bash
cd /Users/sundingalue/Documents/TicketSystem/backend
npx jest --runInBand --no-watchman src/orders/orders.service.spec.ts
npx tsc --noEmit -p tsconfig.build.json
```

### Pendiente manual
- Con una entrada de $40, confirmar antes de pagar en web, móvil y Tap to Pay: servicio `$3.19`, procesamiento `$1.60` y total `$44.79`.

## 2026-08-11 - Conciliación interna de pagos al organizador

### Funcionalidad desarrollada
- El detalle financiero exclusivo de administración incorpora un bloque de `Pagos al organizador`.
- El administrador puede registrar un pago externo parcial o total, con nota o referencia opcional.
- El panel muestra el monto correspondiente al organizador, el total registrado como pagado y el saldo pendiente, junto con un historial de fecha y administrador que registró cada movimiento.
- El backend rechaza registros superiores al saldo pendiente del evento para evitar sobrepagos en esta auditoría.

### Áreas protegidas
- No se crea ninguna transferencia real ni se modifican Stripe, checkout, órdenes, tickets, cargos, comisiones existentes o la app móvil.
- Los pagos registrados son únicamente una conciliación administrativa interna en `organizer_payouts`.

### Estado
- IMPLEMENTADO, NO PROBADO

### Pruebas ejecutadas
```bash
cd /Users/sundingalue/Documents/TicketSystem/backend
npm run build

cd /Users/sundingalue/Documents/TicketSystem/frontend
npm run build
```

### Pendiente manual
- Como administrador, abrir la auditoría financiera de un evento, registrar un pago parcial y confirmar que se actualizan el saldo y el historial sin cambiar ninguna orden o ticket.

## 2026-08-11 - Creación de eventos para usuarios desde administración

### Funcionalidad desarrollada
- El panel de administración incorpora `Crear evento para usuario` inmediatamente debajo de `Eventos`.
- El administrador puede buscar y seleccionar un usuario activo en una lista con ocho filas visibles y desplazamiento para el resto.
- El formulario reutiliza la creación web existente y asigna el evento al usuario seleccionado mediante una ruta protegida solo para administradores.
- Se corrigió el selector de `Mapa visual` / `Entrada general` para conservar el contraste oscuro, naranja y blanco propio de LPTicket.

### Áreas protegidas
- No se modificaron entidades, migraciones, datos existentes, Stripe, checkout, cargos ni app móvil.

### Estado
- IMPLEMENTADO, NO PROBADO

### Pruebas ejecutadas
```bash
cd /Users/sundingalue/Documents/TicketSystem/backend
npm run build

cd /Users/sundingalue/Documents/TicketSystem/frontend
npm run build
```

### Pendiente manual
- Como administrador, abrir `Crear evento para usuario`, seleccionar un usuario, crear un evento y confirmar que aparece en el panel de ese usuario y en el panel administrador.

## 2026-08-11 - Entrada general sin mapa visual en creación web

### Funcionalidad desarrollada
- La creación de eventos desde el panel organizador web permite elegir entre `Mapa visual` y `Entrada general`.
- Para entrada general se solicita nombre, precio y capacidad, y se crea una sección standing mediante el endpoint existente de secciones.
- El segundo paso muestra un resumen de la entrada general en lugar del diseñador de mesas.

### Áreas protegidas
- No se modificaron entidades, migraciones, base de datos existente, Stripe, checkout, cargos, app móvil ni eventos ya creados.

### Estado
- IMPLEMENTADO, NO PROBADO

### Pruebas ejecutadas
```bash
cd /Users/sundingalue/Documents/TicketSystem/frontend
npm run build
```

### Pendiente manual
- Crear un evento de prueba con Entrada general desde la web y confirmar que aparece una sola entrada con el precio, capacidad y límite de compra elegidos.

## 2026-08-09 - Capacidad consistente entre web y mapa móvil

### Corrección
- Las métricas del mapa móvil de organizador y administrador ahora suman la capacidad de áreas generales/standing aunque no tengan sillas individuales.
- La capacidad, disponibilidad y ventas de estas áreas usan la misma regla que el editor web; no cambia ningún asiento, bloqueo, venta ni dato de evento.

### Estado
- IMPLEMENTADO, NO PROBADO

## 2026-08-09 - Estado visible de asientos en mapa móvil del organizador

### Corrección
- El mapa móvil de organizador y administrador ya diferencia visualmente los asientos bloqueados (`B` naranja) de los vendidos (`S` gris), igual que la vista de operación web.
- La vista del cliente no cambia: sus asientos no disponibles continúan sin revelar si fueron bloqueados o vendidos.

### Estado
- IMPLEMENTADO, NO PROBADO

## 2026-08-09 - Selección explícita en mapa móvil del organizador

### Corrección
- El mapa del organizador ya no selecciona una silla mientras se explora, se arrastra o se hace zoom.
- La acción `Seleccionar / Select` activa un modo específico para elegir una o varias sillas o mesas antes de bloquearlas o desbloquearlas.
- Después de bloquear, el mapa se actualiza sin desmontar el visor: conserva el zoom y la posición para continuar trabajando.

### Estado
- IMPLEMENTADO, NO PROBADO

## 2026-08-09 - Cortesías conservan el estado bloqueado

### Corrección
- Emitir una cortesía de $0 ya no marca la silla como vendida: la conserva como bloqueada, con su QR activo para el invitado.
- Se agregó una reparación segura para las cortesías históricas de $0 que quedaron como vendidas; solo cambia asientos con ticket activo/usado y orden pagada de total $0.
- El mapa ejecuta la reparación antes de usar su caché, para que web y móvil devuelvan el mismo conteo de bloqueadas.
- Se evita emitir por segunda vez una cortesía para la misma silla.

### Estado
- IMPLEMENTADO, NO PROBADO

## 2026-08-09 - Sincronización permanente de bloqueos de mapa

### Corrección
- Bloquear o desbloquear asientos ahora actualiza en la misma operación el inventario real y la configuración visual del mapa.
- Al abrir `Bloqueos e invitaciones`, web y móvil restauran una sola vez los bloqueos antiguos que quedaron guardados visualmente pero no llegaron al inventario.
- La restauración es unidireccional: solo bloquea asientos disponibles marcados como reservados; nunca desbloquea ni altera una entrada vendida.

### Estado
- IMPLEMENTADO, NO PROBADO

## Regla Obligatoria

Después de cada tarea importante, Codex debe agregar una entrada a este archivo.

Una tarea importante incluye nueva funcionalidad, corrección relevante, cambio de pago, tickets, mapas, permisos, seguridad, arquitectura, rendimiento, caché o integración externa.

No registrar secretos, contraseñas, tokens, claves API ni datos privados.

## Formato de Registro

```md
## YYYY-MM-DD - Título breve

### Funcionalidad desarrollada
- Descripción clara de la funcionalidad o corrección.

### Archivos modificados
- `/Users/sundingalue/Documents/TicketSystem/ruta/archivo.ext`

### Problema solucionado
- Explicación del problema real.

### Riesgos encontrados
- Riesgos técnicos, de seguridad, datos, pagos o producción.
- Usar `NINGUNO IDENTIFICADO` si no se encontró riesgo.

### Estado de pruebas
- `IMPLEMENTADO Y COMPROBADO`
- `IMPLEMENTADO, NO PROBADO`
- `PARCIALMENTE IMPLEMENTADO`
- `NO COMPROBADO`

### Pruebas ejecutadas
```bash
comando ejecutado
```

### Observaciones
- Información relevante, dependencias externas o pasos manuales.
```

## Historial

## 2026-08-09 - Mapa móvil seguro para organizadores

### Funcionalidad desarrollada
- La vista de mapa de organizador y administrador reutiliza el mismo visor, zoom, pellizco y arrastre que usa el cliente.
- Se eliminó de esas vistas móviles la edición de diseño: no se pueden mover mesas, cargar plantillas, crear elementos ni guardar geometría.
- El organizador puede seleccionar una silla o el centro de una mesa para bloquearla o desbloquearla. Capacidad, disponibles, vendidas y bloqueadas permanecen visibles.
- Los asientos vendidos y bloqueos temporales continúan protegidos y no se modifican desde esta pantalla.
- En la ruta de administrador, el `ScrollView` adicional se bloquea de forma nativa e inmediata al tocar el mapa; así no debe capturar el primer arrastre del canvas.
- Las acciones de cancelar, bloquear y desbloquear quedan arriba del mapa para estar disponibles antes de interactuar con él.
- Tocar por segunda vez la misma silla o la misma mesa seleccionada elimina su selección local, sin requerir pulsar `Cancelar`.

### Archivos modificados
- `/Users/sundingalue/Documents/TicketSystem/mobile/src/components/events/ClientVenueMap.tsx`
- `/Users/sundingalue/Documents/TicketSystem/mobile/src/components/organizer/OrganizerVenueMapMobile.tsx`
- `/Users/sundingalue/Documents/TicketSystem/mobile/src/screens/OrganizerPanelScreen.tsx`
- `/Users/sundingalue/Documents/TicketSystem/mobile/src/screens/AdminPanelScreen.tsx`

### Problema solucionado
- El organizador móvil utilizaba un editor distinto al mapa del cliente, con una competencia de gestos y controles de diseño innecesarios para bloquear asientos.

### Riesgos encontrados
- La interfaz usa el endpoint de bloqueo existente y no altera geometría, ventas ni tickets. Requiere prueba física con mesas bloqueadas, vendidas y disponibles antes de considerarse comprobada.

### Estado de pruebas
- IMPLEMENTADO, NO PROBADO

### Pruebas ejecutadas
```bash
cd /Users/sundingalue/Documents/TicketSystem/mobile
npx tsc --noEmit
git diff --check
```

### Observaciones
- La vista de compra del cliente y los pagos no se modificaron. El backend solo sincroniza el estado ya existente de bloqueos entre inventario y configuración visual del mapa.

## 2026-08-09 - Gestos nativos del mapa móvil del organizador

### Funcionalidad desarrollada
- El canvas del mapa usa un controlador nativo de gestos para retener inmediatamente los toques iniciados dentro del mapa y evitar que la pantalla principal se desplace antes de que el mapa reciba el gesto.
- El movimiento de mesas y sillas requiere activar explícitamente `Mover` dentro de `Editar`; seleccionar o bloquear ya no debe desplazar el diseño por accidente.
- El pan y zoom usan una única transformación nativa y coordenadas de pantalla consistentes para reducir retardo y temblor.

### Archivos modificados
- `/Users/sundingalue/Documents/TicketSystem/mobile/App.tsx`
- `/Users/sundingalue/Documents/TicketSystem/mobile/index.ts`
- `/Users/sundingalue/Documents/TicketSystem/mobile/package.json`
- `/Users/sundingalue/Documents/TicketSystem/mobile/package-lock.json`
- `/Users/sundingalue/Documents/TicketSystem/mobile/src/components/organizer/VenueMapEditor.tsx`
- `/Users/sundingalue/Documents/TicketSystem/mobile/src/screens/OrganizerPanelScreen.tsx`

### Problema solucionado
- El `ScrollView` padre podía tomar un arrastre vertical que comenzaba dentro del mapa antes de que el bloqueo JavaScript se aplicara.

### Riesgos encontrados
- Se añade un módulo nativo (`react-native-gesture-handler`), por lo que Metro o la aplicación ya instalada no bastan para validarlo: se requiere una Development Build iOS nueva y una prueba física.

### Estado de pruebas
- IMPLEMENTADO, NO PROBADO

### Pruebas ejecutadas
```bash
cd /Users/sundingalue/Documents/TicketSystem/mobile
npx tsc --noEmit
```

### Observaciones
- No se modificaron backend, pagos, tickets ni mapas publicados. TestFlight solo será necesario para distribuir la compilación; para probar este ajuste basta una Development Build.

## 2026-07-31 - Entrada automática después de Tap to Pay

### Funcionalidad desarrollada
- Las entradas emitidas después de que Stripe confirma una venta presencial con Tap to Pay se guardan directamente como `used`, para contabilizar al comprador como persona admitida en el evento.
- Las entradas compradas por web, Checkout, QR o enlace continúan como `active` hasta ser validadas en la puerta.

### Archivos modificados
- `/Users/sundingalue/Documents/TicketSystem/backend/src/orders/orders.service.ts`
- `/Users/sundingalue/Documents/TicketSystem/backend/src/orders/orders.service.spec.ts`

### Problema solucionado
- Las ventas presenciales se emitían como pendientes aunque el comprador ya se encontraba físicamente en la entrada, provocando que las analíticas mostraran cero escaneados para `Entrada en puerta`.

### Riesgos encontrados
- El cambio modifica el estado inicial de los tickets únicamente para el canal `door_sale_tap_to_pay`; no corrige retrospectivamente ventas anteriores.

### Estado de pruebas
- IMPLEMENTADO Y COMPROBADO

### Pruebas ejecutadas
```bash
cd /Users/sundingalue/Documents/TicketSystem/backend
npm test -- --runInBand --watchman=false src/orders/orders.service.spec.ts
npm run build
```

### Observaciones
- La entrada se marca usada solamente después de que el backend confirma el pago con Stripe.
- Las pruebas automatizadas y la compilación del backend finalizaron correctamente; queda pendiente comprobar una compra real en un iPhone y su reflejo en las analíticas de producción.

## 2026-07-31 - Copia operativa única de ventas Tap to Pay

### Funcionalidad desarrollada
- Cuando Tap to Pay confirma una venta sin correo del comprador, el backend prepara automáticamente una copia del ticket para `TICKET_ARCHIVE_EMAIL`, con respaldo en `info@lpticket.com`.
- Si posteriormente el vendedor envía el ticket al correo del cliente, ese envío no vuelve a copiar a LPTicket ni al organizador.
- Si el pago ya contiene correo del comprador, se conserva el comportamiento existente: el comprador recibe el ticket y la copia operativa se envía mediante BCC.

### Archivos modificados
- `/Users/sundingalue/Documents/TicketSystem/backend/src/common/services/mail.service.ts`
- `/Users/sundingalue/Documents/TicketSystem/backend/src/orders/orders.service.ts`
- `/Users/sundingalue/Documents/TicketSystem/backend/src/orders/orders.service.spec.ts`
- `/Users/sundingalue/Documents/TicketSystem/PROJECT_STATUS.md`
- `/Users/sundingalue/Documents/TicketSystem/CHANGELOG.md`
- `/Users/sundingalue/Documents/TicketSystem/ARCHITECTURE.md`
- `/Users/sundingalue/Documents/TicketSystem/SECURITY.md`

### Problema solucionado
- Al hacer opcional el correo anterior al cobro, el flujo no invocaba el servicio de email y por eso tampoco se ejecutaba la copia administrativa configurada dentro de ese servicio.

### Riesgos encontrados
- El envío real depende de la configuración SMTP; `TICKET_ARCHIVE_EMAIL` permite cambiar en el futuro la dirección de archivo sin modificar código.

### Estado de pruebas
- IMPLEMENTADO, NO PROBADO

### Pruebas ejecutadas
```bash
cd /Users/sundingalue/Documents/TicketSystem/backend
npx tsc -p tsconfig.build.json --noEmit
npm test -- --runInBand --watchman=false src/orders/orders.service.spec.ts
npm run build
```

Resultado: compilación correcta y 6 pruebas críticas de órdenes aprobadas.

### Observaciones
- Falta comprobar la recepción real en `info@lpticket.com` con una venta Tap to Pay nueva después del despliegue.
- No se modificaron Stripe, importes, tickets, SMS, escaneo, frontend ni aplicación móvil.

## 2026-07-31 - Acceso invitado seguro para entradas Tap to Pay

### Funcionalidad desarrollada
- Las ventas presenciales Tap to Pay quedan identificadas por su canal de venta.
- El SMS o correo postventa genera un enlace firmado y temporal para consultar exclusivamente esa entrada sin iniciar sesión.
- La consulta normal por código ahora exige sesión y verifica que el usuario sea comprador, administrador, organizador o empleado aprobado del evento.
- La web evita cargar la sesión global en la vista independiente de la entrada y distingue entre un enlace invitado inválido y una entrada que requiere login.

### Archivos modificados
- `/Users/sundingalue/Documents/TicketSystem/backend/src/database/entities/order.entity.ts`
- `/Users/sundingalue/Documents/TicketSystem/backend/src/orders/orders.service.ts`
- `/Users/sundingalue/Documents/TicketSystem/backend/src/orders/orders.controller.ts`
- `/Users/sundingalue/Documents/TicketSystem/backend/src/orders/orders.service.spec.ts`
- `/Users/sundingalue/Documents/TicketSystem/backend/src/common/services/mail.service.ts`
- `/Users/sundingalue/Documents/TicketSystem/frontend/src/app/verify/[code]/page.tsx`
- `/Users/sundingalue/Documents/TicketSystem/frontend/src/components/layout/AppShell.tsx`
- `/Users/sundingalue/Documents/TicketSystem/frontend/src/lib/api.ts`
- `/Users/sundingalue/Documents/TicketSystem/PROJECT_STATUS.md`
- `/Users/sundingalue/Documents/TicketSystem/CHANGELOG.md`
- `/Users/sundingalue/Documents/TicketSystem/ARCHITECTURE.md`
- `/Users/sundingalue/Documents/TicketSystem/SECURITY.md`
- `/Users/sundingalue/Documents/TicketSystem/ROADMAP.md`

### Problema solucionado
- El enlace postventa llevaba a una vista afectada por la carga de sesión y el endpoint general de tickets era público para cualquier código conocido.

### Riesgos encontrados
- La entidad `Order` añade `salesChannel`; el proyecto aún usa `synchronize: true`, por lo que Railway aplicará la columna al iniciar el backend.
- Los enlaces enviados antes de este cambio no contienen firma y continuarán solicitando login.

### Estado de pruebas
- IMPLEMENTADO, NO PROBADO

### Pruebas ejecutadas
```bash
cd /Users/sundingalue/Documents/TicketSystem/backend
npx tsc -p tsconfig.build.json --noEmit
npm test -- --runInBand --watchman=false src/orders/orders.service.spec.ts

cd /Users/sundingalue/Documents/TicketSystem/frontend
npm run build
```

Resultado: backend y frontend compilaron; las 5 pruebas críticas de órdenes pasaron.

### Observaciones
- Falta comprobar un SMS nuevo desde un pago real Tap to Pay después del despliegue.
- No se modificaron importes, cobros, webhooks, escaneo, Apple Wallet ni la aplicación móvil.

## 2026-07-26 - Intereses y sugerencias de Social Match

### Funcionalidad desarrollada
- Se tradujeron los intereses visibles de Social Match, manteniendo `Networking` igual en español e inglés.
- Se retiró el campo visible de industria o área y se dejó de usar como criterio de sugerencias.
- Se rediseñó el selector de intereses con iconos, jerarquía y estado seleccionado más claro.
- Se rediseñó el bloque Resumen/Summary con estados visuales para compatibilidad, intereses y ubicación.
- Las sugerencias ahora requieren que ambas personas tengan Social Match activo en el mismo evento y compartan al menos un interés.

### Archivos modificados
- `/Users/sundingalue/Documents/TicketSystem/mobile/src/components/profile/SocialMatchMobile.tsx`
- `/Users/sundingalue/Documents/TicketSystem/backend/src/social-match/social-match.service.ts`
- `/Users/sundingalue/Documents/TicketSystem/PROJECT_STATUS.md`
- `/Users/sundingalue/Documents/TicketSystem/CHANGELOG.md`

### Problema solucionado
- La lógica anterior mostraba a otros compradores del evento aunque no hubieran activado Social Match ni seleccionado intereses compartidos; el campo industria también podía alterar el orden de compatibilidad.

### Riesgos encontrados
- El backend y la interfaz ya compilan, pero se requiere una prueba con dos cuentas y un evento compartido para confirmar el filtrado visual real.

### Estado de pruebas
- IMPLEMENTADO, NO PROBADO

### Pruebas ejecutadas
```bash
cd /Users/sundingalue/Documents/TicketSystem/mobile
npx tsc --noEmit

cd /Users/sundingalue/Documents/TicketSystem/backend
./node_modules/.bin/tsc -p tsconfig.build.json --noEmit --pretty false
```

Resultado: pasó sin errores.

### Observaciones
- No se modificaron pagos, tickets, mapas, conexiones existentes ni la base de datos.

## 2026-07-26 - Diseño Apple Wallet compatible con QR

### Funcionalidad desarrollada
- Se reemplazó el intento de Poster Event Ticket por una composición clásica compatible con el QR necesario para validar entradas.
- El pase toma el flyer principal del evento como fondo oscuro y legible, añade una miniatura nítida del flyer, y muestra como prioridad el título del evento sin etiqueta, fecha, hora real del evento, titular, venue y asiento.
- La app abre el pase desde una ruta de `lpticket.com`, sin mostrar la URL de Railway al cliente.

### Archivos modificados
- `/Users/sundingalue/Documents/TicketSystem/backend/src/common/services/wallet.service.ts`
- `/Users/sundingalue/Documents/TicketSystem/frontend/src/app/api/wallet/[code]/route.ts`
- `/Users/sundingalue/Documents/TicketSystem/mobile/src/screens/TicketsScreen.tsx`
- `/Users/sundingalue/Documents/TicketSystem/PROJECT_STATUS.md`
- `/Users/sundingalue/Documents/TicketSystem/CHANGELOG.md`

### Problema solucionado
- El intento anterior generaba un pase de aproximadamente 5 MB y tardaba cerca de cinco segundos porque añadió recursos de Poster Event Ticket que Apple no muestra cuando el pase contiene un QR.
- Apple Wallet usaba incorrectamente la hora de apertura (`doorsOpen`) en lugar de la hora real del evento (`eventDate`).

### Riesgos encontrados
- Apple no permite el formato Poster Event Ticket cuando un pase requiere QR o código de barras para entrar; el QR se mantiene para no afectar la validación de entradas.
- Para ver el cambio en un iPhone real, se debe publicar backend y web, y volver a añadir un pase recién generado.

### Estado de pruebas
- IMPLEMENTADO, NO PROBADO

### Pruebas ejecutadas
```bash
cd /Users/sundingalue/Documents/TicketSystem/backend
./node_modules/.bin/tsc -p tsconfig.build.json --noEmit --pretty false

cd /Users/sundingalue/Documents/TicketSystem/mobile
npx tsc --noEmit

cd /Users/sundingalue/Documents/TicketSystem/frontend
npm run build
```

Resultado: pasó sin errores.

### Observaciones
- No se modificó Google Wallet, pagos, tickets existentes ni credenciales.

## 2026-07-21 - Entitlement de Tap to Pay concedido y build iOS 30 iniciado

### Funcionalidad desarrollada
- Se confirmó en Apple Developer que `Tap to Pay on iPhone` está habilitado para `com.inhoustontexas.lpticket`.
- Se alinearon los números de compilación locales a `30` y se inició una compilación iOS de producción en EAS.

### Archivos modificados
- `/Users/sundingalue/Documents/TicketSystem/mobile/app.json`
- `/Users/sundingalue/Documents/TicketSystem/mobile/ios/LPTicket/Info.plist`
- `/Users/sundingalue/Documents/TicketSystem/mobile/ios/LPTicket.xcodeproj/project.pbxproj`

### Problema solucionado
- La versión declarada por Expo no coincidía con la versión remota y nativa de iOS, lo que podía causar confusión al preparar una compilación para Apple.

### Riesgos encontrados
- La compilación y la capacidad concedida no prueban por sí solas un cobro real: aún requiere un iPhone físico compatible, Stripe Terminal configurado y una transacción aprobada.

### Estado de pruebas
- IMPLEMENTADO, NO PROBADO

### Pruebas ejecutadas
```bash
cd /Users/sundingalue/Documents/TicketSystem/mobile
npx tsc --noEmit
```

Resultado: pasó sin errores.

### Observaciones
- Build iOS de producción `30` iniciado en EAS; estado externo en curso al momento de este registro.

## 2026-07-21 - Refuerzo del estándar de diseño y calidad

### Funcionalidad desarrollada
- Se amplió la guía oficial con principios de diseño premium, sistema visual, accesibilidad, responsive, flujos de compra y control de calidad visual.

### Archivos modificados
- `/Users/sundingalue/Documents/TicketSystem/AGENTS.md`
- `/Users/sundingalue/Documents/TicketSystem/CHANGELOG.md`

### Problema solucionado
- La guía anterior establecía diseño premium, pero no detallaba de forma suficiente cómo revisar jerarquía, tipografía, composición, estados, accesibilidad y consistencia antes de entregar una interfaz.

### Riesgos encontrados
- Un estándar visual más amplio no sustituye la revisión en dispositivos y datos reales; cada cambio seguirá requiriendo validación proporcional a su alcance.

### Estado de pruebas
- IMPLEMENTADO Y COMPROBADO

### Pruebas ejecutadas
```bash
cd /Users/sundingalue/Documents/TicketSystem
git diff --check
```

Resultado: pasó sin errores.

### Observaciones
- No se modificó código de móvil, web ni backend.
- Se conservaron las reglas existentes de arquitectura, seguridad, validación, Git y producción.

## 2026-07-20 - Ajuste visual de Tap to Pay para revision de Apple

### Funcionalidad desarrollada
- Se normalizo la etiqueta visible de Perfil al nombre oficial `Tap to Pay on iPhone`.
- Se confirmo que la pantalla de venta en puerta ya usa `wave.3.right.circle.fill`, uno de los SF Symbols solicitados por Apple.
- Se fijó el botón final de cobro al nombre oficial sin traducir: `Tap to Pay on iPhone`.
- Se fijaron también el acceso de Perfil y las etiquetas visibles de Venta en puerta al nombre oficial, para que la app en español no cambie la marca.

### Archivos modificados
- `/Users/sundingalue/Documents/TicketSystem/mobile/src/screens/ProfileScreen.tsx`
- `/Users/sundingalue/Documents/TicketSystem/mobile/src/screens/DoorSaleScreen.tsx`
- `/Users/sundingalue/Documents/TicketSystem/PROJECT_STATUS.md`
- `/Users/sundingalue/Documents/TicketSystem/CHANGELOG.md`

### Problema solucionado
- Apple indico que la grabacion enviada mostraba capitalizacion no oficial y un icono distinto al requerido para Tap to Pay on iPhone.

### Riesgos encontrados
- La correccion solo puede validarse visualmente en una compilacion nativa nueva instalada en un iPhone real.
- No se debe asumir que una grabacion anterior refleja este codigo.

### Estado de pruebas
- IMPLEMENTADO, PENDIENTE DE VALIDACION VISUAL NATIVA

### Pruebas ejecutadas
```bash
cd /Users/sundingalue/Documents/TicketSystem/mobile
npx tsc --noEmit
```

Resultado: pasó sin errores.

### Observaciones
- Se sincronizaron los Pods de iOS y `ExpoSymbols (56.0.6)` quedó integrado para que Xcode pueda renderizar el SF Symbol oficial.
- No se modificaron Stripe, backend, términos ni intents.
- El cambio local previo en `DoorSaleScreen.tsx` se conserva fuera de esta correccion.

## 2026-07-16 - Flujo móvil de Tap to Pay

### Funcionalidad desarrollada
- Se incorporó la base técnica para educación, preparación y cobro con Tap to Pay desde la app móvil.

### Archivos modificados
- Revisar el commit `7330f341` para el listado exacto de archivos.

### Problema solucionado
- Se añadió el flujo necesario para preparar cobros presenciales desde la app móvil.

### Riesgos encontrados
- Requiere aprobación externa de Apple.
- Requiere configuración válida de Stripe Terminal.
- Requiere compilación nativa y dispositivo físico autorizado.
- No funciona dentro de Expo Go.

### Estado de pruebas
- IMPLEMENTADO, NO PROBADO

### Pruebas ejecutadas
```bash
NO COMPROBADO EN ESTE REGISTRO
```

### Observaciones
- La implementación en código no equivale a aprobación externa ni validación real de pago.
# 2026-07-31 - Venta en puerta y escáner continuo

### Funcionalidad desarrollada
- Se hizo opcional el correo antes de Tap to Pay; la venta puede completarse sin datos de contacto.
- Después del pago confirmado se puede enviar la entrada por SMS o correo, o continuar sin enviar.
- El SMS transaccional reutiliza Twilio y los intentos quedan auditados con destinatarios enmascarados.
- La emisión usa bloqueo transaccional para evitar tickets duplicados por confirmaciones concurrentes.
- La validación de QR usa una transición atómica para impedir doble entrada simultánea.
- El escáner diferencia ticket usado, cancelado, de otro evento, no encontrado, falta de permiso y falla de red.
- La sesión de puerta conserva evento, conteo e historial local; el modo cámara se rearma después de cada lectura.
- Los empleados autorizados pueden consultar el conteo del evento y regresan al escáner después de una venta.

### Pruebas ejecutadas
```bash
cd /Users/sundingalue/Documents/TicketSystem/backend
npm run build
npm test -- --runInBand --watchman=false src/orders/orders.service.spec.ts

cd /Users/sundingalue/Documents/TicketSystem/mobile
npx tsc --noEmit
```

Resultado: build y typecheck pasaron; 3 pruebas críticas pasaron. Stripe, Twilio y la experiencia física de iPhone permanecen `NO PROBADO`.

### Observaciones
- No se modificó el checkout web, no se desplegó Railway y no se realizó commit ni push.
- Se añadió una columna nullable de auditoría de entrega a órdenes; debe revisarse el cambio de esquema antes del despliegue.
