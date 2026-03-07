# Atlas — Crypto Volatility Exchange

> The first crypto options exchange built around packages, portfolio risk, structured issuance, and toxic flow detection.

## Architecture

```
atlas/
├── src/
│   ├── Atlas.Core/           # Pricing models, Greeks, vol surface, risk
│   │   ├── Models/
│   │   │   ├── BlackScholes.cs       # Closed-form + all analytical Greeks
│   │   │   ├── HestonModel.cs        # Stochastic vol (moment-matching)
│   │   │   ├── MonteCarlo.cs         # GBM + antithetic variates
│   │   │   ├── BinomialTree.cs       # CRR + Richardson extrapolation
│   │   │   ├── SabrModel.cs          # Hagan asymptotic expansion
│   │   │   └── ImpliedVolSolver.cs   # Newton-Raphson + Brent fallback
│   │   ├── Common/Types.cs           # Immutable records: Trade, Greeks, etc.
│   │   └── Common/MathUtils.cs       # Normal CDF/PDF, Box-Muller
│   │
│   ├── Atlas.ToxicFlow/     # Toxic flow detection & clustering
│   │   ├── FlowClusterEngine.cs      # Main classifier (rule-based, swap w/ ML)
│   │   ├── Metrics/
│   │   │   ├── MarkoutAnalyzer.cs    # Post-trade P&L at 1s/5s/30s/5m/30m
│   │   │   └── FlowToxicityIndex.cs  # VPIN + adverse selection scoring
│   │   └── Models/FlowModels.cs      # Cluster types, toxicity levels, DTOs
│   │
│   ├── Atlas.Api/            # ASP.NET Web API
│   │   ├── Controllers/
│   │   │   ├── PricingController.cs      # /api/pricing/compare
│   │   │   └── ToxicFlowController.cs    # /api/toxicflow/dashboard
│   │   └── Services/
│   │       └── DemoDataService.cs    # ← SWAP THIS for production
│   │
│   └── Atlas.Exchange/       # Exchange connectivity abstraction
│       └── IExchangeClient.cs        # Interface for Deribit/Coinbase/etc.
│
├── tests/Atlas.Tests/        # xUnit tests
├── frontend/                  # React terminal UI
└── docker-compose.yml
```

## Quick Start

```bash
# Run the API
cd src/Atlas.Api
dotnet run

# API is at http://localhost:5000
# Swagger at http://localhost:5000/swagger
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/pricing/compare` | Price option with all 5 models |
| `GET /api/pricing/greeks` | Analytical Greeks (BS) |
| `GET /api/pricing/implied-vol` | Extract IV from market price |
| `GET /api/toxicflow/dashboard` | Full toxic flow dashboard |
| `GET /api/toxicflow/clusters` | Flow cluster summaries |
| `GET /api/toxicflow/counterparties` | Toxic counterparty profiles |
| `GET /api/toxicflow/alerts` | Recent high-toxicity alerts |
| `GET /api/toxicflow/history` | Enriched trade history |

## Pricing Models

| Model | Method | Crypto Adaptations |
|-------|--------|-------------------|
| **Black-Scholes** | Closed-form N(d₁), N(d₂) | 365.25d continuous, no biz day |
| **Heston SV** | Moment-matching + skew correction | κ=3, θ=0.40, ξ=0.80, ρ=-0.65 |
| **Monte Carlo** | GBM + antithetic variates | Parallelized, configurable paths |
| **Binomial CRR** | Recombining tree + Richardson | Configurable steps, American support |
| **SABR** | Hagan asymptotic expansion | β=0.5, calibratable ρ, ν |

## Toxic Flow Clusters

| Cluster | Detection Method |
|---------|-----------------|
| **Stale Quote Sniper** | Fast fill (<5ms) + mean-reverting markout |
| **Informed Directional** | Positive markout across all horizons |
| **Vol-Informed** | Trades before large IV moves |
| **Momentum Chaser** | Follows short-term trends |
| **Package Legger** | Exploits multi-leg pricing |
| **Gamma Scalper** | Low delta, high gamma accumulation |
| **Expiry Manipulator** | Large trades near settlement |

## Going from Demo → Production

The entire system is designed around **interface boundaries**. To go live:

1. **Market Data**: Replace `DemoDataService` with `LiveDataService` that connects to Deribit WebSocket
2. **Exchange**: Implement `IExchangeClient` for your target venue (Deribit, Coinbase, etc.)
3. **Toxic Flow ML**: Swap rule-based classifier with trained XGBoost on labeled flow data
4. **Markout**: Feed real post-trade price ticks instead of simulated markouts
5. **Database**: Add PostgreSQL/TimescaleDB for trade history persistence

```csharp
// In Program.cs, change ONE line:
// builder.Services.AddSingleton<IMarketDataProvider, DemoDataService>();
builder.Services.AddSingleton<IMarketDataProvider, DeribitLiveDataService>();
```

## Tests

```bash
cd tests/Atlas.Tests
dotnet test
```

## License

Proprietary. All rights reserved.
