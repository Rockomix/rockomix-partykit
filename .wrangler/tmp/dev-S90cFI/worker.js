var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../partykit-2026/packages/partyserver/src/index.ts
import { DurableObject, env as defaultEnv } from "cloudflare:workers";

// node_modules/.pnpm/nanoid@3.3.15/node_modules/nanoid/index.browser.js
var nanoid = /* @__PURE__ */ __name((size = 21) => crypto.getRandomValues(new Uint8Array(size)).reduce((id, byte) => {
  byte &= 63;
  if (byte < 36) {
    id += byte.toString(36);
  } else if (byte < 62) {
    id += (byte - 26).toString(36).toUpperCase();
  } else if (byte > 62) {
    id += "-";
  } else {
    id += "_";
  }
  return id;
}, ""), "nanoid");

// ../partykit-2026/packages/partyserver/src/connection.ts
if (!("OPEN" in WebSocket)) {
  const WebSocketStatus = {
    // @ts-expect-error
    CONNECTING: WebSocket.READY_STATE_CONNECTING,
    // @ts-expect-error
    OPEN: WebSocket.READY_STATE_OPEN,
    // @ts-expect-error
    CLOSING: WebSocket.READY_STATE_CLOSING,
    // @ts-expect-error
    CLOSED: WebSocket.READY_STATE_CLOSED
  };
  Object.assign(WebSocket, WebSocketStatus);
  Object.assign(WebSocket.prototype, WebSocketStatus);
}
function tryGetPartyServerMeta(ws) {
  try {
    const attachment = WebSocket.prototype.deserializeAttachment.call(
      ws
    );
    if (!attachment || typeof attachment !== "object") {
      return null;
    }
    if (!("__pk" in attachment)) {
      return null;
    }
    const pk = attachment.__pk;
    if (!pk || typeof pk !== "object") {
      return null;
    }
    const { id, tags } = pk;
    if (typeof id !== "string") {
      return null;
    }
    const { uri } = pk;
    return {
      id,
      tags: Array.isArray(tags) ? tags : [],
      uri: typeof uri === "string" ? uri : void 0
    };
  } catch {
    return null;
  }
}
__name(tryGetPartyServerMeta, "tryGetPartyServerMeta");
function isPartyServerWebSocket(ws) {
  return tryGetPartyServerMeta(ws) !== null;
}
__name(isPartyServerWebSocket, "isPartyServerWebSocket");
var AttachmentCache = class {
  static {
    __name(this, "AttachmentCache");
  }
  #cache = /* @__PURE__ */ new WeakMap();
  get(ws) {
    let attachment = this.#cache.get(ws);
    if (!attachment) {
      attachment = WebSocket.prototype.deserializeAttachment.call(
        ws
      );
      if (attachment !== void 0) {
        this.#cache.set(ws, attachment);
      } else {
        throw new Error(
          "Missing websocket attachment. This is most likely an issue in PartyServer, please open an issue at https://github.com/cloudflare/partykit/issues"
        );
      }
    }
    return attachment;
  }
  set(ws, attachment) {
    this.#cache.set(ws, attachment);
    WebSocket.prototype.serializeAttachment.call(ws, attachment);
  }
};
var attachments = new AttachmentCache();
var connections = /* @__PURE__ */ new WeakSet();
var isWrapped = /* @__PURE__ */ __name((ws) => {
  return connections.has(ws);
}, "isWrapped");
var createLazyConnection = /* @__PURE__ */ __name((ws) => {
  if (isWrapped(ws)) {
    return ws;
  }
  let initialState;
  if ("state" in ws) {
    initialState = ws.state;
    delete ws.state;
  }
  const connection = Object.defineProperties(ws, {
    id: {
      configurable: true,
      get() {
        return attachments.get(ws).__pk.id;
      }
    },
    uri: {
      configurable: true,
      get() {
        return attachments.get(ws).__pk.uri ?? null;
      }
    },
    tags: {
      configurable: true,
      get() {
        return attachments.get(ws).__pk.tags ?? [];
      }
    },
    socket: {
      configurable: true,
      get() {
        return ws;
      }
    },
    state: {
      configurable: true,
      get() {
        return ws.deserializeAttachment();
      }
    },
    setState: {
      configurable: true,
      value: /* @__PURE__ */ __name(function setState(setState) {
        let state;
        if (setState instanceof Function) {
          state = setState(this.state);
        } else {
          state = setState;
        }
        ws.serializeAttachment(state);
        return state;
      }, "setState")
    },
    deserializeAttachment: {
      configurable: true,
      value: /* @__PURE__ */ __name(function deserializeAttachment() {
        const attachment = attachments.get(ws);
        return attachment.__user ?? null;
      }, "deserializeAttachment")
    },
    serializeAttachment: {
      configurable: true,
      value: /* @__PURE__ */ __name(function serializeAttachment(attachment) {
        const setting = {
          ...attachments.get(ws),
          __user: attachment ?? null
        };
        attachments.set(ws, setting);
      }, "serializeAttachment")
    }
  });
  if (initialState) {
    connection.setState(initialState);
  }
  connections.add(connection);
  return connection;
}, "createLazyConnection");
var HibernatingConnectionIterator = class {
  constructor(state, tag) {
    this.state = state;
    this.tag = tag;
  }
  state;
  tag;
  static {
    __name(this, "HibernatingConnectionIterator");
  }
  index = 0;
  sockets;
  [Symbol.iterator]() {
    return this;
  }
  next() {
    const sockets = this.sockets ?? (this.sockets = this.state.getWebSockets(this.tag));
    let socket;
    while (socket = sockets[this.index++]) {
      if (socket.readyState === WebSocket.READY_STATE_OPEN) {
        if (!isPartyServerWebSocket(socket)) {
          continue;
        }
        const value = createLazyConnection(socket);
        return { done: false, value };
      }
    }
    return { done: true, value: void 0 };
  }
};
function prepareTags(connectionId, userTags) {
  const tags = [connectionId, ...userTags.filter((t) => t !== connectionId)];
  if (tags.length > 10) {
    throw new Error(
      "A connection can only have 10 tags, including the default id tag."
    );
  }
  for (const tag of tags) {
    if (typeof tag !== "string") {
      throw new Error(`A connection tag must be a string. Received: ${tag}`);
    }
    if (tag === "") {
      throw new Error("A connection tag must not be an empty string.");
    }
    if (tag.length > 256) {
      throw new Error("A connection tag must not exceed 256 characters");
    }
  }
  return tags;
}
__name(prepareTags, "prepareTags");
var InMemoryConnectionManager = class {
  static {
    __name(this, "InMemoryConnectionManager");
  }
  #connections = /* @__PURE__ */ new Map();
  tags = /* @__PURE__ */ new WeakMap();
  getCount() {
    return this.#connections.size;
  }
  getConnection(id) {
    return this.#connections.get(id);
  }
  *getConnections(tag) {
    if (!tag) {
      yield* this.#connections.values().filter(
        (c) => c.readyState === WebSocket.READY_STATE_OPEN
      );
      return;
    }
    for (const connection of this.#connections.values()) {
      const connectionTags = this.tags.get(connection) ?? [];
      if (connectionTags.includes(tag)) {
        yield connection;
      }
    }
  }
  accept(connection, options) {
    try {
      connection.accept({ allowHalfOpen: true });
    } catch {
      connection.accept();
    }
    try {
      connection.binaryType = "arraybuffer";
    } catch {
    }
    const tags = prepareTags(connection.id, options.tags);
    this.#connections.set(connection.id, connection);
    this.tags.set(connection, tags);
    Object.defineProperty(connection, "tags", {
      get: /* @__PURE__ */ __name(() => tags, "get"),
      configurable: true
    });
    const removeConnection = /* @__PURE__ */ __name(() => {
      this.#connections.delete(connection.id);
      connection.removeEventListener("close", removeConnection);
      connection.removeEventListener("error", removeConnection);
    }, "removeConnection");
    connection.addEventListener("close", removeConnection);
    connection.addEventListener("error", removeConnection);
    return connection;
  }
};
var HibernatingConnectionManager = class {
  constructor(controller) {
    this.controller = controller;
  }
  controller;
  static {
    __name(this, "HibernatingConnectionManager");
  }
  getCount() {
    let count = 0;
    for (const ws of this.controller.getWebSockets()) {
      if (isPartyServerWebSocket(ws)) count++;
    }
    return count;
  }
  getConnection(id) {
    const sockets = this.controller.getWebSockets(id);
    const matching = sockets.filter((ws) => {
      return tryGetPartyServerMeta(ws)?.id === id;
    });
    if (matching.length === 0) return void 0;
    if (matching.length === 1)
      return createLazyConnection(matching[0]);
    throw new Error(
      `More than one connection found for id ${id}. Did you mean to use getConnections(tag) instead?`
    );
  }
  getConnections(tag) {
    return new HibernatingConnectionIterator(this.controller, tag);
  }
  accept(connection, options) {
    const tags = prepareTags(connection.id, options.tags);
    this.controller.acceptWebSocket(connection, tags);
    connection.serializeAttachment({
      __pk: {
        id: connection.id,
        tags,
        uri: connection.uri ?? void 0
      },
      __user: null
    });
    return createLazyConnection(connection);
  }
};

