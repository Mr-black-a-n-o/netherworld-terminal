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
  if (
    s.endsWith("USDT") ||
    s.endsWith("BTC") ||
    s.endsWith("ETH") ||
    s.endsWith("BNB")
  ) {
    return s;
  }
  if (s.length === 6 && !s.includes("USDT")) {
    return `${s}=X`;
  }
  return s;
}

// Intha function-la thaan ella crypto asset-aiyum add panniyirukkom
function isCrypto(symbol: string): boolean {
  const s = symbol.toUpperCase();
  return (
    s.endsWith("USDT") ||
    s.endsWith("BTC") ||
    s.endsWith("ETH") ||
    s.endsWith("BUSD") ||
    s.includes("VELVET") ||
    s.includes("NOT") ||
    s.includes("SOL") ||
    s.includes("XRP") ||
    s.includes("AVAX") ||
    s.includes("ADA") ||
    s.includes("LINK") ||
    s.includes("DOT")
  );
}

// Binance timeframe map
const BINANCE_TF: Record<string, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "30m": "30m",
  "1h": "1h",
  "4h": "4h",
  "12h": "12h",
  "1d": "1d",
};

// Global Fallback Prices - Ingae ungaluku thaevayana extra assets-ai eziya add pannalam
const FALLBACK_PRICES: Record<string, number> = {
  BTCUSDT: 67000,
  ETHUSDT: 3500,
  BNBUSDT: 580,
  SOLUSDT: 165,
  XRPUSDT: 0.52,
  AVAXUSDT: 35.0,
  ADAUSDT: 0.45,
  LINKUSDT: 15.2,
  DOTUSDT: 6.5,
  XAUUSDT: 2350, // Gold
  VELVETUSDT: 1.2,
  NOTUSDT: 0.015,
  EURUSD: 1.085,
  GBPUSD: 1.265,
  USDJPY: 149.5,
  AUDUSD: 0.665,
};

export async function fetchPrice(symbol: string): Promise<PriceData> {
  const sym = symbol.toUpperCase().replace("/", "").replace("-", "");
  try {
    if (isCrypto(sym)) {
      const resp = await axios.get(
        `https://api.binance.com/api/v3/ticker/24hr?symbol=${sym}`,
        { timeout: 8000 },
      );
      const d = resp.data;
      return {
        symbol: sym,
        price: parseFloat(d.lastPrice) || FALLBACK_PRICES[sym] || 1.0,
        change24h: parseFloat(d.priceChangePercent) || 0,
        high24h: parseFloat(d.highPrice) || parseFloat(d.lastPrice) * 1.01,
        low24h: parseFloat(d.lowPrice) || parseFloat(d.lastPrice) * 0.99,
      };
    } else {
      // Forex via open.er-api
      const base = sym.slice(0, 3);
      const quote = sym.slice(3, 6);
      const resp = await axios.get(
        `https://open.er-api.com/v6/latest/${base}`,
        { timeout: 8000 },
      );
      const rate = resp.data.rates[quote];
      if (!rate) throw new Error(`Rate not found for ${sym}`);
      return {
        symbol: sym,
        price: rate,
        change24h: 0,
        high24h: rate * 1.005,
        low24h: rate * 0.995,
      };
    }
  } catch (err) {
    logger.warn(
      { symbol: sym, err },
      "Failed to fetch price, using fallback safely",
    );
    // Dynamic price allocation to ensure 0% crash rate
    const price = FALLBACK_PRICES[sym] || 1.0;
    return {
      symbol: sym,
      price,
      change24h: 0.5,
      high24h: price * 1.02,
      low24h: price * 0.98,
    };
  }
}

export async function fetchCandles(
  symbol: string,
  timeframe: string,
  limit = 200,
): Promise<Candle[]> {
  const sym = symbol.toUpperCase().replace("/", "").replace("-", "");
  const tf = BINANCE_TF[timeframe] || "1h";
  try {
    if (isCrypto(sym)) {
      const resp = await axios.get(
        `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${tf}&limit=${limit}`,
        { timeout: 10000 },
      );
      return resp.data.map((k: any[]) => ({
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
        "1m": "1m",
        "5m": "5m",
        "15m": "15m",
        "30m": "30m",
        "1h": "1h",
        "4h": "1h",
        "12h": "1h",
        "1d": "1d",
      };
      const yInterval = yahooInterval[timeframe] || "1h";
      const range = timeframe === "1d" ? "6mo" : "5d";
      const resp = await axios.get(
        `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSym}?interval=${yInterval}&range=${range}`,
        { timeout: 10000, headers: { "User-Agent": "Mozilla/5.0" } },
      );
      const result = resp.data.chart.result[0];
      const timestamps: number[] = result.timestamp || [];
      const quotes = result.indicators.quote[0];
      return timestamps
        .slice(-limit)
        .map((t, i) => ({
          time: t * 1000,
          open: quotes.open[i] ?? 0,
          high: quotes.high[i] ?? 0,
          low: quotes.low[i] ?? 0,
          close: quotes.close[i] ?? 0,
          volume: quotes.volume[i] ?? 0,
        }))
        .filter((c) => c.close > 0);
    }
  } catch (err) {
    logger.warn(
      { symbol: sym, timeframe, err },
      "Failed to fetch candles, generating mock safely",
    );

    // Safety Net: Safe mock generation without network call loop
    const basePrice = FALLBACK_PRICES[sym] || 1.0;
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
        open,
        high,
        low,
        close: price,
        volume: Math.random() * 1000000 + 100000,
      });
    }
    return candles;
  }
}
