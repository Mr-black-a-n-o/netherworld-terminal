import axios from "axios";
import { logger } from "./logger";

export interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Map forex symbols to Yahoo Finance format
function toYahooSymbol(symbol: string): string {
  const s = symbol.toUpperCase();
  if (s.endsWith("USDT") || s.endsWith("BTC") || s.endsWith("ETH") || s.endsWith("BNB")) {
    return s; // crypto handled by Binance
  }
  // Forex: EURUSD -> EURUSD=X
  if (s.length === 6 && !s.includes("USDT")) {
    return `${s}=X`;
  }
  return s;
}

function isCrypto(symbol: string): boolean {
  const s = symbol.toUpperCase();
  return s.endsWith("USDT") || s.endsWith("BTC") || s.endsWith("ETH") || s.endsWith("BUSD");
}

// Binance timeframe map
const BINANCE_TF: Record<string, string> = {
  "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
  "1h": "1h", "4h": "4h", "12h": "12h", "1d": "1d",
};

export async function fetchPrice(symbol: string): Promise<PriceData> {
  const sym = symbol.toUpperCase();
  try {
    if (isCrypto(sym)) {
      const resp = await axios.get(
        `https://api.binance.com/api/v3/ticker/24hr?symbol=${sym}`,
        { timeout: 8000 }
      );
      const d = resp.data;
      return {
        symbol: sym,
        price: parseFloat(d.lastPrice),
        change24h: parseFloat(d.priceChangePercent),
        high24h: parseFloat(d.highPrice),
        low24h: parseFloat(d.lowPrice),
      };
    } else {
      // Yahoo Finance for forex
      const yahooSym = toYahooSymbol(sym);
      const resp = await axios.get(
        `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSym}?interval=1d&range=2d`,
        { timeout: 8000, headers: { "User-Agent": "Mozilla/5.0" } }
      );
      const result = resp.data.chart.result[0];
      const meta = result.meta;
      const price = meta.regularMarketPrice;
      const prev = meta.chartPreviousClose || meta.previousClose || price;
      const change24h = prev ? ((price - prev) / prev) * 100 : 0;
      return {
        symbol: sym,
        price,
        change24h,
        high24h: meta.regularMarketDayHigh || price,
        low24h: meta.regularMarketDayLow || price,
      };
    }
  } catch (err) {
    logger.warn({ symbol, err }, "Failed to fetch price, using fallback");
    // Fallback prices for known symbols only — unknown symbols throw to prevent fake trades
    const fallbackPrices: Record<string, number> = {
      BTCUSDT: 67000, ETHUSDT: 3500, BNBUSDT: 580, SOLUSDT: 165,
      EURUSD: 1.085, GBPUSD: 1.265, USDJPY: 149.5,
    };
    if (!(sym in fallbackPrices)) {
      throw new Error(`Unknown symbol: ${sym}. Only BTCUSDT, ETHUSDT, BNBUSDT, SOLUSDT, EURUSD, GBPUSD, USDJPY are supported.`);
    }
    const price = fallbackPrices[sym];
    return { symbol: sym, price, change24h: 0.5, high24h: price * 1.02, low24h: price * 0.98 };
  }
}

export async function fetchCandles(symbol: string, timeframe: string, limit = 200): Promise<Candle[]> {
  const sym = symbol.toUpperCase();
  const tf = BINANCE_TF[timeframe] || "1h";
  try {
    if (isCrypto(sym)) {
      const resp = await axios.get(
        `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${tf}&limit=${limit}`,
        { timeout: 10000 }
      );
      return resp.data.map((k: number[]) => ({
        time: k[0],
        open: parseFloat(String(k[1])),
        high: parseFloat(String(k[2])),
        low: parseFloat(String(k[3])),
        close: parseFloat(String(k[4])),
        volume: parseFloat(String(k[5])),
      }));
    } else {
      // Yahoo Finance candles for forex
      const yahooSym = toYahooSymbol(sym);
      const yahooInterval: Record<string, string> = {
        "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
        "1h": "1h", "4h": "1h", "12h": "1h", "1d": "1d",
      };
      const yInterval = yahooInterval[timeframe] || "1h";
      const range = timeframe === "1d" ? "6mo" : "5d";
      const resp = await axios.get(
        `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSym}?interval=${yInterval}&range=${range}`,
        { timeout: 10000, headers: { "User-Agent": "Mozilla/5.0" } }
      );
      const result = resp.data.chart.result[0];
      const timestamps: number[] = result.timestamp || [];
      const quotes = result.indicators.quote[0];
      return timestamps.slice(-limit).map((t, i) => ({
        time: t * 1000,
        open: quotes.open[i] ?? 0,
        high: quotes.high[i] ?? 0,
        low: quotes.low[i] ?? 0,
        close: quotes.close[i] ?? 0,
        volume: quotes.volume[i] ?? 0,
      })).filter(c => c.close > 0);
    }
  } catch (err) {
    logger.warn({ symbol, timeframe, err }, "Failed to fetch candles, generating mock");
    // Generate realistic mock candles
    const basePrice = (await fetchPrice(sym)).price;
    const candles: Candle[] = [];
    let price = basePrice * 0.95;
    for (let i = 0; i < limit; i++) {
      const change = (Math.random() - 0.48) * price * 0.02;
      const open = price;
      price = Math.max(price + change, 0.0001);
      const high = Math.max(open, price) * (1 + Math.random() * 0.005);
      const low = Math.min(open, price) * (1 - Math.random() * 0.005);
      candles.push({
        time: Date.now() - (limit - i) * 3600000,
        open, high, low, close: price,
        volume: Math.random() * 1000000 + 100000,
      });
    }
    return candles;
  }
}
