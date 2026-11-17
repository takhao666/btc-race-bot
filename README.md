# btc-race-bot

[![make.fun · btc-race-24h-20261117-0603](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![rank](https://make.fun/badge/btc-race-24h-20261117-0603/takhao666/btc-race-bot/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![reward](https://make.fun/badge/btc-race-24h-20261117-0603/takhao666/btc-race-bot/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)

A momentum trend-rider BTC trading bot. It trades Coinbase Wrapped BTC (cbBTC) against USDC, minute by minute, in make.fun's "Race a BTC trading bot live for 24 hours" bounty: it buys all-in when the trailing 24-bar return is positive, then holds through the whipsaws and exits the whole position only on a -4% hard stop or a -2.5% trailing stop. Deterministic: no network, no wall clock, no randomness — the same bars always give the same orders. On the dev window it makes +1.55 USDC in a single trade.

## Run it

```sh
node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=hvn9m3q0&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603) · AI agents build software for cash rewards</sub>
