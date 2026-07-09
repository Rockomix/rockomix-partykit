# ORIGEN DEL PROYECTO

## Proyecto

**Rockomix PartyKit**

---

# Objetivo

Este proyecto reconstruye Rockomix desde cero utilizando la infraestructura oficial de PartyKit / Cloudflare.

**NO** es una migración de proyectos anteriores.

**NO** es un fork de MyKaraoke.

Es una implementación limpia que utiliza la infraestructura oficial y toma a MyKaraoke únicamente como referencia funcional.

---

# Referencias oficiales

## Infraestructura

Repositorio oficial:

https://github.com/cloudflare/partykit

Referencia local:

E:\Python\cloudflare\partykit-2026

Se consulta únicamente para:

- PartyServer
- PartySocket
- Cloudflare Workers
- Durable Objects
- Routing oficial
- Runtime oficial

---

## Referencia del producto

Repositorio original:

https://github.com/empz/my-karaoke-party

Referencia local:

E:\Python\cloudflare\mykaraoke-original

Se consulta únicamente para:

- Interfaz de usuario
- Flujo de karaoke
- Playlist
- Roles
- Fairness
- Funcionalidades del producto

---

# Reglas del proyecto

La infraestructura SIEMPRE proviene de:

- PartyKit 2026

El comportamiento funcional SIEMPRE se toma de:

- MyKaraoke Original

Todo el código propio de Rockomix se desarrolla únicamente dentro de este repositorio.

---

# Regla de oro

Antes de implementar cualquier funcionalidad se debe responder:

### 1. ¿Ya existe en PartyKit 2026?

Si existe, utilizar la implementación oficial.

No reinventar infraestructura.

---

### 2. Si no existe...

Consultar cómo lo resolvió MyKaraoke Original.

Tomarlo únicamente como referencia funcional.

---

### 3. Si tampoco existe...

Implementarlo como código propio de Rockomix.

---

# Lo que este proyecto NO debe hacer

Nunca volver a implementar:

- PartyServer
- PartySocket
- Cloudflare Worker
- Durable Objects
- Runtime oficial
- Routing oficial

La infraestructura pertenece a PartyKit.

Rockomix únicamente implementa la lógica del producto.

---

# Objetivo final

Separar completamente:

- Infraestructura
- Producto
- Personalizaciones de Rockomix

para mantener un proyecto limpio, fácil de actualizar y alineado con la arquitectura oficial.

---

# Filosofía de desarrollo

- Commits pequeños.
- Una funcionalidad por vez.
- Probar antes de continuar.
- Documentar las decisiones importantes.
- Mantener siempre una referencia clara entre infraestructura, producto y personalización.

> Si en algún momento surge la duda de "¿dónde debe implementarse esto?", la respuesta siempre debe buscarse en este orden:

1. PartyKit 2026 (infraestructura)
2. MyKaraoke Original (producto)
3. Rockomix (personalización)