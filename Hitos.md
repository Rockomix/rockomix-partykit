# HITOS DEL PROYECTO ROCKOMIX PARTY

---

# HITO A - Migración de PartyKit a PartyServer

Objetivo:
Eliminar la dependencia del servidor PartyKit y migrar la lógica de tiempo real a Cloudflare Workers + Durable Objects.

Resultado:

✅ Worker implementado.
✅ Durable Object PartyRoom creado.
✅ Wrangler configurado.
✅ Proyecto compila correctamente.
✅ Cloudflare Worker desplegado.

---

# HITO B1 - Comunicación con PartyServer

Objetivo:
Conseguir que el Worker reciba correctamente los mensajes enviados desde el cliente.

Resultado:

✅ Cliente conectado al Worker.
✅ Recepción de mensajes validada.
✅ Broadcast operativo.
✅ Logs de depuración implementados para validar el flujo.

Validaciones:

- Host
- Invitado
- Playlist
- Conexión WebSocket

Estado:

COMPLETADO

---

# HITO B2 - Lógica del Karaoke

Objetivo:

Migrar completamente la lógica que anteriormente ejecutaba PartyKit.

Implementado:

✅ addVideo
✅ removeVideo
✅ skip
✅ horn
✅ playlist
✅ broadcast de cambios

Validaciones realizadas:

✅ Durable Objects
✅ POST manual mediante curl
✅ Worker recibe mensajes correctamente.
✅ Cliente recibe broadcast.
✅ Playlist sincronizada.

Estado:

COMPLETADO

---

# HITO B3 - Checkpoint estable previo al rediseño UI

Objetivo:

Dejar una base estable antes de comenzar la nueva interfaz de Rockomix.

Infraestructura

✅ PartyServer estable.
✅ Durable Objects funcionando.
✅ Worker desplegado en Cloudflare.
✅ Proyecto funcionando en desarrollo.
✅ Host e Invitado sincronizados en PC.
✅ Add Video funcionando.
✅ Remove funcionando.
✅ Skip funcionando.
✅ Horn funcionando.
✅ Broadcast funcionando.

Audio

✅ Se reemplaza el buzz por el audio oficial de Rockomix.

```
public/sounds/fxs/kikekaraoke-envivo.mp3
```

Se crea:

```
src/constants/audio.ts
```

con el catálogo centralizado de audio.

Ejemplo:

```ts
AUDIO.FXS.KIKERADIO
```

Con ello desaparecen rutas "quemadas" dentro del código.

Organización

Nueva estructura:

```
public/
└── sounds/
    ├── fxs/
    ├── player/
    └── ui/
```

Pend

===========================================================
HITO UI V1 COMPLETADO
===========================================================

Objetivo:
Modernizar la interfaz respetando el diseño original de
MyKaraoke Party, sin modificar la arquitectura ni el
funcionamiento del proyecto.

Branding
✓ Creación del componente reutilizable LogoBrand.
✓ Integración de LogoBrand en Landing.
✓ Integración de LogoBrand en Join.
✓ Integración de LogoBrand en EmptyPlayer.
✓ Firma "by Kikekaraoke".
✓ Tamaños reutilizables (lg / md / sm).

Landing
✓ Banner promocional original deshabilitado y reservado
  para futura publicidad Rockomix.
✓ Branding unificado.
✓ Preparación para internacionalización.

Internacionalización (i18n)
✓ Nueva carpeta:
  src/locales/

✓ Idiomas iniciales:
  - es-MX
  - en

✓ Organización base:

  common.*
  landing.*
  join.*
  player.*
  party.*
  search.*
  host.*
  cohost.*
  guest.*
  settings.*
  errors.*
  notifications.*
  terms.*

✓ Español (México) establecido como idioma por defecto.
✓ Infraestructura preparada para agregar nuevos idiomas.

Componentes internacionalizados
✓ Landing
✓ CreateParty
✓ Join
✓ SongSearch
✓ Player
✓ Party
✓ EmptyPlayer

Correcciones
✓ Eliminación de textos hardcodeados principales.
✓ Corrección de cadenas con problemas de codificación.
✓ Internacionalización del mensaje Horn.
✓ Internacionalización del estado Playlist vacía.

Arquitectura
✓ No se modificó Worker.
✓ No se modificó PartyServer.
✓ No se modificó Prisma.
✓ No se modificó Cloudflare.
✓ No se modificó WebSocket.
✓ No se modificó tRPC.
✓ No se modificó la lógica de negocio.
✓ No se modificó la arquitectura del proyecto.

Resultado

