import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import Redis from "ioredis";

interface WSMessage {
  action: "subscribe" | "unsubscribe";
  channel: string;
}

interface ClientState {
  ws: WebSocket;
  subscriptions: Set<string>;
}

const clients = new Map<string, ClientState>();
let clientIdCounter = 0;

// Redis channels to subscribe to
const REDIS_CHANNELS = [
  "market:*:candle:*",
  "market:*:ticker",
  "market:*:orderbook",
  "signals:*:fusion",
  "whale:*:activity",
  "trading:positions",
  "anomaly:alerts",
];

export function setupWebSocketGateway(app: FastifyInstance) {
  let redisSub: Redis | null = null;

  // Try to connect to Redis for Pub/Sub relay
  try {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    redisSub = new Redis(redisUrl);

    redisSub.on("connect", () => {
      console.log("[WS Gateway] Connected to Redis");
      // Subscribe to patterns
      for (const pattern of REDIS_CHANNELS) {
        redisSub!.psubscribe(pattern);
      }
    });

    redisSub.on("pmessage", (_pattern: string, channel: string, message: string) => {
      // Fan out to subscribed clients
      broadcastToChannel(channel, message);
    });

    redisSub.on("error", (err: Error) => {
      console.warn("[WS Gateway] Redis connection error:", err.message);
    });
  } catch {
    console.warn("[WS Gateway] Redis not available, running without real-time relay");
  }

  app.get("/ws", { websocket: true }, (socket: WebSocket) => {
    const clientId = `client_${++clientIdCounter}`;
    const state: ClientState = { ws: socket, subscriptions: new Set() };
    clients.set(clientId, state);

    console.log(`[WS] Client connected: ${clientId} (total: ${clients.size})`);

    socket.on("message", (raw: Buffer) => {
      try {
        const msg: WSMessage = JSON.parse(raw.toString());

        if (msg.action === "subscribe" && msg.channel) {
          state.subscriptions.add(msg.channel);
          console.log(`[WS] ${clientId} subscribed to: ${msg.channel}`);
        } else if (msg.action === "unsubscribe" && msg.channel) {
          state.subscriptions.delete(msg.channel);
        }
      } catch {
        // Ignore malformed messages
      }
    });

    socket.on("close", () => {
      clients.delete(clientId);
      console.log(`[WS] Client disconnected: ${clientId} (total: ${clients.size})`);
    });

    // Send welcome message
    socket.send(
      JSON.stringify({
        channel: "system",
        event: "connected",
        timestamp: Date.now(),
        data: { clientId },
      })
    );
  });
}

function broadcastToChannel(channel: string, message: string) {
  const payload = JSON.stringify({
    channel,
    event: "data",
    timestamp: Date.now(),
    data: JSON.parse(message),
  });

  for (const [, state] of clients) {
    if (state.subscriptions.has(channel) && state.ws.readyState === 1) {
      state.ws.send(payload);
    }
  }
}
