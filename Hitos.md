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