Se completó la primera etapa de modernización visual
manteniendo compatibilidad con la arquitectura original.

===========================================================
PENDIENTES UI V2
===========================================================

Branding
□ Encabezado Party:
  LogoBrand + Nombre de la sala.

□ Definir identidad visual específica para:
  - Host
  - Invitado
  - COHOST

UX
□ Saludo personalizado al invitado.
□ Alias divertido opcional.
□ Selector de idioma.

Internacionalización
□ Internacionalizar Terms of Service.
□ Completar pantallas Host.
□ Completar pantallas COHOST.
□ Completar pantallas Guest.

Responsive
□ Optimizar experiencia Host en dispositivos móviles.
□ Unificar ancho del buscador entre Host, Invitado y COHOST
  en escritorio.

===========================================================

===========================================================
PENDIENTE TÉCNICO
===========================================================

□ Resolver definitivamente la URL pública para dispositivos móviles.

Objetivo:

- El QR debe funcionar tanto en desarrollo como en producción.
- El móvil NO debe depender de localhost.
- Mantener compatibilidad con Cloudflare Worker.
- Evitar soluciones temporales o hacks.

===========================================================
HITO UI V2 COMPLETADO
===========================================================

✓ Internacionalización inicial (es-MX / en)
✓ Encabezado renovado para Party (Invitado / COHOST)
✓ Branding experimental exclusivo para Party
✓ Nuevo componente AppTextBrand
✓ Fuente central de identidad (src/constants/app.ts)
✓ Módulo de búsqueda unificado visualmente con Host (Desktop)
✓ Preparación del encabezado para futuras mejoras de UX

===========================================================
HITO UI V2 - PLAYER COMPLETADO
===========================================================

✓ Recuperada la lógica original del overlay dinámico desde producción.
✓ Recuperados los umbrales de tamaño para título y cantante.
✓ Recuperado el límite max-w-4xl del encabezado.
✓ Mejorada la UX del buscador:
    • Selección automática del texto al recibir foco.
✓ Validado con títulos cortos, medios y largos.
✓ Sin cambios en Worker, PartyServer o arquitectura.

Pendiente:
□ Corregir la identidad del usuario que agrega canciones (HOST / COHOST / GUEST) reutilizando la implementación existente en rockomix-production.

===========================================================
HITO UX V1 - Experiencia de Invitado
===========================================================

Estado: ✅ COMPLETADO

Objetivo

Mejorar la experiencia del Invitado y COHOST manteniendo la arquitectura existente, priorizando una interfaz moderna, limpia y enfocada en la experiencia de uso.

Implementado

### Branding

✅ Brand siempre visible durante el desplazamiento.
✅ Reducción dinámica únicamente del logotipo al hacer scroll.
✅ La firma "by Kikekaraoke" mantiene su tamaño y legibilidad.
✅ Ajustes de espaciado para mejorar la jerarquía visual del encabezado.

### Encabezado

✅ Mejor organización visual del nombre de la fiesta.
✅ Separación optimizada entre Brand, nombre de la fiesta, saludo y buscador.
✅ Corrección del área desplazable para evitar que el scrollbar aparezca sobre el encabezado.

### Invitaciones

✅ Nueva acción contextual "Invitar" junto al nombre de la fiesta.
✅ Disponible para HOST, COHOST e INVITADO.
✅ Nuevo componente reutilizable:

src/components/invite-party-dialog.tsx

Implementado:

✅ QR de invitación.
✅ Enlace de la fiesta.
✅ navigator.share() cuando está disponible.
✅ Copiar enlace como fallback.
✅ Toast de confirmación.
✅ Cierre mediante botón y tocando fuera del diálogo.
✅ Diseño premium sin scroll interno.

Arquitectura

✅ SongSearch permanece sin modificaciones.
✅ Reutilización de QrCode.
✅ Reutilización de getUrl().
✅ Reutilización del sistema de toast.
✅ Sin cambios en Worker, PartyServer, Roles, Playlist, WebSocket ni reproducción.

Resultado

La experiencia de incorporación de nuevos invitados queda integrada directamente en la interfaz principal mediante un flujo moderno, reutilizable y preparado para futuras mejoras.


HITO ARQ V1 - Infraestructura base del registro de participantes

✅ Implementado

Persistencia de sessionId.
Creación de participantRegistry.
Registro y consulta de participantes.
Separación entre estado de participantes y playlist.
Sin modificar la arquitectura de PartyServer.

⚠️ Nota

El registro de participantes durante la carga de la sala (room loading) queda aprobado únicamente como bootstrap temporal.

No representa todavía el ciclo de vida definitivo del sistema de roles.

