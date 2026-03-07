type MessageHandler = (data: unknown) => void;

interface WSMessage {
  channel: string;
  event: "data" | "snapshot" | "error";
  timestamp: number;
  data: unknown;
  sequence?: number;
}

export class WSClient {
  private ws: WebSocket | null = null;
  private subscriptions = new Map<string, Set<MessageHandler>>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private url: string;
  private pendingSubscriptions: string[] = [];

  constructor(url: string) {
    this.url = url;
  }

  connect(): void {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log("[WS] Connected to", this.url);
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;

        // Re-subscribe to all channels
        for (const channel of this.subscriptions.keys()) {
          this.sendSubscribe(channel);
        }
        // Send pending subscriptions
        for (const channel of this.pendingSubscriptions) {
          this.sendSubscribe(channel);
        }
        this.pendingSubscriptions = [];
      };

      this.ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data);
          const handlers = this.subscriptions.get(msg.channel);
          if (handlers) {
            for (const handler of handlers) {
              handler(msg.data);
            }
          }
        } catch (err) {
          console.error("[WS] Failed to parse message:", err);
        }
      };

      this.ws.onclose = () => {
        console.log("[WS] Disconnected");
        this.attemptReconnect();
      };

      this.ws.onerror = (err) => {
        console.error("[WS] Error:", err);
      };
    } catch (err) {
      console.error("[WS] Connection failed:", err);
      this.attemptReconnect();
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[WS] Max reconnect attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => this.connect(), delay);
  }

  subscribe(channel: string, handler: MessageHandler): () => void {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendSubscribe(channel);
      } else {
        this.pendingSubscriptions.push(channel);
      }
    }

    this.subscriptions.get(channel)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.subscriptions.get(channel);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.subscriptions.delete(channel);
          this.sendUnsubscribe(channel);
        }
      }
    };
  }

  private sendSubscribe(channel: string): void {
    this.send({ action: "subscribe", channel });
  }

  private sendUnsubscribe(channel: string): void {
    this.send({ action: "unsubscribe", channel });
  }

  private send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscriptions.clear();
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
let wsClient: WSClient | null = null;

export function getWSClient(): WSClient {
  if (!wsClient) {
    const url = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001/ws";
    wsClient = new WSClient(url);
    wsClient.connect();
  }
  return wsClient;
}