// ../partykit-2026/packages/partyserver/src/transport-errors.ts
var CLOSING = 2;
var CLOSED = 3;
function isBenignTeardownError(ws, error) {
  const state = ws.readyState;
  if (state !== CLOSING && state !== CLOSED) return false;
  if (typeof error !== "object" || error === null) return false;
  const typed = error;
  if (typed.retryable === true) return true;
  const message = typeof typed.message === "string" ? typed.message : "";
  return /Network connection lost|WebSocket peer disconnected/i.test(message);
}
__name(isBenignTeardownError, "isBenignTeardownError");

// ../partykit-2026/packages/partyserver/src/index.ts
var NAME_STORAGE_KEY = "__ps_name";
function isReservedCloseCode(code) {
  return code === 1005 || code === 1006 || code === 1015;
}
__name(isReservedCloseCode, "isReservedCloseCode");
function closeQuietly(ws, code, reason) {
  if (isReservedCloseCode(code)) return;
  try {
    ws.close(code, reason);
  } catch {
  }
}
__name(closeQuietly, "closeQuietly");
function decodeProps(header) {
  const trimmed = header.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }
  const binary = atob(header);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
__name(decodeProps, "decodeProps");
var Server = class extends DurableObject {
  static {
    __name(this, "Server");
  }
  static options = {
    hibernate: false
  };
  #status = "zero";
  #ParentClass = Object.getPrototypeOf(this).constructor;
  #connectionManager = this.#ParentClass.options.hibernate ? new HibernatingConnectionManager(this.ctx) : new InMemoryConnectionManager();
  /**
   * Execute SQL queries against the Server's database
   * @template T Type of the returned rows
   * @param strings SQL query template strings
   * @param values Values to be inserted into the query
   * @returns Array of query results
   */
  sql(strings, ...values) {
    let query = "";
    try {
      query = strings.reduce(
        (acc, str, i) => acc + str + (i < values.length ? "?" : ""),
        ""
      );
      return [...this.ctx.storage.sql.exec(query, ...values)];
    } catch (e) {
      console.error(`failed to execute sql query: ${query}`, e);
      throw this.onException(e);
    }
  }
  // oxlint-disable-next-line no-useless-constructor
  constructor(ctx, env) {
    super(ctx, env);
  }
  /**
   * Handle incoming requests to the server.
   */
  async fetch(request) {
    try {
      const props = request.headers.get("x-partykit-props");
      if (props) {
        this.#_props = decodeProps(props);
      }
      if (!this.ctx.id.name && !this.#_name) {
        const room = request.headers.get("x-partykit-room");
        if (room) this.#_name = room;
      }
      await this.#ensureInitialized();
      if (!this.ctx.id.name && !this.#_name) {
        throw new Error(`Cannot determine the name for ${this.#ParentClass.name}: this.ctx.id.name is undefined, no legacy __ps_name storage record is present, and no x-partykit-room header was supplied. Likely causes:
  1. The stub was built via idFromString()/newUniqueId(). PartyServer requires name-based addressing (idFromName/getByName).
  2. The workerd/wrangler runtime is too old to expose ctx.id.name \u2014 update to a recent wrangler release.
  3. You called stub.fetch() directly without going through routePartykitRequest()/getServerByName(). Prefer those, or set the x-partykit-room header.`);
      }
      const url = new URL(request.url);
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        return await this.onRequest(request);
      } else {
        const { 0: clientWebSocket, 1: serverWebSocket } = new WebSocketPair();
        let connectionId = url.searchParams.get("_pk");
        if (!connectionId) {
          connectionId = nanoid();
        }
        let connection = Object.assign(serverWebSocket, {
          id: connectionId,
          uri: request.url,
          server: this.name,
          tags: [],
          state: null,
          setState(setState) {
            let state;
            if (setState instanceof Function) {
              state = setState(this.state);
            } else {
              state = setState;
            }
            this.state = state;
            return this.state;
          }
        });
        const ctx = { request };
        const tags = await this.getConnectionTags(connection, ctx);
        connection = this.#connectionManager.accept(connection, { tags });
        if (!this.#ParentClass.options.hibernate) {
          this.#attachSocketEventHandlers(connection);
        }
        await this.onConnect(connection, ctx);
        return new Response(null, { status: 101, webSocket: clientWebSocket });
      }
    } catch (err) {
      console.error(
        `Error in ${this.#ParentClass.name}:${this.ctx.id.name ?? this.#_name ?? "<unnamed>"} fetch:`,
        err
      );
      if (!(err instanceof Error)) throw err;
      if (request.headers.get("Upgrade") === "websocket") {
        const pair = new WebSocketPair();
        pair[1].accept();
        pair[1].send(JSON.stringify({ error: err.stack }));
        pair[1].close(1011, "Uncaught exception during session setup");
        return new Response(null, { status: 101, webSocket: pair[0] });
      } else {
        return new Response(err.stack, { status: 500 });
      }
    }
  }
  async webSocketMessage(ws, message) {
    if (!isPartyServerWebSocket(ws)) {
      return;
    }
    try {
      const connection = createLazyConnection(ws);
      await this.#ensureInitialized();
      connection.server = this.name;
      return this.onMessage(connection, message);
    } catch (e) {
      console.error(
        `Error in ${this.#ParentClass.name}:${this.ctx.id.name ?? this.#_name ?? "<unnamed>"} webSocketMessage:`,
        e
      );
    }
  }
  async webSocketClose(ws, code, reason, wasClean) {
    if (!isPartyServerWebSocket(ws)) {
      return;
    }
    try {
      const connection = createLazyConnection(ws);
      await this.#ensureInitialized();
      connection.server = this.name;
      await this.onClose(connection, code, reason, wasClean);
    } catch (e) {
      console.error(
        `Error in ${this.#ParentClass.name}:${this.ctx.id.name ?? this.#_name ?? "<unnamed>"} webSocketClose:`,
        e
      );
    } finally {
      closeQuietly(ws, code, reason);
    }
  }
  async webSocketError(ws, error) {
    if (!isPartyServerWebSocket(ws)) {
      return;
    }
    if (isBenignTeardownError(ws, error)) {
      return;
    }
    try {
      const connection = createLazyConnection(ws);
      await this.#ensureInitialized();
      connection.server = this.name;
      return this.onError(connection, error);
    } catch (e) {
      console.error(
        `Error in ${this.#ParentClass.name}:${this.ctx.id.name ?? this.#_name ?? "<unnamed>"} webSocketError:`,
        e
      );
    }
  }
  /**
   * Read the legacy `__ps_name` storage record as a fallback source of
   * `this.name` when `ctx.id.name` is unavailable. Covers:
   *
   *   1. Alarm handlers firing on alarm records that were scheduled by
   *      a workerd version that did not yet persist `name` into the
   *      alarm record (see the Durable Objects ID docs:
   *      https://developers.cloudflare.com/durable-objects/api/id/#name).
   *      The runtime contract for current workerd populates `ctx.id.name`
   *      in alarm handlers — see the "Raw runtime contract" tests — so
   *      this fallback exists primarily for stale on-disk alarm records
   *      and for defense-in-depth against future runtime changes.
   *   2. Legacy framework-level bootstrap patterns that write
   *      `__ps_name` directly (or call `setName()`) before triggering
   *      `__unsafe_ensureInitialized()` — typically DOs addressed via
   *      `idFromString()` / `newUniqueId()` plus a name override.
   */
  async #hydrateNameFromLegacyStorage() {
    if (this.#_name) return;
    const stored = await this.ctx.storage.get(NAME_STORAGE_KEY);
    if (stored) {
      this.#_name = stored;
    }
  }
  async #persistNameFallbackFromCtxId() {
    const ctxName = this.ctx.id.name;
    if (ctxName === void 0 || this.#_name) return;
    const stored = await this.ctx.storage.get(NAME_STORAGE_KEY);
    if (stored !== ctxName) {
      await this.ctx.storage.put(NAME_STORAGE_KEY, ctxName);
    }
    this.#_name = ctxName;
  }
  /**
   * @internal — Do not use directly. This is an escape hatch for frameworks
   * (like Agents) that receive calls via native DO RPC, bypassing the
   * standard fetch/alarm/webSocket entry points where initialization
   * normally happens. Calling this from application code is unsupported
   * and may break without notice.
   */
  async __unsafe_ensureInitialized() {
    await this.#ensureInitialized();
  }
  async #ensureInitialized() {
    if (this.#status === "started") return;
    if (this.ctx.id.name !== void 0) {
      await this.#persistNameFallbackFromCtxId();
    } else if (!this.#_name) {
      await this.#hydrateNameFromLegacyStorage();
    }
    let error;
    await this.ctx.blockConcurrencyWhile(async () => {
      this.#status = "starting";
      try {
        await this.onStart(this.#_props);
        this.#status = "started";
      } catch (e) {
        this.#status = "zero";
        error = e;
      }
    });
    if (error) throw error;
  }
  #attachSocketEventHandlers(connection) {
    const handleMessageFromClient = /* @__PURE__ */ __name((event) => {
      this.onMessage(connection, event.data)?.catch((e) => {
        console.error("onMessage error:", e);
      });
    }, "handleMessageFromClient");
    const reciprocateClose = /* @__PURE__ */ __name((event) => {
      closeQuietly(connection, event.code, event.reason);
    }, "reciprocateClose");
    const handleCloseFromClient = /* @__PURE__ */ __name((event) => {
      connection.removeEventListener("message", handleMessageFromClient);
      connection.removeEventListener("close", handleCloseFromClient);
      let result;
      try {
        result = this.onClose(
          connection,
          event.code,
          event.reason,
          event.wasClean
        );
      } catch (e) {
        console.error("onClose error:", e);
        reciprocateClose(event);
        return;
      }
      if (result && typeof result.then === "function") {
        result.catch((e) => {
          console.error("onClose error:", e);
        }).finally(() => reciprocateClose(event));
      } else {
        reciprocateClose(event);
      }
    }, "handleCloseFromClient");
    const handleErrorFromClient = /* @__PURE__ */ __name((e) => {
      connection.removeEventListener("message", handleMessageFromClient);
      connection.removeEventListener("error", handleErrorFromClient);
      if (isBenignTeardownError(connection, e.error)) return;
      this.onError(connection, e.error)?.catch((err) => {
        console.error("onError error:", err);
      });
    }, "handleErrorFromClient");
    connection.addEventListener("close", handleCloseFromClient);
    connection.addEventListener("error", handleErrorFromClient);
    connection.addEventListener("message", handleMessageFromClient);
  }
  // Public API
  #_name;
  /**
   * The name for this server.
   *
   * Resolves from `this.ctx.id.name` — the native DO id name, populated
   * whenever the stub was created via `idFromName()` or `getByName()`.
   * This is available inside every entry point (including the constructor,
   * alarms, and hibernating websocket handlers).
   *
   * For alarm handlers firing on stale on-disk alarm records from
   * older workerd versions that didn't persist `name` into the alarm
   * record, the name is recovered from a storage fallback record.
   *
   * Throws if neither source is available — typically this means the DO
   * was addressed via `idFromString()` or `newUniqueId()`, which is not
   * supported by PartyServer.
   */
  get name() {
    const ctxName = this.ctx.id.name;
    if (ctxName !== void 0) return ctxName;
    if (this.#_name) return this.#_name;
    throw new Error(
      `Attempting to read .name on ${this.#ParentClass.name}, but this.ctx.id.name is not set and no ${NAME_STORAGE_KEY} fallback record is available. PartyServer requires DOs to be addressed via idFromName()/getByName(), or explicitly bootstrapped with setName() when using idFromString()/newUniqueId(). If this happens in an alarm handler firing on a stale alarm record, initialize the DO from a fetch/RPC entry point first so PartyServer can persist the fallback name.`
    );
  }
  /**
   * Establish this server's name and trigger `onStart()`.
   *
   * Use cases:
   *
   *   1. **Framework-level bootstrap of DOs where `ctx.id.name` is
   *      undefined** — e.g. DOs addressed via `idFromString()` /
   *      `newUniqueId()`. `setName()` stashes the name in memory and
   *      persists it under `__ps_name` so cold-wake invocations
   *      recover it via `#ensureInitialized()`'s legacy fallback.
   *   2. **Delivering initial `props` to `onStart()`** via the
   *      optional second argument.
   *
   * For DOs addressed via `idFromName()` / `getByName()`, calling
   * `setName()` is redundant — `this.name` is available automatically
   * from `ctx.id.name`. The normal initialization path also persists
   * a fallback record so old-compat alarm handlers can recover the name.
   * Throws if `name` does not match `ctx.id.name`.
   *
   * **Not appropriate for facets.** Cloudflare Agents and any other
   * framework using `ctx.facets.get(...)` should pass an explicit
   * `id` in `FacetStartupOptions` so the facet has its own
   * `ctx.id.name`:
   *
   * ```ts
   * const stub = ctx.facets.get(facetKey, () => ({
   *   class: ChildClass,
   *   id: ctx.exports.SomeBoundDOClass.idFromName(facetName),
   * }));
   * ```
   *
   * Without an explicit `id`, the facet inherits the parent DO's
   * `ctx.id` (including `ctx.id.name`), and `setName()` will throw
   * the ctx.id.name-mismatch error because the facet's intended
   * name differs from the parent's. See
   * https://developers.cloudflare.com/dynamic-workers/usage/durable-object-facets/
   * for the `FacetStartupOptions.id` semantics.
   *
   * @deprecated for callers that address DOs via `idFromName()` /
   * `getByName()`. Still the supported API for framework-level
   * bootstrap of header/`newUniqueId`-addressed DOs and for
   * delivering initial `props` to `onStart()`.
   */
  async setName(name, props) {
    if (!name) {
      throw new Error("A name is required.");
    }
    const ctxName = this.ctx.id.name;
    if (ctxName !== void 0 && ctxName !== name) {
      throw new Error(
        `This server's Durable Object id was created for name "${ctxName}", cannot setName to "${name}".`
      );
    }
    if (this.#_name && this.#_name !== name) {
      throw new Error(
        `This server already has a name: ${this.#_name}, attempting to set to: ${name}`
      );
    }
    if (props !== void 0) {
      this.#_props = props;
    }
    if (!this.#_name && ctxName === void 0) {
      await this.ctx.storage.put(NAME_STORAGE_KEY, name);
      this.#_name = name;
    }
    await this.#ensureInitialized();
  }
  /**
   * @internal
   * @deprecated Retained for backward compatibility with older callers.
   * `routePartykitRequest` no longer uses this method; it sends props via
   * the `x-partykit-props` header on the underlying `fetch()` request.
   */
  async _initAndFetch(name, props, request) {
    await this.setName(name, props);
    return this.fetch(request);
  }
  #sendMessageToConnection(connection, message) {
    try {
      connection.send(message);
    } catch (_e) {
      connection.close(1011, "Unexpected error");
    }
  }
  /** Send a message to all connected clients, except connection ids listed in `without` */
  broadcast(msg, without) {
    for (const connection of this.#connectionManager.getConnections()) {
      if (!without || !without.includes(connection.id)) {
        this.#sendMessageToConnection(connection, msg);
      }
    }
  }
  /** Get a connection by connection id */
  getConnection(id) {
    return this.#connectionManager.getConnection(id);
  }
  /**
   * Get all connections. Optionally, you can provide a tag to filter returned connections.
   * Use `Server#getConnectionTags` to tag the connection on connect.
   */
  getConnections(tag) {
    return this.#connectionManager.getConnections(tag);
  }
  /**
   * You can tag a connection to filter them in Server#getConnections.
   * Each connection supports up to 9 tags, each tag max length is 256 characters.
   */
  getConnectionTags(connection, context) {
    return [];
  }
  #_props;
  // Implemented by the user
  /**
   * Called when the server is started for the first time.
   */
  // oxlint-disable-next-line no-unused-vars
  onStart(props) {
  }
  /**
   * Called when a new connection is made to the server.
   */
  onConnect(connection, ctx) {
  }
  /**
   * Called when a message is received from a connection.
   */
  // oxlint-disable-next-line no-unused-vars
  onMessage(connection, message) {
  }
  /**
   * Called when a connection is closed.
   */
  onClose(connection, code, reason, wasClean) {
  }
  /**
   * Called when an error occurs on a connection.
   */
  onError(connection, error) {
    console.error(
      `Error on connection ${connection.id} in ${this.#ParentClass.name}:${this.name}:`,
      error
    );
    console.info(
      `Implement onError on ${this.#ParentClass.name} to handle this error.`
    );
  }
  /**
   * Called when a request is made to the server.
   */
  onRequest(request) {
    console.warn(
      `onRequest hasn't been implemented on ${this.#ParentClass.name}:${this.name} responding to ${request.url}`
    );
    return new Response("Not implemented", { status: 404 });
  }
  /**
   * Called when an exception occurs.
   * @param error - The error that occurred.
   */
  onException(error) {
    console.error(
      `Exception in ${this.#ParentClass.name}:${this.name}:`,
      error
    );
    console.info(
      `Implement onException on ${this.#ParentClass.name} to handle this error.`
    );
  }
  onAlarm() {
    console.log(
      `Implement onAlarm on ${this.#ParentClass.name} to handle alarms.`
    );
  }
  async alarm() {
    await this.#ensureInitialized();
    await this.onAlarm();
  }
};

// worker.ts
var INITIAL_KARAOKE_PARTY = {
  playlist: [],
  settings: {
    orderByFairness: true
  }
};
var PartyRoom = class extends Server {
  static {
    __name(this, "PartyRoom");
  }
  karaokeParty;
  async onStart() {
    this.karaokeParty = await this.ctx.storage.get("karaokeParty");
  }
  async onRequest(request) {
    if (request.method === "POST" && !this.karaokeParty) {
      this.karaokeParty = INITIAL_KARAOKE_PARTY;
      await this.ctx.storage.put("karaokeParty", this.karaokeParty);
    }
    if (this.karaokeParty) {
      return new Response(JSON.stringify(this.karaokeParty), {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    return new Response("Party not found =(", { status: 404 });
  }
};
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/party\/([^/]+)$/);
    if (!match) {
      return new Response("Not Found", { status: 404 });
    }
    const partyHash = match[1];
    const id = env.PartyRoom.idFromName(partyHash);
    const stub = env.PartyRoom.get(id);
    return stub.fetch(new Request(request));
  }
};

// C:/Users/Kikekaraoke/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// C:/Users/Kikekaraoke/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-VwXXJX/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// C:/Users/Kikekaraoke/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-VwXXJX/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  PartyRoom,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
