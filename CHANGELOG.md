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

## 2026-07-26 - Diseño Poster Event Ticket para Apple Wallet

### Funcionalidad desarrollada
- Se preparó localmente el pase moderno de Apple Wallet con formato vertical tipo póster.
- El pase toma primero el flyer principal del evento y genera las tres resoluciones de `artwork` requeridas para Wallet.
- Se añadieron los datos semánticos del evento, asistente y asiento para que iOS organice la fecha, hora y ubicación de asiento en el formato nuevo.
- El pase clásico con su banner horizontal se conserva como respaldo para dispositivos que no muestren el diseño nuevo.

### Archivos modificados
- `/Users/sundingalue/Documents/TicketSystem/backend/src/common/services/wallet.service.ts`
- `/Users/sundingalue/Documents/TicketSystem/PROJECT_STATUS.md`
- `/Users/sundingalue/Documents/TicketSystem/CHANGELOG.md`

### Problema solucionado
- El diseño anterior solo incluía una franja horizontal y no podía aprovechar la composición vertical de flyer ni la jerarquía visual de los Poster Event Tickets de Apple.

### Riesgos encontrados
- Apple Wallet decide el renderizado final según la versión de iOS y los datos disponibles del evento.
- Para ver el cambio en un iPhone real, se debe publicar el backend y volver a añadir un pase recién generado.

### Estado de pruebas
- IMPLEMENTADO, NO PROBADO

### Pruebas ejecutadas
```bash
cd /Users/sundingalue/Documents/TicketSystem/backend
./node_modules/.bin/tsc -p tsconfig.build.json --noEmit --pretty false
```

Resultado: pasó sin errores.

### Observaciones
- No se modificó Google Wallet, pagos, tickets, credenciales ni la aplicación móvil.

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
