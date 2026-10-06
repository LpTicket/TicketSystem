# LPTicket - Historial de Cambios

## 2026-10-05 - Herramientas móviles sin encabezados superpuestos

- El panel de Herramientas de administrador y organizador oculta temporalmente el encabezado global mientras está abierto. Encabezado propio, cierre de 44 px, espacio para áreas seguras y navegación con desplazamiento interno.
- Probado con administrador ficticio en 390 y 320 px: cierre por botón, Escape y fondo exterior; restauración del logo, controles, foco y scroll al cerrar. Panel de organizador y barra lateral de escritorio comprobados. Sin cambios de rutas, permisos, autenticación, ventas o pagos.

## 2026-10-05 - Corrección del menú móvil web

- Las reglas finales del menú apuntan al elemento nav actual, eliminando el panel estrecho y el contenido desplazado. Fondo opaco a todo el ancho, debajo del encabezado de 5.1 rem, y desplazamiento interno cuando falta altura.
- Verificado en web de 390 px y 320 px, y horizontal de 844 × 390: apertura, cierre por Escape, navegación y acceso a Soporte mediante desplazamiento. Solo CSS móvil; sin cambios de autenticación, enlaces, carrito, asientos ni pagos.

## 2026-10-05 - Flyers completos en tarjetas de eventos

- El marco de las tarjetas de Inicio y Eventos se adapta a las dimensiones reales del flyer, eliminando las franjas añadidas por una proporción fija y conservando el contenido completo sin estirar ni recortar.
- Comprobación en navegador con flyers publicados de distintas proporciones, incluido Greenville 1000 × 1500, en escritorio y web de 390 px. Sin cambios de archivos originales, datos de eventos, precios, entradas o pagos.

## 2026-10-04 - Herramientas de presentación del mapa de organización

- Capacidad, disponibilidad, ventas, cortesías y bloqueos en tarjetas separadas y legibles; las cifras conservan la fuente y los cálculos existentes.
- Fondo blanco trasladado del cliente al editor del organizador/administrador, únicamente en escritorio web. No se guarda como cambio del mapa.
- Exportación PDF A3 de una página con el mapa completo, logo LP Ticket, nombre/fecha del evento y resumen inferior de inventario. Genera una copia visual sin mover, guardar ni modificar el mapa activo.
- Validación: revisión visual del PDF con 24 grupos de asientos, elementos girados y posiciones fuera del lienzo inicial; igualdad del mapa y cifras antes/después del fondo y exportación; controles ocultos en web de 390 px y ausentes en la vista pública. Sin cobros ni escrituras reales de gestión; backend y móvil sin cambios.

## 2026-10-04 - Fondo alternativo del mapa público

- Botón Fondo blanco junto al zoom permite alternar entre azul oscuro y blanco con cuadrícula gris. Cambia solo la presentación local del fondo; no guarda cambios en el mapa ni modifica asientos, disponibilidad o importes.
- Validación: build de producción y revisión en navegador con datos ficticios, escritorio y móvil de 390 px. Se comprobó igualdad de posiciones, colores de asientos, zoom, selección y total al alternar, uso con teclado y rechazo de selección de asientos vendidos/bloqueados. Sin cargos ni cambios de datos reales.

## 2026-10-04 - Revisión de formularios, diálogos y recuperación de sesión web

- Confirmaciones y ventanas de usuarios mantienen el foco del teclado, permiten Escape y devuelven el foco al abrir/cerrar. Enter sobre Cancelar ya no confirma una acción. Formularios de usuarios por encima del encabezado, con fondo legible y contraseña oculta.
- Entradas del usuario y selección de organizador distinguen errores de carga de resultados vacíos, con reintento. Personal y accesos evita mostrar una lista vacía cuando falla la carga.
- Etiquetas accesibles en creación/edición de eventos, usuarios y datos de compra; selector horario devuelve el foco, cargas de imágenes accesibles con teclado y zona UTC visible cuando está seleccionada. Campos de edición de eventos de 16 px y al menos 44 px de altura.
- Compra espera la recuperación de sesión antes de decidir si debe enviar al acceso. Importes, envío a Stripe y funciones de escritura de gestión conservan su lógica.
- Validación: build de producción, 70 pruebas de backend en cuatro suites, comparación de 38 funciones de acciones sin modificaciones y revisión local de administrador/organizador/cliente con datos ficticios en escritorio y ancho móvil de 390 px. Se comprobó compra hasta el resumen previo al pago, recarga autenticada, protección de acceso, errores/reintentos y teclado. Sin cargos, mensajes ni escrituras de gestión reales; backend y móvil sin cambios.
- Pendiente: compra completa en entorno aislado con Stripe de prueba, dispositivos físicos, auditoría completa de lector de pantalla/contraste y operaciones complejas de mapas/asientos. La revisión no se declara completa al 100%.

## 2026-10-04 - Recuperación de navegación y accesibilidad web

- Página 404 con accesos a eventos, inicio y soporte; Contacto añade ayuda con entradas, teléfono y correo accionables. El idioma del documento sigue la selección español/inglés.
- Categorías incorpora etiquetas accesibles, selección anunciada, foco del selector de imagen y controles de al menos 44 px. Categorías y códigos especiales distinguen errores de carga de listas vacías y ofrecen reintento; los indicadores no presentan un fallo como cero registros.
- Recibos conserva los resultados anteriores durante el reintento y muestra nombres completos, distribución móvil y acceso de al menos 44 px.
- Validación: build de producción, revisión de cambios, 69 enlaces internos comprobados y comparación de 19 funciones de escritura/estado sin modificaciones. Navegador con datos ficticios en escritorio y móvil de 390 px: errores y recuperación de categorías/códigos/recibos, enlaces de ayuda, página 404 e idioma. Backend, móvil, Stripe y datos de clientes sin cambios; no se realizaron cobros, envíos ni escrituras de gestión reales.

## 2026-10-04 - Cuenta, eventos, soporte y medidas de flyers en la web

- Portadas: 6 × 8 pulgadas; banners: 6 × 2 pulgadas, como referencia de diseño a 180 ppp. Indicaciones consistentes en creación, edición y marketing; marcos de portada 3:4 y banners 3:1. La aprobación de portadas muestra la imagen completa.
- Mis entradas incorpora búsqueda entre las entradas cargadas y filtros por fecha del evento, conservados al cambiar de pestaña y volver. QR más grande sin cambiar su contenido, títulos completos y reintento de la página que falló conservando los resultados anteriores.
- Recibos muestra moneda y reintentos; perfil incorpora etiquetas accesibles. Eventos añade accesos internos, reintento de carga y aviso manejable con teclado. Soporte añade accesos a cuenta y recuperación de búsquedas vacías.
- Validación: build de producción con TypeScript, revisión del diff y comparación de 19 funciones sensibles sin cambios. Navegador local con datos ficticios: filtros, búsqueda, Atrás, perfil, soporte, aviso y marcos en escritorio y ancho móvil. No se realizaron compras, envíos ni escrituras de gestión reales; backend y móvil sin cambios.

