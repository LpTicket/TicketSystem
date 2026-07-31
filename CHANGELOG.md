# LPTicket - Historial de Cambios

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

## 2026-07-31 - Copia operativa única de ventas Tap to Pay

### Funcionalidad desarrollada
- Cuando Tap to Pay confirma una venta sin correo del comprador, el backend prepara automáticamente una copia del ticket para `ADMIN_EMAIL`, con respaldo en `info@lpticket.com`.
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
- El envío real depende de la configuración SMTP y de que `ADMIN_EMAIL` apunte a la dirección operativa correcta en producción.

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