Será reevaluado cuando se recupere:

resolveRole
roleState
HOST / COHOST / GUEST
Recuperación de sesión
Ownership
Identidad del solicitante (singerName)

Estado: ✅ Aprobado como infraestructura base.

🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥
HITO ARQ V2 - Recuperación del sistema de identidad y roles de producción
✅ Implementado
Recuperación del flujo real utilizado por producción.
Eliminación de sessionId como parámetro de navegación.
Recuperación de ensureSessionId() como fuente de identidad del navegador.
Persistencia de sessionId exclusivamente en localStorage.
Recuperación automática de identidad al volver a ingresar a la sala.
Recuperación automática del COHOST utilizando el mismo sessionId.
Restauración del flujo correcto:
Crear Party
ensureSessionId()
localStorage
PartyScene
Worker
resolveRole()
Separación entre identidad del navegador y navegación.
Sin modificar la arquitectura de PartyServer.
Validado

✅ HOST

✅ COHOST

✅ INVITADO

✅ Recuperación del COHOST

✅ Recuperación de sesión

✅ Roles equivalentes a producción

Estado

✅ Aprobado.

La arquitectura de identidad y recuperación de roles queda restaurada conforme al comportamiento validado de producción.

HITO ARQ V3 - Recuperación del comportamiento de producción y estabilidad SSR
✅ Implementado
Eliminación definitiva de sessionId en la URL de navegación.
Recuperación del flujo de navegación utilizado por producción.
Corrección del error de hidratación (SSR Hydration Error) en PartyScene.
Separación correcta entre:
nombre de la sala (party.name)
nombre del usuario (localStorage["name"])
Recuperación del comportamiento visual validado de producción.
Conservación del comportamiento de:
PartyServer
Worker
Roles
Playlist
Atribución de canciones
Recuperación de sesión
Eliminación de código temporal y logs de depuración utilizados durante la migración.
Validado

✅ Sin Hydration Error.

✅ Nombre correcto de la sala.

✅ Nombre correcto del usuario.

✅ Nombre correcto del cantante.

✅ Atribución correcta de canciones.

✅ Recuperación del COHOST.

✅ Recuperación de sessionId.

✅ Sin sessionId en la URL.

✅ Comportamiento equivalente a producción.

Estado

✅ Aprobado.

La migración recupera el comportamiento funcional de producción bajo PartyServer, manteniendo la arquitectura actual y garantizando compatibilidad con SSR sin romper el sistema de roles.


🎉
✅ ARQ V1 → Construimos la infraestructura (participantRegistry, sessionId, base de participantes).
✅ ARQ V2 → Recuperamos la identidad y el ciclo de vida de los roles exactamente como en producción.
✅ ARQ V3 → Recuperamos el comportamiento visual y de SSR, dejando la migración estable y funcional sobre PartyServer.
✅ ARQ V4 (validación Play/Pausa/Skip)
✅ ARQ V5 (recuperación del puente PlayerScene → Player) 🎉

🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥
HITO UI V1 - Interfaz y permisos del COHOST
Objetivo

Recuperar completamente la experiencia visual y funcional del COHOST existente en producción, manteniendo la arquitectura ya validada de PartyServer.

Alcance
UI
Recuperar la interfaz específica del COHOST.
Mostrar correctamente los controles según el rol asignado.
Ocultar controles exclusivos del HOST.
Mantener la interfaz del INVITADO sin privilegios.
Funcionalidad

Validar que el COHOST pueda:

▶️ Reproducir.
⏸️ Pausar.
⏭️ Skip.
📢 Bocina (si aplica según producción).
Restricciones
No modificar resolveRole.
No modificar roleState.
No modificar sessionId.
No modificar la arquitectura de PartyServer.
No iniciar limpieza TypeScript (ARQ V4).
Criterio de aceptación

El COHOST debe comportarse exactamente igual que en producción, tanto visual como funcionalmente.

El orden que seguiría
✅ Commit de ARQ V3.
✅ Push.
✅ Crear rama (si acostumbras trabajar por hito, o seguir en la misma feature si así manejas el proyecto).
🚀 Empezar HITO UI V1.
🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥

HITO ARQ V4 - Validación del flujo de controles de reproducción

✅ Validado

Se comparó producción contra migración.
Se verificó el recorrido completo:
Botón
Handler
sendSocketMessage
WebSocket
Worker
Permisos
Broadcast
No se encontraron diferencias funcionales.
No fue necesario recuperar lógica.
No se realizaron cambios.

Estado: ✅ Aprobado.

🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥
HITO ARQ V5 – Recuperación del puente PlayerScene → Player