## 2026-10-04 - Seguimiento de distribución móvil 1.0.12

- EAS confirmó que el build firmado iOS 1.0.12 (43) terminó correctamente. El panel de EAS identificó el rechazo inicial por un acuerdo de Apple; se confirmaron ambos acuerdos comerciales activos y el contrato del Developer Program aceptado hoy. Una vez que la API reconoció ese cambio, el envío del mismo archivo terminó correctamente (submission `b00fa309-c755-4bde-87a3-cbf5933e012d`). App Store Connect muestra 1.0.12 (43) en procesamiento; instalación en TestFlight y publicación pública aún no confirmadas. No se cambiaron credenciales ni permisos.
- Android 1.0.12 (11) enviado a compilar con la firma existente (build `32edc984-918c-43fe-80d1-6321ca6435df`), sin envío a Google Play. Revisión visual Android pendiente porque el emulador no está disponible en la herramienta de control visual.
- El diagnóstico de EAS detectó una advertencia de memoria de Hermes V1 y desajustes de versiones de dependencias. La documentación de Expo identifica especialmente aplicaciones que importan Reanimated/Worklets; no se encontraron esas importaciones ni dependencias directas en esta app. No se reprodujo el problema ni se modificaron dependencias. Evaluar una actualización y pruebas nativas separadas: https://expo.dev/changelog/sdk-57#known-regressions.
- Sin cambios nuevos de código, backend, datos de clientes, pagos, tickets, QR ni recibos en este seguimiento.

## 2026-10-04 - Revisión nativa y preparación móvil 1.0.12

- Inicio muestra fechas con año e idioma seleccionado, conservando la zona horaria del evento; las categorías usan las etiquetas del catálogo. Compartir y Ver entradas se exponen como controles separados para lectores de pantalla.
- El acceso del encabezado dice Entrar; los botones compartidos informan su función y estado deshabilitado. No se modificaron controladores, servicios, compras, Stripe, tickets, QR ni recibos.
- Validación: TypeScript, compilación nativa iOS, exportación Android y arranque Android sin errores de JavaScript. En simulador iPhone se comprobaron carteles, pausa del carrusel, vuelta al listado conservando posición, acceso, cambio a registro y visibilidad de contraseña, sin enviar formularios ni realizar compras.
- Código publicado en `main` (`6ca0799b`). iOS 1.0.12 (43) enviado a compilar en EAS y envío a TestFlight programado (build `7aaa4fd5-7ec4-4e20-9dc4-3dcf2dd52ab2`, submission `4efcbe9e-4079-44d9-8d61-96fd84dfd1a7`); no disponible todavía. Apple indicó un acuerdo pendiente o vencido, que debe revisar el titular. El primer build (42) falló por la ruta temporal; preparación corregida. Revisión visual Android pendiente; sin publicación Android.

## 2026-10-04 - Adaptación móvil de Inicio y acceso

- Inicio alinea tarjetas con la web: carteles completos, etiquetas debajo de la imagen, destacado condicionado al evento, títulos compactos y acción Ver entradas. Campos de búsqueda de 16 px y carrusel con pausa; animaciones existentes conservadas.
- Acceso y registro incorporan etiquetas accesibles, campos más legibles y un control de contraseña de al menos 44 px. Sus cinco controladores se compararon con la versión anterior y permanecen iguales.
- Validación: TypeScript móvil y revisión del diff aprobados. Sin cambios de servicios, navegación raíz, compras, Stripe, tickets, QR ni escaneo.
- Pendiente: revisión visual y del carrusel en iPhone/Android, generación y distribución de una versión móvil. Estos cambios de código no actualizan las aplicaciones instaladas.

## 2026-10-04 - Refinamiento visual y navegación web

- Tipografía, tarjetas, botones, formularios y foco de teclado consistentes; carteles completos, fechas con año y etiquetas fuera de las imágenes. Menos elementos flotantes en formularios y gestión.
- Inicio conserva un orden determinista de destacados para evitar diferencias entre servidor y navegador. Carrusel con pausa y respeto a movimiento reducido; selector de orden accesible.
- Organización incorpora herramientas agrupadas, ubicación visible y menú móvil accesible. Mis eventos conserva filtro y búsqueda al volver y permite reintentar cargas fallidas.
- Marketing añade accesos a sus secciones y elimina indicadores estáticos que podían confundirse con mediciones reales. Los controladores de envío permanecen iguales.
- Validación: build de producción con TypeScript; navegador en escritorio y ancho móvil; gestión con datos sintéticos y escrituras bloqueadas. Sin cambios de backend, móvil, Stripe, checkout, QR o recibos; no se realizaron compras ni operaciones reales de gestión.

## 2026-10-04 - Organización del administrador web

- Menú agrupado para las diez herramientas, accesos directos en Resumen y ubicación visible en cada sección; menú móvil con cierre por Escape y navegación por teclado.
- Eventos y Usuarios conservan filtros, búsqueda y página en el historial. La paginación permanece disponible aunque la página esté vacía; los fallos de carga muestran reintento.
- Jerarquía de títulos más ligera y widgets flotantes ocultos en administración. Sin cambios en backend, Stripe, checkout, QR, recibos ni datos existentes.
- Validación: compilación de frontend y pruebas de escritorio/móvil con datos ficticios y escrituras bloqueadas. No se ejecutaron operaciones reales de administración ni compras.

## 2026-10-04 - Navegación y legibilidad de la web

- Eventos conserva búsqueda, categoría y página en la URL y recupera esos estados al usar Atrás. Las solicitudes anteriores se cancelan al cambiar filtros; los errores muestran una opción de reintento.
- El detalle del evento ofrece una vuelta al listado filtrado o al inicio; compartir mantiene el enlace público sin parámetros de navegación.
- Las pestañas de la cuenta conservan historial. Se unificaron enlaces de Mis Tickets y la sección activa del organizador al editar eventos.
- Menús con cierre al navegar o pulsar Escape, nombres accesibles y señalización de la página activa. Títulos y menú móvil con tamaños y pesos más moderados.
- Ayuda de acceso dirige a Soporte en lugar de una ruta inexistente. Buscar en Inicio abre Eventos; al filtrar por lugar muestra los resultados locales existentes.
- Validación: build de producción con TypeScript aprobado; búsqueda, detalle, Atrás y menú comprobados en navegador, incluido ancho móvil de 390 px. Flujos privados requieren verificación con sesión; no se realizaron compras ni cambios de datos.

## 2026-10-02 - Ajuste de pantalla Android y envío a Google Play

- La app Android respeta las áreas ocupadas por la barra de estado y la navegación del sistema para que el encabezado y el menú inferior sean visibles.
- Versión 1.0.11 (10) compilada en EAS y enviada como lanzamiento completo a revisión de Google Play. TypeScript móvil y build firmado aprobados; disponibilidad pública pendiente de Google.

