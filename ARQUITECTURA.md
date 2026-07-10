# Arquitectura del Proyecto
## Rockomix-Partykit

Última actualización: Julio 2026

---

# Objetivo

Reconstruir Rockomix utilizando como base el proyecto original **MyKaraoke** de EMPZ, sustituyendo progresivamente la infraestructura de PartyKit clásico por la infraestructura oficial PartyServer / Cloudflare 2026.

El objetivo NO es reescribir la aplicación.

El objetivo es conservar el comportamiento original y reemplazar únicamente la infraestructura.

---

# Fuentes de Verdad

El proyecto utiliza tres fuentes claramente diferenciadas.

## 1. MyKaraoke Original (Autoridad del Producto)

Repositorio base.

Responsable de definir:

- comportamiento funcional
- flujo de usuario
- estructura de la aplicación
- UI
- API
- Playlist
- reproducción
- búsqueda
- Prisma
- tRPC
- Party original

Todo lo relacionado con el funcionamiento del producto debe provenir de esta fuente.

Nunca debe modificarse por intentar seguir ejemplos oficiales.

---

## 2. PartyKit / PartyServer Oficial 2026 (Autoridad de Infraestructura)

Repositorio oficial.

Responsable únicamente de definir:

- Cloudflare Worker
- Durable Objects
- Wrangler
- PartyServer
- bindings
- migraciones
- runtime oficial
- patrones modernos de infraestructura

Nunca define lógica de negocio.

Nunca define comportamiento del producto.

Nunca sustituye MyKaraoke como referencia funcional.

---

## 3. Rockomix Producción (Experiencia)

Repositorio de producción.

No es autoridad.

Sirve únicamente como evidencia de soluciones previamente implementadas.

Ejemplos:

- Branding Rockomix
- Worker Cloudflare
- migración previa
- Co-host
- mejoras locales
- bootstrap de red
- integración previa

Toda decisión tomada desde producción debe validarse contra las dos fuentes oficiales anteriores.

---

# Estrategia Definitiva

Inicialmente se intentó construir el proyecto desde una estructura mínima.

Después de múltiples iteraciones se concluyó que esa estrategia alejaba el proyecto del objetivo principal.

Se adopta la siguiente estrategia definitiva:

1.

Copiar íntegramente MyKaraoke Original.

2.

Verificar que el proyecto arranque.

3.

Una vez funcionando:

sustituir únicamente la infraestructura.

Nunca reconstruir la aplicación desde cero.

---

# Principio Fundamental

Primero hacer funcionar.

Después mejorar.

Nunca al revés.

---

# Arquitectura Física

La estructura base del proyecto proviene de MyKaraoke Original.

Las carpetas principales son:

- party/
- prisma/
- public/
- scripts/
- src/
- .github/

junto con todos los archivos de configuración originales.

La infraestructura moderna se incorporará progresivamente sin alterar la organización general del proyecto.

---

# Variables de Entorno

Durante la Fase A se mantiene el contrato original.

Variables obligatorias:

- DATABASE_URL
- DATABASE_URL_NON_POOLING
- YOUTUBE_API_KEY
- NEXT_PUBLIC_PARTYKIT_URL

Variables de soporte:

- NODE_ENV
- SKIP_ENV_VALIDATION

Las variables específicas de PartyServer se incorporarán únicamente cuando el código deje de depender de PartyKit.

---

# Reglas de Migración

Cada cambio debe cumplir las siguientes reglas.

## Permitido

- sustituir infraestructura
- actualizar runtime
- actualizar Wrangler
- actualizar Durable Objects
- adaptar PartyServer

## No permitido

- reescribir funcionalidades
- cambiar comportamiento
- modificar UX
- cambiar rutas
- cambiar flujo de usuario
- eliminar funcionalidades originales

---

# Flujo de Trabajo

Cada iteración seguirá este ciclo.

1.

Arrancar proyecto.

2.

Detectar el primer error real.

3.

Corregir únicamente ese error.

4.

Commit.

5.

Repetir.

Nunca corregir múltiples problemas simultáneamente.

---

# Hitos

## Hito A1 ✅

Proyecto original copiado.

Dependencias instaladas.

Variables de entorno configuradas.

Next.js inicia correctamente.

Estado:

COMPLETADO.

---

## Hito A2

Verificación funcional del proyecto original.

Objetivo:

Confirmar que la aplicación funciona exactamente igual que MyKaraoke Original.

---

## Hito B

Migración de PartyKit clásico.

Objetivo:

Sustituir PartyKit por PartyServer oficial.

Sin modificar comportamiento.

---

## Hito C

Infraestructura oficial Cloudflare.

Objetivo:

Wrangler oficial.

Durable Objects oficiales.

Bindings oficiales.

---

## Hito D

Recuperación funcional.

Objetivo:

- salas
- playlist
- reproducción
- sincronización

---

## Hito E

Roles.

Objetivo:

Host.

Co-host.

Invitados.

---

## Hito F

Branding Rockomix.

Último paso del proyecto.

Incluye:

- identidad visual
- mejoras UX
- funciones propias
- optimizaciones

---

# Estado Actual

Estado de la aplicación:

✅ Proyecto original reconstruido.

✅ Proyecto arranca correctamente con Next.js.

✅ Base estable para comenzar la sustitución de PartyKit.

No se iniciará ninguna migración estructural adicional hasta mantener un proyecto funcional en cada hito.

# Filosofía del Proyecto

La aplicación es el activo principal.

La infraestructura es un medio, no un fin.

Siempre que exista un conflicto entre:

- reconstruir la aplicación
- modernizar la infraestructura

se priorizará mantener el comportamiento original de la aplicación.

La infraestructura deberá adaptarse al producto, no el producto a la infraestructura.

El criterio de éxito no será tener el código más moderno.

El criterio de éxito será que Rockomix se comporte igual que MyKaraoke, utilizando infraestructura oficial y mantenible.

# Punto Único de Integración

El producto NO depende directamente de PartyKit.

Toda la comunicación con la infraestructura de salas pasa por:

src/server/api/routers/party.ts

Este archivo constituye el Adaptador entre la aplicación y la infraestructura de sincronización.

Durante la migración únicamente este adaptador deberá cambiar de implementación.

El resto del producto permanecerá sin modificaciones.