# Hitos del Proyecto Rockomix PartyKit

## Estado general

**Fase actual:** Reconstrucción funcional sobre infraestructura PartyServer.

La infraestructura base ya quedó integrada y validada. A partir de este punto los siguientes trabajos corresponden principalmente a recuperar funcionalidades existentes de Rockomix Producción utilizando PartyServer como infraestructura.

---

# Hito 0 - Preparación del proyecto
## Estado: ✅ COMPLETADO

### Objetivo
Reconstruir una copia limpia del proyecto original para iniciar la migración de forma controlada.

### Logros

- Se creó el repositorio `rockomix-partykit`.
- Se copió la estructura base de MyKaraoke Original.
- Se conservaron los nombres y organización originales.
- Se restauró la configuración inicial del proyecto.
- Se documentó la arquitectura inicial.

---

# Hito 1 - Restauración del entorno
## Estado: ✅ COMPLETADO

### Objetivo

Lograr que el proyecto vuelva a iniciar correctamente.

### Logros

- Restauración de `.env.local`.
- Restauración de variables originales.
- Corrección de validación de entorno.
- Prisma vuelve a inicializar correctamente.
- Base de datos conectada.
- Next.js inicia sin errores.

Validaciones realizadas:

- ✅ `pnpm dev`
- ✅ Prisma
- ✅ PostgreSQL

---

# Hito 2 - Integración de PartyServer
## Estado: ✅ COMPLETADO

### Objetivo

Sustituir la creación de salas mediante PartyKit por PartyServer utilizando Durable Objects.

### Logros

- Se añadió `wrangler.jsonc`.
- Se añadió el Worker local.
- Se configuró Durable Objects.
- Se validó el endpoint:

```
POST /party/{hash}
```

- Se comprobó que el Worker inicializa correctamente una sala.
- Se comprobó almacenamiento en Durable Objects.
- Se mantuvo el contrato HTTP utilizado por la aplicación.

Validaciones realizadas:

- ✅ Wrangler local
- ✅ Worker
- ✅ Durable Objects
- ✅ POST manual mediante `curl.exe`

---

# Hito 3 - Flujo Crear Party
## Estado: ✅ COMPLETADO

### Flujo validado

```
Next.js

↓

tRPC

↓

Prisma

↓

PartyServer

↓

Durable Object

↓

Player
```

### Logros

- Se crea correctamente el registro en Prisma.
- Se genera el hash.
- Se inicializa la sala en PartyServer.
- El Worker responde correctamente.
- La aplicación navega automáticamente al Player.
- Se eliminó la dependencia de PartyKit para este flujo.

Validaciones realizadas

- ✅ Crear Party
- ✅ Entrada al Player

---

# Hito 4 - Restauración del flujo local
## Estado: ✅ COMPLETADO

### Objetivo

Recuperar el comportamiento utilizado por Rockomix Producción durante el desarrollo local.

### Logros

- Restauración de `cache.ts`.
- Se respetó la variable:

```
USE_VERCEL_KV=false
```

- El desarrollo local ya no depende de Vercel KV.
- Se recuperó el comportamiento utilizado en Producción.

Validaciones realizadas

- ✅ Búsqueda de canciones
- ✅ Resultados visibles en el Player

---

# Hito 5 - Funcionalidades pendientes
## Estado: 🟡 EN PROGRESO

### Pendientes inmediatos

- Agregar canción a la playlist.
- Sincronización Host.
- Sincronización Invitado.
- Broadcast de cambios.
- QR apuntando a URL pública.
- Bootstrap para invitados.

---

# Prioridad de referencias

## Infraestructura

Fuente principal:

- PartyServer oficial 2026.

Utilizar únicamente para:

- Durable Objects.
- Worker.
- WebSockets.
- Storage.
- Broadcast.
- Ciclo de vida.

---

## Lógica de aplicación

Fuente principal:

- Rockomix Producción.

Utilizar para:

- Playlist.
- Roles.
- QR.
- Bootstrap.
- Invitados.
- Caché.
- Flujo funcional.

---

## Estado actual

Infraestructura:

- ✅ Estable.

Aplicación:

- 🟡 En recuperación funcional.

Siguiente objetivo:

```
Agregar canciones a la playlist utilizando PartyServer como backend de sincronización.
```