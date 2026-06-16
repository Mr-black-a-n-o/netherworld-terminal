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
  const k = 2 / (period + 1);
  const ema: number[] = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calcRSI(closes: number[], period = 14): number[] {
  const rsi: number[] = new Array(period).fill(50);
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi.push(100 - 100 / (1 + rs));
  }
  return rsi;
}

function calcATR(candles: { high: number; low: number; close: number }[], period = 14): number {
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
    trs.push(tr);
  }
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
}

export async function analyzeAsset(symbol: string, timeframe: string): Promise<AnalysisResult> {
  logger.info({ symbol, timeframe }, "Analyzing asset");

  const candles = await fetchCandles(symbol, timeframe, 250);
  const priceData = await fetchPrice(symbol);

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume);
  const currentPrice = priceData.price;

  // 1. EMA200 trend confirmation
  const ema200 = calcEMA(closes, 200);
  const ema50 = calcEMA(closes, 50);
  const lastEma200 = ema200[ema200.length - 1];
  const lastEma50 = ema50[ema50.length - 1];
  const bullishTrend = currentPrice > lastEma200 && lastEma50 > lastEma200;
  const ema200Pass = bullishTrend || currentPrice < lastEma200;

  // 2. RSI divergence
  const rsi = calcRSI(closes);
  const lastRsi = rsi[rsi.length - 1];
  const prevRsi = rsi[rsi.length - 5] || 50;
  const rsiDivergencePass =
    (lastRsi < 30 && closes[closes.length - 1] > closes[closes.length - 5]) ||
    (lastRsi > 70 && closes[closes.length - 1] < closes[closes.length - 5]) ||
    (lastRsi > 45 && lastRsi < 65);

  // 3. Volume spike
  const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const lastVolume = volumes[volumes.length - 1];
  const volumeSpikePass = lastVolume > avgVolume * 1.5;

  // 4. Support/Resistance zone strength
  const recentHighs = highs.slice(-20);
  const recentLows = lows.slice(-20);
  const maxHigh = Math.max(...recentHighs);
  const minLow = Math.min(...recentLows);
  const range = maxHigh - minLow;
  const nearSupport = currentPrice <= minLow + range * 0.2;
  const nearResistance = currentPrice >= maxHigh - range * 0.2;
  const srPass = nearSupport || nearResistance;

  // 5. Momentum confirmation (MACD-style)
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signal = calcEMA(macdLine, 9);
  const lastMacd = macdLine[macdLine.length - 1];
  const lastSignal = signal[signal.length - 1];
  const prevMacd = macdLine[macdLine.length - 3] || lastMacd;
  const prevSignalLine = signal[signal.length - 3] || lastSignal;
  const momentumPass =
    (lastMacd > lastSignal && prevMacd <= prevSignalLine) ||
    (lastMacd < lastSignal && prevMacd >= prevSignalLine) ||
    Math.abs(lastMacd - lastSignal) > Math.abs(prevMacd - prevSignalLine);

  const conditions: SignalConditions = {
    ema200: ema200Pass,
    rsiDivergence: rsiDivergencePass,
    volumeSpike: volumeSpikePass,
    supportResistance: srPass,
    momentum: momentumPass,
  };

  const strength = Object.values(conditions).filter(Boolean).length;

  // Direction: based on EMA trend and RSI
  const bullish = bullishTrend && lastRsi < 70 && nearSupport;
  const direction: "BUY" | "SELL" = bullish ? "BUY" : (lastRsi > 50 && !nearResistance) ? "BUY" : "SELL";

  // Calculate ATR for SL/TP
  const atr = calcATR(candles.slice(-50));
  const atrMultiplier = timeframe === "1m" || timeframe === "5m" ? 1.5 : timeframe === "15m" || timeframe === "30m" ? 2 : 2.5;

  const entryPrice = currentPrice;
  let stopLoss: number;
  let takeProfit: number;

  if (direction === "BUY") {
    stopLoss = entryPrice - atr * atrMultiplier;
    takeProfit = entryPrice + atr * atrMultiplier * 2;
  } else {
    stopLoss = entryPrice + atr * atrMultiplier;
    takeProfit = entryPrice - atr * atrMultiplier * 2;
  }

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