## 2026-09-27 - Activar o desactivar Klarna por evento en la web

- Administración puede guardar `klarnaEnabled` desde Editar evento → Detalles e Imágenes. El backend impide que un organizador modifique esta opción.
- El resumen de compra entrega los métodos disponibles según el evento, la moneda y el interruptor global existente. La web muestra Klarna solo si el backend lo permite; una petición directa con Klarna desactivado se rechaza antes de crear órdenes o reservar inventario.
- Migración aditiva aplicada en producción antes del despliegue: columna booleana `events.klarnaEnabled`, no anulable y activada por defecto. Se comprobaron los mismos 13 eventos, 816 órdenes y 1.794 tickets antes y después; los 13 eventos conservaron Klarna activado.
- El ajuste afecta nuevas sesiones de pago. No cancela sesiones de Stripe ya abiertas ni modifica compras, tickets, QR o pagos históricos.
- Validación: 58 pruebas de eventos/órdenes y builds de frontend/backend aprobados. Sin cambios de móvil; no se completaron compras reales para probar este ajuste.

## 2026-09-26 - Conteo compartido de puerta y cancelación de Tap to Pay

- Escáner móvil y web muestran ingresos del backend en lugar de contadores locales reiniciables. El historial reciente sigue siendo local y se identifica como tal.
- Estadísticas del evento separan vendidas y cortesías; ambas consumen capacidad. Se conserva `totalPurchased` como alias histórico de emitidas para clientes anteriores.
- Venta en puerta móvil muestra vendidas, cortesías, capacidad, ingresos y margen o exceso de capacidad. Actualiza al confirmar una venta y cada 15 segundos mientras la app está activa; el escáner conserva su intervalo de 15 segundos y actualiza tras escanear.
- Cancelar en la pantalla nativa solicita cancelar el mismo PaymentIntent al backend. Solo una cancelación confirmada libera la compra y vuelve a dejar la pantalla lista sin modal de error. Pagos completados o inciertos conservan la verificación contra duplicados.
- Validación local: 15 pruebas del servicio móvil Tap to Pay, 48 pruebas de órdenes y acceso de escáner; compilaciones de producción de backend y web, y TypeScript de móvil/web. Sin migraciones.
- Publicación autorizada: código `1ecfec17` en `main`, backend/web desplegados correctamente en Railway; iOS 1.0.10 (41) y Android 1.0.10 (9) enviados a revisión de las tiendas. Aprobación y disponibilidad pública pendientes.
- Pendiente: prueba nativa con dos iPhone, cancelación/reintento, confirmación de totales contra datos reales y medición de tiempos en la red del evento. El margen mostrado es capacidad menos entradas vigentes; no equivale a inventario vendible porque no descuenta bloqueos o reservas.

## 2026-09-17 - Correo y recibo correctos para cortesías múltiples

### Corrección
- Se corrigió la estructura del correo compartido de entradas: las etiquetas de cierre ya no se repiten dentro de cada tarjeta, por lo que dos o más QR permanecen dentro de un solo documento HTML válido.
- Las entradas gratuitas siguen usando el diseño oficial de tickets y ahora muestran el nombre del invitado y su tipo exacto: `Cortesía`, `Prensa`, `Sponsor` o `Staff`.
- El asunto, el contenido del correo, el reenvío, la entrada digital y el recibo por orden conservan esa misma clasificación.
- Los textos variables del invitado y del evento se escapan antes de insertarse en el HTML del correo.
- Cada entrada se presenta como una tarjeta independiente basada en tablas, con la misma sombra y una separación fija que los clientes de correo móviles conservan mejor.
- Se eliminaron los QR adjuntos redundantes que Gmail mostraba al final del mensaje; cada tarjeta conserva su único QR mediante el endpoint público y sus acciones existentes.
- Las cortesías ya no muestran el resumen general de `$0.00` que algunos clientes renderizaban como un bloque blanco vacío. El resumen individual dentro de cada entrada permanece sin cambios.

### Áreas protegidas
- No se modificaron QR, inventario, capacidad, mapas, pagos, Stripe, permisos, entidades, migraciones ni la app móvil.

### Pruebas ejecutadas
```bash
cd /Users/sundingalue/Documents/TicketSystem/backend
npx jest --runInBand --no-watchman src/common/services/mail.service.spec.ts src/orders/orders.service.spec.ts
npm run build

cd /Users/sundingalue/Documents/TicketSystem/frontend
npm run build
```

### Estado
- IMPLEMENTADO Y COMPROBADO LOCALMENTE

### Pendiente manual
- Emitir dos entradas de cortesía controladas en producción y confirmar en un correo real que se ven ambos QR, el nombre correcto y la clasificación elegida.

## 2026-09-16 - Protección contra correos de entradas duplicados

Estado: `IMPLEMENTADO Y COMPROBADO LOCALMENTE`; prueba SMTP controlada pendiente.

- Se confirmó en producción que la compra investigada es una sola orden pagada con cinco tickets. No hubo duplicación del cobro, la orden ni las entradas.
- La causa funcional estaba en el reenvío por ticket: cada botón enviaba el paquete completo de tickets vigentes de la orden y no existía una reserva atómica que rechazara solicitudes repetidas o concurrentes.
- El backend reserva ahora el envío por orden y correo bajo bloqueo de escritura, conserva un historial enmascarado con estados `pending`, `sent` y `failed`, y devuelve `alreadySent` a las solicitudes repetidas dentro de la ventana de protección.
- Los reenvíos manuales dejan de producir copias BCC para administración u organización. El envío automático inicial conserva su comportamiento operativo configurado.
- Web y móvil muestran un mensaje específico cuando el backend detiene una repetición, en vez de afirmar que generaron otro envío.
- `MailService.sendTicketEmail` propaga los errores del proveedor para que el historial no registre como exitoso un intento rechazado.
- No se modificaron pagos, Stripe, órdenes, tickets, QR ni inventario. No hay cambio de esquema.
- Validación local: `npm test -- --runInBand --no-watchman` (50 pruebas), `npm run build` en backend y frontend, `npx tsc --noEmit` en móvil y `git diff --check`.

## 2026-09-15 - Saldo real del organizador en su dashboard

Estado: `PARCIALMENTE IMPLEMENTADO` en distribución; commit `a54615aa` publicado y web pública comprobada. Validación autenticada pendiente.

- El dashboard del organizador reemplaza `Neto estimado`, que descontaba nuevamente una comisión estimada de Stripe, por `Pagos registrados` y `Pendiente por pagar`.
- `Venta de entradas` conserva el subtotal base destinado al organizador. El pendiente usa la misma contabilidad administrativa: venta base menos ajustes de procesamiento aplicables ya conciliados y pagos externos registrados.
- Registrar un pago desde administración invalida inmediatamente los resúmenes financieros del administrador y del organizador. No realiza transferencias ni modifica órdenes, tickets o cobros.
- Validación: 39 pruebas de órdenes, build de backend, build de frontend, TypeScript móvil y presencia de los textos nuevos en los archivos públicos.

