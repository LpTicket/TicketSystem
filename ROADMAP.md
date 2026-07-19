# LPTicket - Roadmap

Última revisión: 2026-07-19

## Funcionalidades Terminadas

- Autenticación por email y contraseña.
- JWT y refresh tokens.
- Eventos públicos.
- Creación y gestión de eventos.
- Categorías.
- Banners de inicio.
- Mapas, secciones y asientos.
- Compra online con Stripe Checkout.
- Tickets QR.
- Escaneo de tickets.
- Panel de organizador.
- Panel administrativo.
- Social Match y chat.
- Marketing por email, SMS, WhatsApp y push.
- Ventas en puerta.
- Base técnica para Tap to Pay.
- Apple Wallet y Google Wallet a nivel de código.

## Funcionalidades en Desarrollo

- Validación completa de Tap to Pay en iPhone.
- Flujo de educación y términos de Tap to Pay.
- Optimización de cargas de mapas, eventos y paneles.
- Revisión de sincronización de bloqueos desde móvil, web y vista cliente.

## Funcionalidades Planificadas

- Migraciones TypeORM versionadas.
- Pruebas automatizadas para pagos, tickets, mapas y permisos.
- Mejor manejo de imágenes pesadas.
- Mayor observabilidad de errores y rendimiento.
- Revisión de autenticación web mediante cookies `httpOnly`.

## Ideas Futuras

- Recomendaciones de eventos más personalizadas.
- Mejoras de descubrimiento geográfico.
- Automatización avanzada de marketing.
- Estadísticas más detalladas por evento.
- Experiencias sociales ampliadas.
- Herramientas adicionales para equipos de puerta.
- Flujos de soporte y ayuda contextual mejorados.

## Mejoras Técnicas

### Prioridad Alta

- Reemplazar `synchronize: true` por migraciones controladas.
- Crear pruebas funcionales para pagos, emisión de tickets y bloqueos.
- Verificar el comportamiento de caché con múltiples instancias backend.
- Revisar permisos críticos en backend.

### Prioridad Media

- Reducir peso de imágenes Base64.
- Separar datos pesados de respuestas frecuentes.
- Mejorar cobertura de errores y telemetría.
- Consolidar helpers compartidos entre web y móvil cuando sea seguro.

### Prioridad Baja

- Revisar componentes antiguos o duplicados.
- Mejorar documentación interna de DTOs y servicios.
- Limpiar configuraciones obsoletas confirmadas.

## Mejoras de Rendimiento

### Prioridad Alta

- Mantener caché segura para eventos, mapas, paneles y Social Match.
- Medir cargas lentas antes de crear más caché.
- Evitar llamadas repetidas en móvil y web.
- Confirmar invalidación inmediata tras ventas, bloqueos y cambios de evento.

### Prioridad Media

- Optimizar carga de imágenes.
- Reducir tamaño de respuestas.
- Revisar consultas administrativas pesadas.

### Prioridad Baja

- Optimizar elementos visuales secundarios.
- Revisar precargas no críticas.

## Mejoras de Seguridad

### Prioridad Alta

- Migraciones controladas de base de datos.
- Auditoría continua de autorización en rutas sensibles.
- Mantener secretos fuera del repositorio y documentación.

### Prioridad Media

- Planificar migración web a cookies `httpOnly`.
- Añadir pruebas específicas para roles y propiedad de recursos.

### Prioridad Baja

- Revisar endurecimientos adicionales tras estabilizar flujos críticos.

## Integraciones Futuras

### Prioridad Alta

- Completar aprobación y validación de Tap to Pay.
- Confirmar configuración de Stripe Terminal.

### Prioridad Media

- Mejorar integración operativa de Apple Wallet y Google Wallet.
- Mejorar seguimiento de entrega para campañas de marketing.

### Prioridad Baja

- Evaluar nuevas integraciones solo cuando resuelvan una necesidad comercial real.

## Criterio de Priorización

Antes de iniciar una iniciativa, evaluar riesgo para producción, impacto en seguridad, impacto para clientes y organizadores, impacto comercial, dependencias externas, esfuerzo técnico y riesgo de romper funciones existentes.