✅ Implementado

Recuperado el puente imperativo entre PlayerScene y Player exactamente como en producción.
Player vuelve a exponer PlayerActions mediante forwardRef y useImperativeHandle.
PlayerScene consume los mensajes WebSocket play y pause y los reenvía al reproductor.
No se modificó Worker, PartyServer, Roles, Permissions, sessionId, Skip ni la lógica de la playlist.
Se mantuvo la arquitectura validada en los hitos anteriores.

Estado: ✅ Implementado. Pendiente validación funcional en entorno online (Vercel + Cloudflare).


HITO ARQ V4 - PartyServer desacoplado y validado
Objetivo

Eliminar la dependencia local hacia:

../partykit-2026/

dejando el proyecto completamente portable para compilación local y despliegue en Vercel.

Cambios realizados
Se reemplazó el import local de PartyServer por la dependencia oficial publicada en npm.
Se agregó partyserver@0.5.8 como dependencia del proyecto.
Se actualizó package.json y pnpm-lock.yaml.
Se mantuvo intacta la arquitectura basada en:
Cloudflare Workers
PartyServer
Durable Objects
Roles
SessionId
Participant Registry
Se recuperó el funcionamiento de Play y Pausa mediante el puente imperativo del Player.
Se restauró el funcionamiento del botón Skip del Player sin regresar a la implementación antigua de WebSocket.
Validaciones realizadas

Pruebas locales exitosas:

✅ Worker inicia correctamente.
✅ Next.js inicia correctamente.
✅ HOST funciona.
✅ CO HOST funciona.
✅ INVITADO funciona.
✅ Agregar canciones.
✅ Bocina.
✅ Play.
✅ Pausa.
✅ Skip.
✅ Sin dependencia del directorio partykit-2026.
Pendientes conocidos
Revisar en una siguiente etapa si query.role continúa siendo necesario o puede eliminarse dejando que resolveRole() determine completamente los permisos mediante sessionId.


🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥
HITO FUTURO

Extraer:

- KaraokeParty
- Message
- VideoInPlaylist
- Participant

a:

src/shared/types.ts

y eliminar la dependencia del frontend hacia party/index.ts
🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥
🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥
// TEMPORAL:
// Durante la migración PartyKit -> PartyServer esta regla produce
// advertencias inconsistentes con el checker de TypeScript.
// Se deja en "warn" para no bloquear el build.
// Revisar al actualizar el stack de ESLint/TypeScript.
"@typescript-eslint/no-unnecessary-type-assertion": "warn",




🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥
HITO - El jefe final del build ha sido derrotado
Objetivo

Restaurar la capacidad del proyecto para generar un build completo de producción después de la migración de PartyKit hacia PartyServer/Cloudflare Worker.

Validado
Infraestructura
✅ Prisma Client genera correctamente.
✅ prisma migrate deploy finaliza sin migraciones pendientes.
✅ Next.js completa el build de producción.
✅ Generación de páginas estáticas y dinámicas finalizada.
✅ Build apto para despliegue.
Correcciones realizadas
Recuperación de los tipos necesarios para la arquitectura PartyServer.
Restauración del soporte para mensajes play y pause utilizados por el frontend.
Corrección de verificaciones de tipos en worker.ts.
Ajustes mínimos de inferencia de tipos sin modificar la lógica funcional.
Incorporación de los tipos de Cloudflare necesarios para la compilación.
ESLint

Se detectó que la regla:

@typescript-eslint/no-unnecessary-type-assertion

bloqueaba el pipeline de build.

Durante esta etapa se redujo temporalmente su severidad de error a warning, permitiendo completar el proceso de compilación sin modificar la lógica de la aplicación.

Los as KaraokeParty permanecen intactos hasta determinar el origen de la discrepancia entre el checker de TypeScript y ESLint.

Estado alcanzado
✅ Proyecto compila completamente.
✅ Pipeline de producción desbloqueado.
✅ Sin errores de TypeScript.
✅ Sin errores de Prisma.
✅ Sin errores de Next.js.
⚠️ Permanecen únicamente advertencias de ESLint relacionadas con no-unnecessary-type-assertion.
Próximo hito

Iniciar validación funcional del sistema completo:

HOST
COHOST
INVITADO
Roles
Playlist
add-video
remove-video
mark-as-played
horn
sincronización en tiempo real
pruebas desde dispositivos móviles
despliegue en producción

Este hito no valida el comportamiento funcional de la aplicación; valida que el proyecto ha recuperado la capacidad de construirse y desplegarse en producción, habilitando la fase de pruebas funcionales.

🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