## 2026-09-15 - Entradas de cortesía para generales y ubicaciones asignadas

Estado: `PARCIALMENTE IMPLEMENTADO` en distribución; código y web publicados, emisión real pendiente.

- La gestión web del evento incorpora un flujo premium `Entradas de cortesía` para emitir por cantidad en secciones generales o seleccionar sillas y mesas.
- El backend valida destinatario, modalidad y propiedad del evento; limita la cantidad, protege la capacidad general con bloqueo transaccional y crea órdenes operativas `complimentary` de `$0.00` con QR activos.
- Las cortesías permiten tipo y nota, aparecen en el historial, no generan ingresos y conservan las reglas existentes de bloqueo para ubicaciones asignadas.
- La web pública ya contiene los controles nuevos. Falta una prueba autenticada y controlada que confirme correo, QR, capacidad e historial sin afectar un evento en operación.

## 2026-09-15 - Ingreso por comprador y confirmación de pago en puerta

Estado: `PARCIALMENTE IMPLEMENTADO` en distribución; backend/web publicados y comprobados. Entrega móvil en cola y prueba física pendiente.

- `mobile/src/screens/ScanScreen.tsx` y `frontend/src/app/verify/page.tsx`: acceso directo a búsqueda, saldo disponible, ingreso de una persona, comprador conservado, selección de silla/tipo y estados anulados/revocados; historial desplegable y refresco de búsquedas visibles cada 5 segundos.
- `backend/src/orders/orders.service.ts`, controladores de órdenes/empleados y DTO de validación: búsqueda con saldo completo por comprador, respuesta sin QR pesado, correo enmascarado y método de ingreso validado. La admisión comparte la protección condicional existente del QR y no cambia inventario, asientos ni ventas.
- `backend/src/database/entities/ticket.entity.ts`: campos nuevos y anulables `usedAt`, `usedBy`, `admissionMethod`. Los tickets históricos no reciben fechas ni actores inventados. Sin migración ejecutada.
- Tap to Pay: endpoint de recuperación separado para conservar el contrato de apps anteriores; confirmación estricta de Stripe y entradas; cancelación solo de la compra pendiente y solo después de comprobar Stripe; procesamiento/captura pendientes nunca significan acceso.
- `mobile/src/services/tapToPay.ts`, `doorSales.ts`, `DoorSaleScreen.tsx` y declaración del SDK: recuperación de la misma compra, persistencia local sin secretos ni datos de tarjeta, bloqueo de doble toque, verificación real de conexión y resultado final inequívoco. Reintentar no crea otra orden/PaymentIntent.
- El correo postventa de Tap to Pay continúa después de la confirmación sin bloquear al comprador. Conserva destinatarios/copias existentes; sigue siendo mejor esfuerzo y no una cola durable.
- Pruebas: backend de admisión/concurrencia/Stripe, pruebas del servicio móvil con SDK y servidor simulados, builds y prueba visual web con dos puertas y datos ficticios. No se hicieron cobros reales. La publicación autorizada se detalla abajo; los cambios previos de Android en `mobile/eas.json` se conservan fuera de estos commits.


### Publicación autorizada

- Commits `ee6312eb` (ingreso/pagos) y `4ef45e07` (versión móvil `1.0.9`) publicados en `main`. Se conservaron fuera de ambos commits los ajustes previos de Android en `mobile/eas.json` y sus notas.
- Backend activo en Railway; web pública muestra los controles nuevos. GET de eventos y `/verify`: 200. Sin cobros reales ni consumo de tickets para pruebas.
- El envío EAS de iOS `1.0.9 (39)` fue cancelado antes de comenzar. Se generó localmente la misma fuente como `1.0.9 (40)` y Xcode la cargó directamente a App Store Connect con resultado `Upload succeeded`; Apple la muestra en estado `Procesando`. Android `1.0.9 (7)` permanece en la cola gratuita. Google Play mantiene la versión anterior en revisión. La instalación en TestFlight todavía depende del procesamiento final de Apple.

### Comprobaciones de esta implementación

- PostgreSQL temporal aislado: esquema con exactamente tres columnas nuevas anulables, historial conservado, búsqueda completa con acentos/código y una sola admisión ante dos solicitudes simultáneas.

- En `backend`: `npm test -- --runInBand --no-watchman orders.service.spec.ts scanner-access.service.spec.ts --silent` (38 pruebas) y `npm run build`; la repetición previa al push encontró `EMFILE` local y pasó con `CHOKIDAR_USEPOLLING=true npm run build`.
- En `mobile`: `npx tsc --noEmit`.
- Desde la raíz: `node --test mobile/tests/tapToPay.test.cjs` (10 casos con SDK/HTTP simulados) y `git diff --check`.
- En `frontend`: `npm run build`.
- Navegador local con API ficticia: comprador con 10 entradas, 7 ingresadas, registro manual de una, saldo final 2, comprador abierto y actualización en otra puerta. Revisión del escáner a 320, 390, 768 y 1440 px; barra global existente desborda a 320 px y no se modificó.
- Para la prueba física posterior: compilar e instalar la app nativa; usar un backend de pruebas con el esquema actualizado y Stripe configurado para pruebas. Verificar cobro confirmado, rechazo, pérdida de red después de acercar la tarjeta, reapertura de la app, verificación del mismo intento y cancelación. Comparar cada caso con Stripe y los tickets persistidos. No probar estos casos cobrando a asistentes de un evento en vivo.

## 2026-09-12 - Preparación de la versión Android 1.0.8 para Play Store

- El AAB firmado de LP Ticket `1.0.8` (`versionCode` 5) se compiló en EAS y se cargó en Google Play Console para producción. Android API mínima 26 y objetivo 36.
- `mobile/eas.json` especifica la pista `production` para futuras entregas automáticas; EAS no pudo ejecutar el envío automático porque no dispone de una cuenta de servicio de Google Play. La carga manual no creó ni expuso credenciales.
- Se seleccionaron Venezuela, Colombia, Panamá, México, Argentina, Chile, Perú y Estados Unidos. Con confirmación explícita del propietario se enviaron a revisión el lanzamiento completo y los ocho países. Google Play ejecuta verificaciones rápidas antes de iniciar la revisión; la publicación administrada está desactivada, así que podría publicarse automáticamente tras la aprobación. No se alteraron iOS, web, backend, pagos, datos ni la otra app de la cuenta.
- Validación: `npx tsc --noEmit`, `git diff --check`, archivo AAB íntegro mediante `unzip -tq`, build EAS `FINISHED` y aceptación del paquete en Play Console. `expo-doctor` indicó una regresión de memoria conocida en Hermes V1 de SDK 56 y diferencias de dependencias; no se hizo una actualización mayor de SDK dentro de esta publicación.

Estado: `PARCIALMENTE IMPLEMENTADO`; enviado a la etapa de revisión, todavía sin publicación pública confirmada.

