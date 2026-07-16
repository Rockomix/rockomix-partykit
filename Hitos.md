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