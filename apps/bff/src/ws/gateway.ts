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
  // Redis in subscriber mode must be a DEDICATED connection (cannot run regular commands)
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  const redisSub = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
  });

  redisSub.on("connect", () => {
    console.log("[WS Gateway] Redis subscriber connected");
    for (const pattern of REDIS_CHANNELS) {
      redisSub.psubscribe(pattern).catch(() => {});
    }
  });

  redisSub.on("pmessage", (_pattern: string, channel: string, message: string) => {
    broadcastToChannel(channel, message);
  });

  let redisErrorLogged = false;
  redisSub.on("error", (err: Error) => {
    // Suppress noisy connection/subscriber errors in dev — Redis is optional
    if (!redisErrorLogged) {
      console.warn("[WS Gateway] Redis error (suppressing repeats):", err.message);
      redisErrorLogged = true;
    }
  });

  redisSub.connect().catch(() => {
    console.warn("[WS Gateway] Redis not available — running without real-time relay (polling mode)");
  });

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
