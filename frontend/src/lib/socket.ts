const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000';

const RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 5000;

type Handler = (payload: any) => void;

/**
 * Minimal client-side stand-in for the previous `socket.io-client` API, backed by a native
 * WebSocket. Messages are JSON envelopes of the shape `{ event, data }`, matching the Quarkus
 * WebSockets Next endpoints at `/ws/<namespace>`. Room code travels on the handshake query
 * string so a reverse proxy can route the upgrade to the owning instance, exactly as before.
 */
export interface AppSocket {
  on(event: string, handler: Handler): void;
  emit(event: string, payload?: unknown): void;
  disconnect(): void;
}

export function createSocket(namespace: string, code: string): AppSocket {
  return new NativeSocket(namespace, code);
}

class NativeSocket implements AppSocket {
  private readonly url: string;
  private socket: WebSocket | null = null;
  private readonly handlers = new Map<string, Set<Handler>>();
  private readonly outbox: string[] = [];
  private closedByUser = false;
  private reconnectDelay = RECONNECT_DELAY_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(namespace: string, code: string) {
    this.url = buildUrl(namespace, code);
    this.open();
  }

  on(event: string, handler: Handler): void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
  }

  emit(event: string, payload?: unknown): void {
    const message = JSON.stringify({ event, data: payload ?? null });
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(message);
    } else {
      this.outbox.push(message);
    }
  }

  disconnect(): void {
    this.closedByUser = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
  }

  private open(): void {
    const socket = new WebSocket(this.url);
    this.socket = socket;

    socket.onopen = () => {
      this.reconnectDelay = RECONNECT_DELAY_MS;
      this.flushOutbox();
      this.dispatch('connect', undefined);
    };

    socket.onmessage = (message) => {
      let parsed: { event?: unknown; data?: unknown };
      try {
        parsed = JSON.parse(message.data as string) as { event?: unknown; data?: unknown };
      } catch {
        return;
      }
      if (typeof parsed.event === 'string') {
        this.dispatch(parsed.event, parsed.data);
      }
    };

    socket.onclose = () => {
      this.socket = null;
      this.dispatch('disconnect', undefined);
      this.scheduleReconnect();
    };

    socket.onerror = () => {
      socket.close();
    };
  }

  private scheduleReconnect(): void {
    if (this.closedByUser || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.closedByUser) this.open();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
  }

  private flushOutbox(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    while (this.outbox.length > 0) {
      this.socket.send(this.outbox.shift() as string);
    }
  }

  private dispatch(event: string, payload: unknown): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of set) {
      handler(payload);
    }
  }
}

function buildUrl(namespace: string, code: string): string {
  const base = SOCKET_URL.replace(/\/+$/, '');
  const wsBase = base.replace(/^http/, 'ws');
  return `${wsBase}/ws/${namespace}?code=${encodeURIComponent(code)}`;
}
