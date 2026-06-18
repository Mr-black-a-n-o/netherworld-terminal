import { fetchCandles, fetchPrice } from "./market";
import { logger } from "./logger";

export interface SignalConditions {
  ema200: boolean;
  rsiDivergence: boolean;
  volumeSpike: boolean;
  supportResistance: boolean;
  momentum: boolean;
}

export interface AnalysisResult {
  symbol: string;
  timeframe: string;
  direction: "BUY" | "SELL";
  strength: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  conditions: SignalConditions;
}

function calcEMA(prices: number[], period: number): number[] {
  if (prices.length < period) return prices.map(() => prices[prices.length - 1]);
  const k = 2 / (period + 1);
  const ema: number[] = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function calcMACD(closes: number[]): { macd: number; signal: number } {
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = calcEMA(macdLine, 9);
  return {
    macd: macdLine[macdLine.length - 1],
    signal: signalLine[signalLine.length - 1],
  };
}

export async function analyzeAsset(symbol: string, timeframe: string): Promise<AnalysisResult> {
  logger.info({ symbol, timeframe }, "Analyzing asset");

  const candles = await fetchCandles(symbol, timeframe, 250);
  const priceData = await fetchPrice(symbol);
  const currentPrice = priceData.price;

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume);

  // ── 1. EMA200: price must be above (BUY) or below (SELL) the 200-period EMA ──
  const ema200 = calcEMA(closes, 200);
  const lastEma200 = ema200[ema200.length - 1];
  const aboveEma200 = currentPrice > lastEma200;
  const ema200Pass = aboveEma200 || !aboveEma200; // always compute, direction decides

  // ── 2. RSI: oversold (<= 40) for BUY, overbought (>= 60) for SELL ──────────
  const lastRsi = calcRSI(closes.slice(-30));
  const rsiOversold = lastRsi <= 40;
  const rsiOverbought = lastRsi >= 60;
  // Pass when RSI confirms the direction we'll pick
  const rsiDivergencePass = rsiOversold || rsiOverbought;

  // ── 3. Volume spike: last bar > 1.5× 20-bar average ──────────────────────
  const avgVolume = volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
  const lastVolume = volumes[volumes.length - 1];
  const volumeSpikePass = lastVolume > avgVolume * 1.5;

  // ── 4. Support/Resistance: price near recent swing high or low ────────────
  const recentHighs = highs.slice(-20);
  const recentLows = lows.slice(-20);
  const maxHigh = Math.max(...recentHighs);
  const minLow = Math.min(...recentLows);
  const range = maxHigh - minLow;
  const nearSupport = range > 0 && currentPrice <= minLow + range * 0.25;
  const nearResistance = range > 0 && currentPrice >= maxHigh - range * 0.25;
  const srPass = nearSupport || nearResistance;

  // ── 5. Momentum (MACD crossover) ─────────────────────────────────────────
  const { macd, signal: macdSignal } = calcMACD(closes);
  const prev = calcMACD(closes.slice(0, -2));
  const momentumPass =
    (macd > macdSignal && prev.macd <= prev.signal) || // bullish cross
    (macd < macdSignal && prev.macd >= prev.signal);   // bearish cross

  // ── Direction decision ─────────────────────────────────────────────────────
  // Strict rules:
  //   BUY  → price above EMA200 AND RSI oversold/neutral-low (< 55)
  //   SELL → price below EMA200 AND RSI overbought/neutral-high (> 45)
  let direction: "BUY" | "SELL";
  if (aboveEma200 && lastRsi < 55) {
    direction = "BUY";
  } else if (!aboveEma200 && lastRsi > 45) {
    direction = "SELL";
  } else {
    // Tiebreak by EMA position
    direction = aboveEma200 ? "BUY" : "SELL";
  }

  // ── Condition pass/fail relative to chosen direction ─────────────────────
  const conditions: SignalConditions = {
    ema200: direction === "BUY" ? aboveEma200 : !aboveEma200,
    rsiDivergence: direction === "BUY" ? lastRsi <= 45 : lastRsi >= 55,
    volumeSpike: volumeSpikePass,
    supportResistance: direction === "BUY" ? nearSupport : nearResistance,
    momentum: direction === "BUY" ? macd > macdSignal : macd < macdSignal,
  };

  const strength = Object.values(conditions).filter(Boolean).length;

  // ── Fixed TP/SL: 2% profit target, 1% stop loss ──────────────────────────
  const entryPrice = currentPrice;
  const stopLoss = direction === "BUY"
    ? entryPrice * 0.99   // -1%
    : entryPrice * 1.01;  // +1%
  const takeProfit = direction === "BUY"
    ? entryPrice * 1.02   // +2%
    : entryPrice * 0.98;  // -2%

  return {
    symbol,
    timeframe,
    direction,
    strength,
    entryPrice,
    stopLoss,
    takeProfit,
    conditions,
  };
}
