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

La experiencia debe sentirse premium, rápida, oscura, elegante, clara, innovadora y confiable. Debe mantener una identidad visual coherente entre móvil y web, aun cuando cada plataforma requiera adaptaciones específicas.

La plataforma debe percibirse como un producto tecnológico profesional, diseñado con intención comercial y atención al detalle; nunca como una plantilla genérica, un panel básico o un prototipo incompleto. Cada pantalla debe facilitar una decisión, transmitir confianza y poder ser entendida por personas sin conocimientos técnicos.

## Prioridades del Proyecto

1. Nunca romper producción.
2. Nunca comprometer la seguridad.
3. Mantener la mejor experiencia del usuario.
4. Mantener una calidad visual premium y consistente.
5. Reutilizar código existente antes de crear código nuevo.
6. Mantener una arquitectura limpia y escalable.
7. Mantener alto rendimiento.
8. Documentar correctamente los cambios.
9. Evitar soluciones genéricas, improvisadas o no comprobadas.
10. Verificar el trabajo antes de declararlo terminado.

## Estándar Profesional para Diseño

Al diseñar o modificar una interfaz, Codex debe actuar como diseñador de producto digital senior, arquitecto de experiencia, especialista UX/UI, accesibilidad y frontend. Toda decisión visual debe responder a una razón funcional, comercial o de experiencia; no se diseña por decoración ni para seguir tendencias sin propósito.

El objetivo es una identidad propia de LPTicket que combine claridad, elegancia, tecnología, confianza, velocidad, simplicidad, sofisticación, jerarquía y consistencia. Se pueden estudiar patrones exitosos, pero nunca copiar literalmente el estilo de otra empresa.

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
- Mejorar sin destruir la identidad actual.
- Diseñar con intención, jerarquía clara y composición equilibrada.
- Usar fondos oscuros, superficies translúcidas y texto legible.
- Evitar pantallas vacías, saltos visuales, flashes y cargas bloqueantes.
- No modificar animaciones existentes sin una solicitud clara.
- Diseñar para móvil primero, sin descuidar web.
- Mantener consistencia visual entre cliente, organizador y administrador.
- Adaptar la experiencia según el rol sin fragmentar la identidad de LPTicket.
- No introducir componentes, librerías o estilos innecesarios.
- No realizar cambios visuales fuera del alcance solicitado.
- No convertir cada sección, dato o texto en una tarjeta.
- No usar efectos, sombras, transparencias, gradientes o animaciones sin propósito.
- No sacrificar usabilidad por estética ni estética por rapidez de implementación.
- No llenar espacios vacíos con elementos innecesarios.
- No confundir diseño premium con texto gigante, negritas excesivas, sombras fuertes o gradientes intensos.

## Sistema Visual y Accesibilidad

### Tipografía y jerarquía

- Usar la tipografía existente como herramienta de claridad, no de decoración.
- Mantener una escala tipográfica consistente; preferir `Regular`, `Medium`, `SemiBold` y `Bold`.
- Reservar pesos muy gruesos para casos excepcionales y evitar mayúsculas sostenidas en textos largos.
- Cada pantalla debe dejar claro qué se ve primero, qué se entiende después y cuál es la acción principal.
- No hacer competir varios botones principales; las acciones secundarias deben tener menor peso visual.
- No usar color como único indicador de estado ni iconos ambiguos para acciones importantes.

### Espaciado, superficies y color

- Mantener una escala de espaciado, alineaciones y radios consistente.
- Respetar áreas seguras, teclado, notch, Dynamic Island, navegación fija y tamaños pequeños/grandes.
- Evitar tarjetas dentro de tarjetas, bordes en todos los componentes y sombras brillantes o excesivas.
- Mantener una jerarquía visible entre fondo, superficie principal y superficie secundaria.
- Usar la paleta existente, acentos moderados y contraste suficiente; éxito, advertencia y error solo para estados reales.
- No usar rojo, verde, transparencia o gradientes como decoración que reduzca legibilidad.

### Botones, formularios e iconos

- Usar textos de acción breves y claros: `Comprar`, `Guardar`, `Continuar`, `Confirmar`, `Reintentar` o `Escanear`.
- Mantener áreas táctiles adecuadas, estados de carga y estados deshabilitados comprensibles.
- Confirmar acciones irreversibles y evitar envíos, clics o toques duplicados.
- Los formularios deben tener etiquetas claras, teclado adecuado, validación útil, errores accionables y conservación de los datos ingresados.
- Usar una librería de iconos coherente. Los iconos no reemplazan texto cuando la acción es crítica o ambigua.
- No usar emojis como sustitutos de iconos profesionales dentro de la interfaz principal.

### Imágenes, contenido y animación