## 2026-09-12 - Gestión administrativa de empleados de eventos en web

- El panel administrativo web incorpora el acceso directo `Empleados de eventos`.
- Desde allí, el administrador puede buscar cualquier usuario activo y cualquier evento publicado, crear una solicitud pendiente para esa persona y aprobarla, rechazarla o revocarla desde la misma pantalla.
- Cada evento de la lista incluye acceso directo a su gestión para que el administrador continúe el flujo autorizado.
- La creación administrativa queda asociada al administrador actuante dentro del registro de acceso existente y nunca requiere entrar en la sesión del empleado.
- La autorización continúa exclusivamente en backend: el administrador conserva la capacidad ya existente de operar cualquier evento y cada organizador solo opera los propios.
- El endpoint nuevo exige JWT y rol `admin`; el servicio repite esa validación y solo admite usuarios activos y eventos publicados.
- La operación modifica exclusivamente el permiso `scanner_access`. No edita el evento en vivo, mapa, sillas, inventario, entradas, ventas, precios, pagos ni la aplicación móvil.
- Validación local: dos pruebas específicas de permisos aprobadas y builds de NestJS y Next.js aprobados.

Estado: `IMPLEMENTADO Y COMPROBADO LOCALMENTE`; pendiente prueba manual con una sesión administrativa y publicación autorizada.

## 2026-09-05 - Recuperación de Analíticas en web y móvil

- Se reprodujo en la sesión autenticada de producción que `GET /api/analytics/summary` devuelve 500 y deja vacía la página administrativa.
- La causa es el alias SQL `order`, palabra reservada de PostgreSQL, introducido en las consultas financieras de Analíticas; se reemplazó por el alias seguro `ord` en el resumen y en las compras Klarna recientes.
- Web y móvil consumen la misma API. Ambos muestran ahora un error humano con acción `Reintentar` en vez de confundir una falla del servidor con ausencia de datos.
- Se agregó una prueba unitaria que exige el alias seguro y valida el resumen financiero resultante.
- No se modificaron visitas guardadas, ventas, pagos, Stripe, comisiones, órdenes ni datos de producción.

Estado: `IMPLEMENTADO Y COMPROBADO LOCALMENTE`; pendiente publicación autorizada y comprobación en producción.

## 2026-08-26 - Revocación irreversible de entradas por el organizador

- El detalle de un asistente permite seleccionar una, varias o todas sus entradas y exige motivo y confirmación antes de revocarlas.
- El organizador puede revocar liberando inmediatamente las sillas o conservarlas bloqueadas para emitir nuevas invitaciones desde `Bloqueos e Invitaciones`.
- Ticket, silla, mapa visual y auditoría se actualizan en una sola transacción con bloqueos de escritura; una solicitud repetida no duplica la revocación.
- Cada auditoría conserva actor, fecha, motivo, entradas, códigos QR, sillas y acción elegida.
- Los QR revocados responden inválidos al endpoint existente, por lo que el escáner móvil continúa mostrando `DENEGADO` sin modificar la aplicación móvil.
- Los tickets revocados se muestran como `REVOCADO` y quedan excluidos del reenvío. Órdenes, ventas, pagos, reembolsos, comisiones y reportes financieros permanecen intactos.
- La confirmación permanente reemplaza temporalmente el formulario de revocación; si se cancela o falla la solicitud, el formulario reaparece conservando la selección y el motivo.
- Validación local: 19 pruebas de `OrdersService`, build NestJS y build Next.js aprobados.

Estado: `IMPLEMENTADO Y COMPROBADO LOCALMENTE`; pendiente prueba manual y publicación autorizada.

## 2026-08-26 - Jerarquía cromática financiera en administración

- El dashboard administrativo elimina las superficies blancas del desglose financiero y usa fondos oscuros translúcidos con texto del mismo tono.
- Comisión Stripe se identifica en morado, ganancia LPTicket en verde, compras Klarna en rojo/rosa, ajuste adicional Klarna en ámbar y pendiente al organizador en rojo.
- El resumen exacto de cada evento aplica colores diferenciados a sus nueve métricas sin alterar valores ni fórmulas.
- En pagos al organizador, el ajuste Klarna queda naranja, el monto pagado verde y el saldo pendiente rojo, con etiquetas, cifras y notas consistentes.
- Se corrigió la prioridad de estilos que hacía que una regla global del panel convirtiera en gris las etiquetas, cifras y notas; cada texto conserva ahora el color vivo correspondiente a su tarjeta.
- No se modificaron cálculos, API, Stripe, Checkout, órdenes, entradas, móvil ni datos existentes.

Estado: `IMPLEMENTADO Y COMPROBADO LOCALMENTE`; pendiente revisión visual en producción.

## 2026-08-26 - Recuperación del dashboard administrativo y estilo de pagos

- Se comprobó en los registros de producción que `GET /api/admin/stats` fallaba con PostgreSQL `42601` porque las consultas financieras nuevas usaban `order`, una palabra reservada, como alias SQL sin escapar.
- Las consultas del dashboard, la conciliación automática de costos Stripe/Klarna y el registro de pagos al organizador usan ahora alias seguros.
- Si las estadísticas vuelven a fallar, el dashboard ya no queda completamente vacío: muestra un mensaje humano y una acción para reintentar.
- En el resumen exacto del evento se recuperó inicialmente la legibilidad de ajuste Klarna, pagado al organizador y pendiente por pagar; la jerarquía cromática posterior separa esos tres estados.
- No se modificaron fórmulas, montos, Checkout, tarifas, órdenes, entradas, móvil ni datos existentes.

Estado: `IMPLEMENTADO Y COMPROBADO` en producción.

## 2026-08-26 - Klarna en dashboard, analítica y saldo del organizador

- El dashboard administrativo muestra cuántas compras pagadas usaron Klarna, el total cobrado, el ajuste adicional real atribuido al organizador y el saldo exacto pendiente después de pagos ya registrados.
- La sección de Analíticas incorpora el mismo desglose para el periodo seleccionado y una lista reciente de compradores, eventos, entradas, totales y estado de conciliación.
- El resumen financiero por evento incluye compras Klarna, ajuste del organizador, monto ya pagado y monto pendiente.
- El saldo del organizador conserva una sola fórmula: venta nominal de entradas menos la diferencia positiva entre el costo real de Klarna y la base estándar de 2.9% + $0.30, menos pagos ya registrados.
- Una compra Klarna sin costo conciliado por Stripe bloquea el registro del pago al organizador, aunque la venta y la emisión de entradas continúan normalmente.
- No se modificaron Checkout, cuotas ofrecidas por Klarna, tarifas visibles al comprador, ventas históricas, móvil, Tap to Pay ni Venta en Puerta.

Estado: `IMPLEMENTADO, NO PROBADO EN PRODUCCIÓN`.

## 2026-08-26 - Selección visible de Klarna en el checkout web

