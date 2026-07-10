# Hitos del Proyecto
## Rockomix-Partykit

Última actualización: Julio 2026

---

# Hito A0 — Preparación del Proyecto ✅

## Objetivo

Definir la estrategia definitiva de reconstrucción.

## Resultado

- Se descartó la reconstrucción desde un proyecto vacío.
- Se decidió utilizar MyKaraoke Original como base del proyecto.
- Se establecieron las tres fuentes oficiales del proyecto:
  - MyKaraoke Original (Producto)
  - PartyKit / PartyServer Oficial 2026 (Infraestructura)
  - Rockomix Producción (Experiencia)

Estado:

✅ COMPLETADO

---

# Hito A1 — Reconstrucción del Proyecto Base ✅

## Objetivo

Reconstruir Rockomix-Partykit utilizando exactamente la estructura del proyecto original.

## Resultado

Se copiaron correctamente:

- party/
- prisma/
- public/
- src/
- scripts/
- .github/

junto con los archivos de configuración originales.

No se copiaron archivos generados ni específicos del entorno.

Estado:

✅ COMPLETADO

---

# Hito A2 — Variables de Entorno ✅

## Objetivo

Recuperar el contrato original de variables de entorno.

## Variables restauradas

- DATABASE_URL
- DATABASE_URL_NON_POOLING
- YOUTUBE_API_KEY
- NEXT_PUBLIC_PARTYKIT_URL

Variables auxiliares disponibles:

- USE_VERCEL_KV

Variables reservadas para etapas posteriores:

- NEXT_PUBLIC_WORKER_URL
- GUEST_PUBLIC_URL

Estado:

✅ COMPLETADO

---

# Hito A3 — Arranque del Proyecto ✅

## Objetivo

Conseguir que el proyecto original iniciara correctamente.

## Resultado

Next.js inicia correctamente.

Resultado observado:

- Servidor iniciado.
- Página principal accesible.
- Compilación correcta.

Estado:

✅ COMPLETADO

---

# Hito A4 — Recuperación de Prisma ✅

## Objetivo

Restaurar Prisma Client.

## Problema encontrado

Windows mantenía bloqueado el motor de Prisma.

Error:

EPERM

Durante:

prisma generate

## Solución

- detener procesos Node
- regenerar Prisma Client

Resultado:

✔ Prisma Client generado correctamente.

Estado:

✅ COMPLETADO

---

# Hito A5 — Base de Datos Operativa ✅

## Objetivo

Comprobar que la aplicación podía comunicarse con PostgreSQL.

## Resultado

Prisma ejecutó correctamente:

- BEGIN
- INSERT INTO Party
- UPDATE Party
- COMMIT

Se creó correctamente un registro Party.

Estado:

✅ COMPLETADO

---

# Hito A6 — Primer Flujo Funcional ✅

## Objetivo

Verificar el flujo completo hasta la creación de una Party.

## Flujo alcanzado

Usuario

↓

Next.js

↓

tRPC

↓

Prisma

↓

PostgreSQL

↓

PartyKit

## Resultado

La Party se crea correctamente en la base de datos.

El flujo únicamente falla al intentar comunicarse con PartyKit.

Error observado:

tRPC failed on party.create

fetch failed

Conclusión:

Toda la aplicación funciona hasta el punto donde comienza la comunicación con PartyKit.

Estado:

✅ COMPLETADO

---

# Estado Actual

## Infraestructura funcionando

✅ Next.js

✅ React

✅ tRPC

✅ Prisma

✅ PostgreSQL

✅ Variables de entorno

---

## Infraestructura pendiente

⬜ PartyKit

⬜ PartyServer

⬜ Cloudflare Worker

⬜ Durable Objects

---

# Próximo Hito

## Hito B1 — Diagnóstico de PartyKit

Objetivo:

Identificar exactamente dónde comienza la comunicación con PartyKit.

Determinar:

- qué función realiza el primer fetch
- qué endpoint intenta utilizar
- qué información espera recibir
- qué deberá sustituirse por PartyServer

Sin modificar todavía el comportamiento de la aplicación.

---

# Objetivo Final

Conseguir que Rockomix mantenga el comportamiento funcional de MyKaraoke Original utilizando infraestructura oficial PartyServer / Cloudflare 2026, incorporando posteriormente las mejoras propias de Rockomix:

- Branding
- Host
- Co-host
- Mejoras UX
- Funciones adicionales