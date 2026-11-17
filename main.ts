// Trend rider bot for btc-race-24h-20261117-0603 (own design, v4).
//
// Lesson from the dev window: it is nearly flat (+0.5% drift over 24h)
// and every trade costs ~26 bps in fees/slippage/impact, so all churning
// strategies lose and the only positive baselines are the ones that buy
// once and hold. v2 churned: its fast/slow EMA cross-down exit fired 7
// times, each exit followed by a re-entry (-$31.63, 14 trades, 0 wins).
// v3 dropped the exit and passed the dev gate (+$0.68, 1 trade), but its
// EMA entry filter delayed the buy 72 bars and left the margin thin.
// v4 therefore drops the EMA filter too: enter on the first positive
// trailing return, then hold through the whipsaws and step aside only
// on a real drawdown (trailing stop) or a hard stop. It trades once per
// day at most on this window.
//
// Entry (flat, on a bar's close, filled at the next open): the trailing
// LB-bar return is positive (close above the close LB bars ago).
// All-in, one position.
// Exit (the whole position, on a bar's close): the position's value
// falls to the trailing stop (TRAIL of its peak value since entry), OR
// to the hard stop (STOP of its cost). A sell the market refuses is
// sent again on the next bar while its reason still holds. No
// take-profit: winners run.
// No network, no clock, no randomness: the same bars always give the
// same orders (exact integer comparisons for the money math).

import { BPS, runBars, type Bar, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const LB = 24; // entry momentum lookback, bars
const STOP_NUM = 960n; // hard stop: value <= cost * 960/1000 (-4%)
const STOP_DEN = 1000n;
const TRAIL_NUM = 975n; // trailing stop: value <= peak * 975/1000 (-2.5%)
const TRAIL_DEN = 1000n;
const MAX_SLIPPAGE_BPS = 100;

const closes: number[] = [];
let peakValue = 0n;

await runBars({
  onBatch(state: BarsState, batch: { bars: Bar[] }) {
    for (const bar of batch.bars) {
      closes.push(Number(bar.c));
    }
    if (state.warmingUp) return [];
    const { caps, fees } = state.hello;
    const symbol = state.hello.symbols[0].symbol;
    const held = state.positions.get(symbol);
    const orders: (SellInput | BuyInput)[] = [];
    if (held !== undefined) {
      const value = state.value(symbol, held.qty);
      if (value > peakValue) peakValue = value;
      const stopHit = value * STOP_DEN <= held.cost * STOP_NUM;
      const trailHit = peakValue > 0n && value * TRAIL_DEN <= peakValue * TRAIL_NUM;
      if (stopHit || trailHit) {
        orders.push({ side: 'sell', symbol, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS });
        peakValue = 0n;
      }
      return orders;
    }
    // Flat: enter on a positive trailing return.
    if (closes.length <= LB) return [];
    const now = closes[closes.length - 1];
    const then = closes[closes.length - 1 - LB];
    if (!(now > then)) return [];
    const slots = Math.min(state.hello.symbols.length, caps.max_open_positions);
    const stake = state.equity / BigInt(slots);
    const byWeight = (BigInt(caps.max_weight_bps) * state.equity) / BPS;
    let slice = stake < byWeight ? stake : byWeight;
    if (state.cash < slice) slice = state.cash;
    if (slice === 0n || slice < BigInt(fees.min_notional_quote_units)) return [];
    if (orders.length >= caps.max_orders_per_bar) return [];
    orders.push({ side: 'buy', symbol, notional_quote_units: slice, max_slippage_bps: MAX_SLIPPAGE_BPS });
    return orders;
  },
});