- El resumen final de compra muestra una acción separada `Pagar en cuotas con Klarna` debajo del pago normal con tarjeta.
- La acción normal solicita una sesión Stripe solo con tarjeta y la acción Klarna solicita una sesión exclusivamente Klarna.
- Una compra no elegible muestra el error correspondiente y nunca cambia silenciosamente de Klarna a tarjeta.
- No cambia tarifas, inventario, emisión, móvil, Tap to Pay, Venta en Puerta ni ventas históricas.

Estado: `IMPLEMENTADO, NO PROBADO` contra una compra Klarna real.

## 2026-08-26 - Klarna aislado en Checkout web

- El Checkout público web puede ofrecer `card` y `klarna` en monedas compatibles; `KLARNA_WEB_ENABLED=false` permite volver inmediatamente a tarjeta sin cambiar código.
- Si la cuenta Stripe todavía no permite Klarna, la creación de la sesión reintenta con tarjeta para no interrumpir las ventas normales.
- Los cargos visibles al comprador conservan la política global existente. El backend obtiene del balance de Stripe el costo real de una orden Klarna y atribuye al organizador únicamente la diferencia positiva sobre 2.9% + $0.30.
- El panel financiero administrativo muestra el ajuste Klarna separado por evento y por orden. El registro de un pago al organizador queda protegido mientras Stripe no haya confirmado el costo real.
- Checkout ya no emite entradas cuando una sesión está completada pero aún no está pagada; contempla confirmación y fallo asíncronos, y mantiene la finalización idempotente.
- No se modificaron la app móvil, Tap to Pay, Venta en Puerta, ventas históricas, cálculo de cargos del comprador ni reembolsos.
- Validación local: 13 pruebas de `OrdersService`, build NestJS y build Next.js aprobados. No se ejecutó ninguna compra real ni cambio de producción.

Estado: `IMPLEMENTADO, NO PROBADO` contra una cuenta Stripe real.

## 2026-08-22 - Aislamiento de destinatarios rechazados en Zoho Campaigns

- La validación previa separa únicamente direcciones con sintaxis inválida; no usa listas de proveedores ni bloquea dominios privados válidos.
- La creación de la lista y la suscripción al Topic aíslan los rechazos por destinatario. Una dirección rechazada queda marcada como fallida con su motivo y no detiene la preparación ni el envío a las direcciones aceptadas.
- El nombre interno de la lista de Zoho se normaliza sin alterar el título ni el contenido visible de la campaña.
- El adaptador reconoce códigos de Zoho escritos en mayúsculas o minúsculas y conserva el código real del proveedor.
- El código `2007` devuelto por `listsubscribe` para una dirección que Zoho considera inválida también se registra como rechazo individual; ya no pausa a toda la audiencia.
- Se añadieron pruebas automatizadas de normalización, lectura de errores y continuidad después de un rechazo individual. No se envió ni reintentó ninguna campaña durante esta corrección.

Estado: `IMPLEMENTADO, NO PROBADO` en producción.

## 2026-08-22 - Seguimiento real y audiencias grandes en Zoho Campaigns

- El detalle de una campaña seleccionada consulta ahora el reporte oficial de destinatarios de Zoho y concilia aperturas, rebotes permanentes, rebotes temporales y correos no enviados con los estados guardados en LPTicket.
- Las campañas completadas de Zoho se actualizan en el panel cada minuto; el backend limita la consulta real al proveedor a una vez cada dos minutos y comparte solicitudes simultáneas.
- La preparación de audiencias se serializa globalmente y procesa como máximo 450 suscripciones por ventana de un minuto, por debajo del límite oficial de 500. Esto permite preparar 500 contactos sin provocar el bloqueo de 30 minutos de Zoho; la campaña se envía una sola vez cuando toda la audiencia queda lista.
- El historial y la campaña seleccionada reflejan inmediatamente las métricas reconciliadas. No se modificaron los correos transaccionales.

## 2026-08-22 - Reutilización correcta del token de Zoho Campaigns

- Se comprobó que el adaptador solicitaba un access token nuevo en cada llamada a Zoho. Un intento con 17 destinatarios supera el límite oficial de diez tokens por cada diez minutos y provoca `Access Denied`, aunque la reconexión OAuth haya terminado correctamente.
- `ZohoCampaignsService` conserva el access token durante su vigencia, aplica un margen de seguridad antes de vencer y comparte una sola solicitud entre llamadas simultáneas. Una reconexión invalida inmediatamente el token anterior.
- El panel distingue el límite temporal de tokens de una revocación real: indica esperar diez minutos y no muestra el botón de reconexión durante ese bloqueo.
- Se agregaron pruebas simuladas que confirman un solo intercambio de token para 25 llamadas consecutivas y para 20 llamadas simultáneas. Las pruebas no crean campañas, contactos ni envían correos.

## 2026-08-22 - Asociación real de audiencia y tema en Zoho Campaigns

- Se identificó la causa comprobada del fallo `6606`: las APIs usadas para crear o cargar listas añadían direcciones, pero no las suscribían al Topic de marketing. Zoho considera esa lista sin audiencia apta para la campaña y no envía ningún correo.
- `ZohoCampaignsService` ahora utiliza `json/listsubscribe` con `topic_id` para cada destinatario antes de crear el borrador de Zoho. Esto también repara la lista privada reutilizada de una campaña pausada, sin enviar el correo durante esa preparación.
- Se eliminó la carga adicional sin tema mediante `addlistsubscribersinbulk`; ya no puede crear destinatarios pendientes que Zoho no reconozca como audiencia del Topic.
- El panel ahora reconoce también los errores de permiso de `listsubscribe` y muestra directamente la acción `Reconectar Zoho Campaigns`, en lugar de dejar al administrador con un reintento que no puede completar.
- La conexión renovada almacenada cifrada en PostgreSQL ahora tiene prioridad sobre un token heredado de Railway. El panel consulta el estado vigente de Zoho, por lo que un error histórico no vuelve a mostrar falsamente que la conexión recién autorizada fue rechazada.
- Los correos transaccionales de registro, compra y tickets no fueron modificados.

Estado: `IMPLEMENTADO, NO PROBADO` contra la cuenta real de Zoho. Requiere publicar, reintentar una sola vez la campaña de 17 destinatarios y confirmar que Zoho acepta la audiencia antes de usar una campaña mayor.

## 2026-08-22 - Validación segura de audiencia en Zoho Campaigns

### Corrección
- La lista privada de 17 destinatarios fue comprobada directamente en Zoho Campaigns: existe y contiene los contactos; el fallo `6606` ocurre después, cuando Zoho no registra esa lista dentro del borrador de campaña.
- El backend ahora reutiliza una lista privada existente de la misma audiencia en lugar de crear una lista nueva con cada reintento fallido.
- La solicitud de campaña usa la forma documentada de `list_details`; el tema de consentimiento se conserva como parámetro independiente.
- Antes de llamar a `sendcampaign`, el backend consulta el borrador y comprueba que Zoho haya asociado la lista. Si no lo hizo, pausa la campaña sin enviar correos ni marcar destinatarios como enviados.
- La próxima reconexión de Zoho solicitará permisos de lectura además de creación y actualización, necesarios para comprobar listas y borradores.

