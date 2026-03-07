# Whale Tracker V2

Market Participant Profiling & Liquidity Analysis Trading Platform

## Architecture

```
whale-tracker-v2/
├── apps/
│   ├── web/           # Next.js 15 frontend (React 19, TailwindCSS v4)
│   └── bff/           # Fastify BFF (Backend-for-Frontend) with Binance API proxy
├── packages/
│   ├── ui/            # Shared UI utilities (cn, clsx)
│   └── shared-types/  # Shared TypeScript types
├── services/
│   └── engine/        # Python analysis engine (Phase 3+)
└── docker-compose.yml # TimescaleDB + Redis
```

## Features

- **TradingView Charts** — Real-time K-line charts powered by TradingView widget (BTC, ETH, SOL, BNB against USDT)
- **Multi-Exchange Support** — Binance, OKX, Bybit market data integration
- **Signal Fusion** — 8-strategy signal fusion engine (S1~S8)
- **Whale Activity Monitor** — Real-time whale/smart money tracking
- **Position Management** — Portfolio overview with PnL tracking
- **Backtesting** — Historical strategy backtesting (config UI ready)
- **Resizable Panels** — Professional trading terminal layout

## Quick Start (Local Development)

### Prerequisites

- Node.js 20+
- pnpm 10+

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your settings (defaults work for local dev)
```

### 3. Start the frontend only (charts work without BFF)

```bash
pnpm dev:web
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Start with BFF (for Binance API data)

```bash
# Optional: start databases
docker compose up -d

# Start both frontend and BFF
pnpm dev:all
```

## Production Deployment

### Option 1: Standalone Next.js (Frontend Only)

The frontend builds as a standalone Next.js application. Charts use TradingView widget directly (no BFF required for chart data).

```bash
# Build
pnpm --filter=@whale-tracker/web build

# The standalone output is in apps/web/.next/standalone
# Run it:
node apps/web/.next/standalone/apps/web/server.js
```

### Option 2: Docker (Full Stack)

```bash
# Build frontend
docker build -f apps/web/Dockerfile -t whale-tracker-web .

# Build BFF
docker build -f apps/bff/Dockerfile -t whale-tracker-bff .
```

### Option 3: Vercel / Netlify

Deploy `apps/web` directly. Set these environment variables:

| Variable | Description | Example |
|---|---|---|
| `NEXT_PUBLIC_BFF_URL` | BFF API URL | `https://api.yourdomain.com` |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL | `wss://api.yourdomain.com/ws` |

### BFF Environment Variables

| Variable | Description | Default |
|---|---|---|
| `BFF_PORT` | BFF server port | `3001` |
| `CORS_ORIGINS` | Allowed origins (comma-separated) | `http://localhost:3000,http://localhost:3001` |
| `ENGINE_URL` | Python engine URL | `http://localhost:8000` |
| `REDIS_URL` | Redis URL | `redis://localhost:6379` |
| `DATABASE_URL` | PostgreSQL URL | `postgresql://whale:whale_secret@localhost:5432/whale_tracker` |

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TailwindCSS v4, Zustand, TanStack Query
- **Charts**: TradingView Advanced Chart Widget
- **BFF**: Fastify 5, WebSocket, Redis pub/sub
- **Database**: TimescaleDB (PostgreSQL), Redis
- **Build**: Turborepo, pnpm workspaces

## Development Roadmap

- [x] Phase 1: Core platform structure, TradingView charts, market data
- [ ] Phase 2: Real-time whale activity monitoring
- [ ] Phase 3: Python signal engine integration
- [ ] Phase 4: Anomaly detection & circuit breakers
- [ ] Phase 5: Backtesting engine
- [ ] Phase 6: Live trading execution
