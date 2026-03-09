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

### Core Features
- **TradingView Charts** — Real-time K-line charts powered by TradingView widget (BTC, ETH, SOL, BNB against USDT)
- **Multi-Exchange Support** — Binance, OKX, Bybit market data integration
- **8-Strategy Signal Fusion** — Advanced signal fusion engine with weighted strategies
- **Whale Activity Monitor** — Real-time whale/smart money tracking with 5-type classification
- **Position Management** — Portfolio overview with PnL tracking
- **Backtesting** — Historical strategy backtesting with performance metrics
- **Resizable Panels** — Professional trading terminal layout

### Advanced Features (V2 Supplement)

#### Market Participant Analysis
- **5-Type Classification System**:
  - Smart Whale (聪明鲸鱼): Counter-trend traders with high win rates
  - Dumb Whale (愚蠢鲸鱼): Large positions with low win rates
  - Market Maker (做市商): Liquidity providers with high turnover
  - Retail Herd (散户群体): High leverage, small positions
  - Arbitrageur (套利者): Cross-exchange arbitrage traders

#### 8-Strategy Signal Fusion
1. **S1 - Whale Tracking** (20%): Top trader vs retail L/S ratio divergence
2. **S2 - Capital Concentration** (15%): Taker buy/sell volume ratio analysis
3. **S3 - Funding Reversal** (12%): Extreme funding rate reversal signals
4. **S4 - Liquidity Grab** (10%): Liquidation cascade + stabilization detection
5. **S5 - OI Divergence** (8%): Price vs open interest divergence
6. **S6 - Retail Counter** (15%): FOMO crowding detection + counter-trade
7. **S7 - Stop Hunt** (10%): Wick analysis with volume spikes
8. **S8 - Smart Money Edge (SME)** (10%): Whale vs retail flow analysis

#### Liquidity & Flow Analysis
- **Liquidation Fuel Analysis**: Cascade detection, cluster analysis
- **Liquidity Vacuum Detection**: Order book depth monitoring, market maker retreat alerts
- **OI vs Price Divergence**: 6 scenario classification (healthy uptrend, long crowding, short squeeze, etc.)
- **Wyckoff Phase Detection**: 4-phase identification (Accumulation, Markup, Distribution, Markdown)
- **Market Microstructure**: CVD divergence, orderbook asymmetry, large trade detection

#### Risk Management
- **3-Layer Anomaly Detection**:
  - Layer 1: Data source validation
  - Layer 2: Statistical outlier detection (Z-Score, IQR, Rolling)
  - Layer 3: Market manipulation detection (flash crash, wash trading, spoofing)
- **Data Quality Score (DQS)**: Real-time data quality assessment with recommendations
- **Circuit Breaker**: Automatic trading pause on extreme conditions

## API Endpoints

### Signal Endpoints (`/api/signals`)
- `GET /current` - Current fused signal from all 8 strategies
- `GET /strategies` - Strategy configurations and weights
- `GET /history` - Signal history (last 100 signals)
- `GET /quality` - Data quality score (DQS)
- `GET /anomalies` - Detected anomalies (3-layer detection)
- `GET /circuit-breaker` - Circuit breaker status
- `POST /circuit-breaker/reset` - Reset circuit breaker

### Advanced Strategy Endpoints (`/api/signals/advanced`)
- `GET /fomo` - FOMO crowding detection (S6 detail)
- `GET /stop-hunt` - Stop hunt pattern detection (S7 detail)
- `GET /liquidation` - Liquidation fuel analysis
- `GET /liquidity-vacuum` - Liquidity vacuum detection
- `GET /oi-divergence` - OI vs price divergence (6 scenarios)
- `GET /wyckoff` - Wyckoff phase detection
- `GET /microstructure` - Market microstructure analysis

### Whale Endpoints (`/api/whale`)
- `GET /profiles` - Participant profiles (5-type classification)
- `GET /activity` - Recent whale activity feed
- `GET /sme` - Smart Money Edge (SME) index
- `GET /full-analysis` - Complete analysis (activities + profiles + SME)

### Market Endpoints (`/api/market`)
- `GET /ticker` - Real-time ticker data
- `GET /candles` - Historical OHLCV candles
- `GET /funding` - Funding rate history
- `GET /open-interest` - Open interest history
- `GET /long-short-ratio` - Top trader & retail L/S ratios

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
- [x] Phase 2: Real-time whale activity monitoring (5-type classification)
- [x] Phase 2.5: Market participant profiling & liquidity analysis (V2 Supplement)
  - [x] Enhanced participant classification (Smart/Dumb Whale, MM, Retail, Arbitrageur)
  - [x] 8-strategy signal fusion with updated weights
  - [x] FOMO crowding detection (S6)
  - [x] Stop hunt reversal detection (S7)
  - [x] Smart Money Edge (SME) index (S8)
  - [x] Liquidation fuel & cascade analysis
  - [x] Liquidity vacuum detection
  - [x] OI vs price divergence (6 scenarios)
  - [x] Wyckoff phase detection
  - [x] Market microstructure analysis
  - [x] 3-layer anomaly detection framework
  - [x] Data quality score (DQS) & circuit breaker
- [ ] Phase 3: Python signal engine integration
- [ ] Phase 4: External data source integration (CoinGlass, Glassnode)
- [ ] Phase 5: Advanced backtesting with ML optimization
- [ ] Phase 6: Live trading execution

## Data Sources

### Currently Integrated (Free)
- **Binance Futures Public API**: K-lines, funding rate, OI, L/S ratios, aggregated trades
- **CoinGecko Public API**: Fallback price data

### Planned Integration
- **CoinGlass** (Free tier): Liquidation data, exchange flows
- **Glassnode** (Free tier): On-chain metrics
- **Exchange APIs**: OKX, Bybit (currently skeleton only)

## Key Concepts

### Smart Money Edge (SME) Index
The SME index measures the relative performance of smart money vs dumb money:
- **SME > 1.5**: Smart money clearly winning, follow smart money direction
- **SME 1.0-1.5**: Smart money slightly ahead
- **SME < 1.0**: Dumb money winning, caution or wait

### Data Quality Score (DQS)
Real-time assessment of data reliability:
- **DQS ≥ 85%**: Full confidence, normal trading
- **DQS 70-85%**: Reduce position size
- **DQS < 70%**: Pause trading, data quality insufficient

### Circuit Breaker Triggers
Automatic trading pause when:
- Market drops >15% in 24h
- Data quality score <50%
- Flash crash detected (>5% move with quick recovery)
- Black swan event (>15% move in 24h)

## No API Keys Required

All current features work with **public endpoints only**:
- Binance Futures public API (no authentication)
- CoinGecko public API (no authentication)
- TradingView widget (embedded, no API key)

Exchange API keys are only needed for:
- Live trading execution (Phase 6)
- Private account data (positions, orders)