### Áreas protegidas
- No se modificaron los correos transaccionales de registro, compra, tickets, pagos o recuperación de cuenta.
- No se envió ningún correo ni se ejecutó un reintento durante esta corrección.

### Estado
- IMPLEMENTADO, NO PROBADO

### Pendiente manual
- Publicar, pulsar una vez `Reconectar Zoho Campaigns` para aceptar los permisos ampliados y reintentar únicamente la campaña pendiente. El panel debe reutilizar la lista existente y detenerse antes de enviar si Zoho no confirma la audiencia.

## 2026-08-22 - Reconexión segura de Zoho Campaigns

### Corrección
- El seguimiento detectó que Zoho rechazó el refresh token existente con `Access Denied`; no se llegó a crear ni enviar la campaña de 17 destinatarios.
- El panel administrativo ahora ofrece `Reconectar Zoho Campaigns` cuando aparece ese estado. La autorización solicita únicamente los permisos necesarios para crear contactos y crear/enviar campañas.
- La reconexión genera una URL de consentimiento de corta duración, firmada por el backend. El Client Secret y los tokens nunca se muestran en la web; el nuevo refresh token se guarda cifrado en PostgreSQL.

### Áreas protegidas
- No se modificaron los correos transaccionales de registro, compra, tickets, pagos o recuperación de cuenta.
- No se enviaron correos ni se reintentó ninguna campaña durante esta corrección.

### Estado
- IMPLEMENTADO, NO PROBADO

### Pendiente manual
- El administrador debe pulsar `Reconectar Zoho Campaigns`, completar el consentimiento en Zoho y regresar al panel antes de reintentar una sola vez la campaña pendiente de 17 destinatarios.

## 2026-08-22 - Diagnóstico seguro de Zoho Campaigns

### Corrección
- Se corrigió la mayúscula obligatoria de la ruta `createCampaign` de Zoho. La ruta anterior devolvía un falso código 200 con el mensaje de recurso inexistente y detenía la campaña antes de enviarla.
- La integración ya no convierte una validación de Zoho en el mensaje genérico `INVALID_CAMPAIGN_RESPONSE`: conserva el código y el mensaje que devuelve el proveedor.
- Antes de crear una audiencia, consulta únicamente el tema de consentimiento llamado `default` de Zoho cuando la cuenta lo expone; no envía correos durante esa consulta.
- Se añadió la variable privada opcional `ZOHO_CAMPAIGNS_TOPIC_ID` para cuentas que requieren seleccionar un tema de consentimiento explícito.
- La lista de cada campaña se vincula explícitamente a ese tema dentro de `list_details`; evita el error 6606 de Zoho: "No hay listas seleccionadas para esta campaña".
- El panel explica el requisito de tema cuando Zoho devuelve la validación correspondiente.

### Áreas protegidas
- No se modificaron los correos transaccionales de registro, compra, tickets ni restablecimiento de contraseña.
- No se enviaron correos ni se reintentó ninguna campaña durante el diagnóstico.

### Configuración externa comprobada
- Se creó en Zoho Campaigns el tema de consentimiento `LPTicket promociones y novedades` y su identificador quedó configurado únicamente como variable privada de Railway.
- Railway confirmó que el backend activo recibió la variable; no se expuso ningún secreto ni se envió un correo durante esta configuración.

### Estado
- IMPLEMENTADO, NO PROBADO

### Pendiente manual
- Una vez publicado, reintentar únicamente la campaña pendiente de 17 destinatarios y confirmar que Zoho devuelve aceptación o un motivo específico antes de enviar una audiencia mayor.

## 2026-08-21 - Corrección de respuesta de Zoho Campaigns

### Corrección
- El adaptador de Zoho Campaigns ahora lee cada respuesta del proveedor una sola vez. Si Zoho devuelve texto o HTML en lugar de JSON, conserva el mensaje original para poder diagnosticarlo y no produce el error interno `Body is unusable`.
- Una campaña que falle durante esta preparación permanece pausada con sus destinatarios pendientes: no los marca como enviados ni los duplica al reintentar.
- El seguimiento administrativo muestra un motivo resumido cuando Zoho pausa una campaña antes de enviar, en lugar de dejar al administrador sin explicación.
- Cada intento crea una lista privada con un identificador único. Así, una lista huérfana de Zoho no bloquea el reintento de la misma campaña.
- La creación de listas y la carga de destinatarios usan el parámetro oficial `emailids` de Zoho Campaigns, con un máximo de diez correos por solicitud.
- La integración solicita el formato oficial `JSON` y reconoce las claves reales que devuelve Zoho (`listkey` y `campaignKey`), incluyendo respuestas envueltas por el proveedor.

### Áreas protegidas
- No se modificaron los correos transaccionales de registro, compra, tickets, pagos o recuperación de cuenta.

### Estado
- IMPLEMENTADO, NO PROBADO

### Pendiente manual
- Reintentar la campaña de 17 destinatarios una vez publicada y confirmar la respuesta real de Zoho Campaigns antes de enviarla a una audiencia mayor.

## 2026-08-21 - Conexión segura con Zoho Campaigns

### Corrección
- Las campañas nuevas dejan de usar el SMTP normal de Zoho Mail, que bloqueó el envío masivo, y pasan a Zoho Campaigns.
- El backend crea la audiencia privada y envía la campaña completa mediante Zoho Campaigns, sin repetir destinatarios ni exigir lotes manuales de 100.
- La autorización OAuth guarda el refresh token cifrado en PostgreSQL; las claves de cliente solo viven en variables privadas de Railway y nunca en Git.
- Zoho carga el mismo correo premium existente desde un endpoint público de contenido, incluidos el arte y las acciones actuales.

### Estado
- IMPLEMENTADO, NO PROBADO

### Comprobación externa
- La autorización OAuth quedó completada en Railway sin exponer el token.
- Aún falta la primera campaña de prueba a una audiencia pequeña para confirmar aceptación, entrega y métricas de Zoho Campaigns.

## 2026-08-21 - Historial por destinatario para Email Marketing

### Corrección
- Cada nueva campaña guarda un registro único por destinatario antes de enviar, por lo que el panel muestra exactamente quién está enviado, pendiente, rechazado o abierto.
- Las campañas procesan un máximo de 100 destinatarios por lote; el administrador puede continuar con el siguiente lote sin repetir correos ya enviados.
- Se añadió seguimiento de apertura mediante un píxel individual, indicado como aproximado porque algunos proveedores lo bloquean o precargan.
- El panel de seguimiento queda visible incluso antes de registrar la primera campaña. La conciliación del envío histórico de Zoho reutiliza las tablas existentes y no modifica el esquema de base de datos.
- El panel conserva un historial de hasta 50 campañas: cada campaña se puede abrir para revisar sus destinatarios y métricas, sin depender de que exista una “última campaña”. Si el backend no responde, la web muestra el error en vez de ocultar el historial.
- Cada campaña completada o pausada se puede eliminar desde el historial tras confirmación; se borran únicamente esa campaña y sus métricas, no usuarios ni otras campañas. Las campañas que aún están enviando quedan protegidas.

