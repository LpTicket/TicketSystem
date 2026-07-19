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
