# Despliegue del Worker en Cloudflare

El workflow de GitHub Actions despliega el Worker mediante:

```bash
pnpm dlx wrangler deploy
```

Configura estos secretos en el repositorio de GitHub:

- `CLOUDFLARE_API_TOKEN`: token con permisos para desplegar Workers y gestionar
  los Durable Objects del proyecto.
- `CLOUDFLARE_ACCOUNT_ID`: identificador de la cuenta Cloudflare donde vive el
  Worker.

El despliegue utiliza `wrangler.jsonc`, `worker.ts`, el binding `PartyRoom` y
las migraciones de Durable Objects declaradas allí.

No se requieren `PARTYKIT_TOKEN` ni `PARTYKIT_LOGIN`.