### Límites transparentes
- `Enviado` confirma que Zoho SMTP aceptó el mensaje; no prueba por sí solo la entrega en la bandeja de entrada.
- Los rebotes que lleguen después desde el proveedor no se pueden marcar automáticamente sin una integración de eventos o webhook del proveedor de correo.

### Estado
- IMPLEMENTADO, NO PROBADO

### Pendiente manual
- Publicar, enviar una prueba a dos destinatarios y confirmar: el primer lote, la actualización de estados, el siguiente lote, la apertura y que no se reenvíe un destinatario ya enviado.

## 2026-08-21 - Envío masivo de Email Marketing estabilizado

### Corrección
- Las campañas de email ya no esperan cada destinatario en serie: se procesan en grupos controlados de cinco correos y reutilizan conexiones SMTP.
- Los destinatarios se deduplican por correo y la administración informa el total enviado y el total que no se pudo entregar.

### Áreas protegidas
- No se modificaron destinatarios, contenido de campañas, enlaces, permisos ni envíos individuales.

### Estado
- IMPLEMENTADO, NO PROBADO

### Pendiente manual
- Antes de reenviar la campaña completa, revisar quiénes ya la recibieron y enviar una prueba a un grupo pequeño para confirmar la entrega sin duplicados.

## 2026-08-21 - Descarga de la app desde Email Marketing

### Corrección
- Los correos de Marketing y su vista previa ahora incluyen, debajo de la acción principal, un acceso visual a la aplicación móvil de LPTicket en App Store.

### Áreas protegidas
- No se modificaron el botón principal, enlaces de campañas, destinatarios ni el envío de correos.

### Estado
- IMPLEMENTADO, NO PROBADO

### Pendiente manual
- Enviar una campaña de prueba y confirmar que el enlace abre la ficha oficial de LPTicket en App Store.

## 2026-08-21 - Información premium en detalle de evento móvil web

### Corrección
- Fecha, hora y lugar ahora forman una única superficie visual en el detalle público del evento, con separadores naranjas discretos y mejor lectura de direcciones largas.
- La acción para compartir se simplificó a un botón sobrio, compacto y coherente con la identidad oscura de la página.

### Áreas protegidas
- No se modificaron eventos, disponibilidad, compra, mapas, precios, enlaces ni el comportamiento de compartir.

### Estado
- IMPLEMENTADO, NO PROBADO

### Pendiente manual
- Abrir un evento desde navegador móvil y confirmar la lectura con nombres y direcciones cortas y largas.

## 2026-08-21 - Lectura premium en correos de Marketing

### Corrección
- El mensaje de una campaña ahora admite varios párrafos desde Administración > Marketing.
- El correo y su vista previa muestran el texto alineado a la izquierda dentro de un bloque editorial con borde naranja, espaciado y tipografía de lectura.

### Áreas protegidas
- No se modificaron destinatarios, permisos, enlaces, arte cargado ni el envío de campañas.

### Estado
- IMPLEMENTADO, NO PROBADO

### Pendiente manual
- Enviar una campaña de prueba a un destinatario seleccionado y revisar la lectura en móvil y escritorio.

## 2026-08-21 - Barra limpia para recibos de orden

### Corrección
- Los recibos de orden ya no muestran el encabezado, pie, descargas, scan, selector de idioma, perfil ni botones flotantes de la plataforma.
- Solo conservan `Volver` y `Imprimir / Guardar PDF`, con el botón negro y texto blanco como la entrada de referencia.
- Apple Wallet y Compartir permanecen exclusivamente en las entradas individuales.

### Áreas protegidas
- No se modificaron tickets, órdenes, pagos, QR, autenticación ni la barra de las entradas individuales.

### Estado
- IMPLEMENTADO, NO PROBADO

### Pendiente manual
- Abrir un recibo de orden en escritorio y móvil; confirmar que no aparezca UI global y que la impresión siga funcionando.

## 2026-08-21 - Colores del recibo por orden corregidos

### Corrección
- La cabecera y el pie del recibo por orden ya no heredan los estilos globales del encabezado y pie del sitio.
- Se restauran los colores de referencia: cabecera blanca y pie azul LPTicket `#0A375A`, sin negro ni marrón.

### Áreas protegidas
- No se modificaron órdenes, tickets, pagos, QR, datos ni el diseño de las demás páginas.

### Estado
- IMPLEMENTADO, NO PROBADO

### Pendiente manual
- Recargar un recibo de orden y revisar pantalla e impresión/PDF contra la referencia entregada.

## 2026-08-21 - Diseño unificado de recibos de orden

### Corrección
- El recibo por orden ahora reutiliza la identidad visual de la entrada original de LPTicket: logo oscuro/naranja legible al imprimir, QR, cabecera, franja naranja/azul, bloques de datos y pie institucional.
- Toda la información de la orden permanece en una sola página cuando su contenido cabe en ella; las órdenes con varias entradas conservan cada código y no pierden datos.

### Áreas protegidas
- No se modificaron órdenes, tickets, pagos, cálculos, permisos, QR ni base de datos.

### Estado
- IMPLEMENTADO, NO PROBADO

### Pendiente manual
- Abrir un recibo de orden de una y de varias entradas, revisar su impresión/PDF y confirmar la legibilidad del logo y QR.

## 2026-08-21 - Recibo unificado desde el historial administrativo

### Corrección
- Cada boleto del historial administrativo ahora abre la entrada individual existente de LPTicket, reutilizando su diseño, QR y formato de impresión ya establecido.
- Se eliminó el acceso desde ese historial a la página distinta de recibo por orden; no se creó ni cambió otro formato de comprobante.

### Áreas protegidas
- No se modificaron órdenes, tickets, pagos, datos, permisos ni el diseño existente de la entrada individual.

### Estado
- IMPLEMENTADO, NO PROBADO

### Pendiente manual
- Desde un usuario con compras, pulsar una entrada y confirmar que abre `/verify/<código>` con el diseño original y una impresión legible.

## 2026-08-21 - Detalle y recibo desde el historial administrativo

### Corrección
- Cada boleto del perfil administrativo ahora muestra el nombre y la fecha real de su evento, usando la información ya entregada por el backend.
- Cada tarjeta de boleto es seleccionable y abre el recibo de la orden correspondiente; los administradores ya están autorizados para consultarlo.

### Áreas protegidas
- No se modificaron órdenes, tickets, pagos, permisos, usuarios ni base de datos.

### Estado
- IMPLEMENTADO, NO PROBADO

### Pendiente manual
- Abrir el historial de un cliente, comprobar nombre y fecha del evento y pulsar una entrada para confirmar que abre su recibo correcto.

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
