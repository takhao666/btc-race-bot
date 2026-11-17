// Trend rider bot for btc-race-24h-20261117-0603 (own design, v2).
//
// Lesson from the dev window: it is nearly flat (+0.2% drift over 24h)
// and every trade costs ~6 bps + impact, so all churning strategies lose
// and the only positive baselines are the ones that buy once and hold.
// This bot therefore behaves like buy-and-hold when the trend is up, but
// unlike buy-and-hold it steps aside when the trend turns down, and it
// can re-enter if the trend turns back up. It trades a handful of times
// per day at most.
//
// Entry (flat, on a bar's close, filled at the next open): the trailing
// LB-bar return is positive (close above the close LB bars ago) AND the
// fast EMA is above the slow EMA. All-in, one position.
// Exit (the whole position, on a bar's close): the fast EMA crosses below
// the slow EMA, OR the position's value falls to the trailing stop
// (TRAIL of its peak value since entry), OR to the hard stop (STOP of
// its cost). A sell the market refuses is sent again on the next bar
// while its reason still holds. No take-profit: winners run.
// No network, no clock, no randomness: the same bars always give the
// same orders (float64 EMAs on + - * / only, exact integer comparisons
// for the money math).

import { BPS, runBars, type Bar, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const LB = 24; // entry momentum lookback, bars
const FAST = 24; // fast EMA span, bars
const SLOW = 192; // slow EMA span, bars
const STOP_NUM = 960n; // hard stop: value <= cost * 960/1000 (-4%)
const STOP_DEN = 1000n;
const TRAIL_NUM = 975n; // trailing stop: value <= peak * 975/1000 (-2.5%)
const TRAIL_DEN = 1000n;
const MAX_SLIPPAGE_BPS = 100;

let fastValue: number | null = null;
let slowValue: number | null = null;
const fastWarm: number[] = [];
const slowWarm: number[] = [];
const closes: number[] = [];
let gapPrev: number | null = null; // fast - slow on the previous bar
let peakValue = 0n;

function emaStep(warm: number[], value: { v: number | null }, span: number, close: number): number | null {
  if (value.v !== null) {
    value.v += (2 / (span + 1)) * (close - value.v);
    return value.v;
  }
  warm.push(close);
  if (warm.length === span) value.v = warm.reduce((a, x) => a + x, 0) / span;
  return value.v;
}

const fastBox = { v: null as number | null };
const slowBox = { v: null as number | null };

await runBars({
  onBatch(state: BarsState, batch: { bars: Bar[] }) {
    let crossDown = false;
    for (const bar of batch.bars) {
      const c = Number(bar.c);
      closes.push(c);
      const f = emaStep(fastWarm, fastBox, FAST, c);
      const s = emaStep(slowWarm, slowBox, SLOW, c);
      fastValue = f;
      slowValue = s;
      if (f !== null && s !== null) {
        const gap = f - s;
        if (gapPrev !== null && gap < 0 && gapPrev >= 0) crossDown = true;
        gapPrev = gap;
      }
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
      if (crossDown || stopHit || trailHit) {
        orders.push({ side: 'sell', symbol, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS });
        peakValue = 0n;
      }
      return orders;
    }
    // Flat: enter only on a positive trailing return with fast above slow.
    if (closes.length <= LB) return [];
    const now = closes[closes.length - 1];
    const then = closes[closes.length - 1 - LB];
    if (!(now > then)) return [];
    if (fastValue === null || slowValue === null || !(fastValue > slowValue)) return [];
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