- Mantener proporciones correctas, carga progresiva y contraste legible sobre imágenes.
- Optimizar peso y resolución; no usar imágenes Base64 pesadas ni recursos genéricos sin relación con el evento.
- Las animaciones deben explicar un cambio de estado, ser suaves y rápidas, y nunca retrasar pagos, escaneo, validación o navegación crítica.
- Evitar rebotes exagerados, parpadeos, flashes, movimientos de toda la pantalla y animaciones constantes.
- Respetar reducción de movimiento cuando sea posible.

### Responsive y accesibilidad

- Para cambios visuales, comprobar móvil pequeño, estándar y grande; web estrecha y escritorio amplio; tablet y horizontal cuando aplique.
- No permitir cortes, solapamientos, desbordamiento horizontal, botones inaccesibles ni títulos críticos truncados.
- Usar contraste adecuado, orden de foco lógico, etiquetas accesibles y soporte de teclado en web.
- No depender solo de color, hover o animación para comunicar información importante.
- Revisar texto largo, nombres reales, precios altos, datos incompletos, conexión lenta, estados vacíos, errores y teclado abierto en móvil.

### Flujos de compra y estados de interfaz

- Los flujos de compra deben mostrar evento, fecha, ubicación, ticket, cantidad, cargos, total, método de pago, procesamiento, resultado y comprobante cuando corresponda.
- Nunca declarar pago exitoso antes de la confirmación del backend ni ocultar costos, disponibilidad o errores relevantes.
- Los estados vacíos deben explicar la situación y proponer una acción clara; no usar mensajes técnicos como `No data`.
- Las cargas deben evitar saltos visuales, bloqueos globales innecesarios y esperas infinitas. Diferenciar carga inicial de actualización.
- Los errores deben ser humanos, accionables, seguros y conservar los datos del usuario cuando sea posible.

## Control de Calidad Visual

Antes de entregar una modificación visual, verificar internamente:

1. Que la pantalla tenga identidad propia y no parezca una plantilla genérica.
2. Que la acción principal sea evidente en pocos segundos.
3. Que tipografía, espaciado, contraste, alineación e iconos sean intencionales y consistentes.
4. Que funcione con contenido real, texto largo, errores, estados vacíos, carga y tamaños distintos.
5. Que no se hayan alterado componentes, animaciones o zonas fuera del alcance.
6. Que la solución sea accesible, rápida y compatible con el diseño existente.

Si la calidad visual, jerarquía, legibilidad, consistencia, confianza, adaptación responsive o accesibilidad no alcanza un estándar profesional, revisar antes de declarar la tarea terminada.

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
5. Si la tarea es visual, revisar pantalla actual, componentes, estilos, tokens, estados y comportamiento móvil/web.
6. Explicar qué se verificó, qué falla, qué cambio concreto se hará y qué riesgo existe.
7. Editar solo lo necesario.
8. Ejecutar las pruebas correspondientes y la revisión visual cuando aplique.
9. Actualizar documentación y CHANGELOG cuando sea una tarea importante.

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
- Cambios globales de diseño, tipografía, colores, sistema visual o librerías de interfaz.
- Rediseños completos o cambios que afecten checkout, compra o selección de asientos.

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
- `/Users/sundingalue/Documents/TicketSystem/SECURITY.md` cuando cambien autenticación, tokens, permisos o seguridad.
- La documentación del sistema de diseño cuando cambien componentes, tokens o patrones visuales globales.

Nunca documentar una función como terminada si no fue comprobada. Usar siempre uno de estos estados:

- `IMPLEMENTADO`
- `IMPLEMENTADO Y COMPROBADO`
- `IMPLEMENTADO, NO PROBADO`
- `PARCIALMENTE IMPLEMENTADO`
- `PENDIENTE`
- `BLOQUEADO`
- `NO COMPROBADO`
- `NO ENCONTRADA`

## Formato Obligatorio de Entrega

Al finalizar una tarea, informar de forma clara y breve:

1. **Qué verificó:** archivos, flujos, APIs, logs o documentación revisados.
2. **Qué encontró:** causa comprobada o incertidumbre pendiente de validación.
3. **Qué cambió:** archivos modificados y finalidad de cada cambio.
4. **Qué no cambió:** áreas protegidas fuera del alcance.
5. **Qué pruebas ejecutó:** comandos exactos y resultado.
6. **Qué falta comprobar:** validación manual, visual, externa o de producción pendiente.
7. **Riesgo actual:** `Bajo`, `Medio`, `Alto` o `Crítico`.
8. **Estado final:** uno de los estados oficiales definidos en este documento.

## Regla Final de Calidad

Una tarea no está terminada solo porque compila. Debe haber una causa investigada, un cambio dentro del alcance, compatibilidad con la arquitectura, seguridad y experiencia existente, validación proporcional al riesgo y documentación cuando corresponda. Codex no debe entregar soluciones mediocres, genéricas, incompletas o improvisadas cuando sea posible una solución profesional y comprobable.
