import TelegramBot from "node-telegram-bot-api";
import { logger } from "./logger";
import { analyzeAsset } from "./analyzer";
import { db, signalsTable, tradesTable, assetsTable, usersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { fetchPrice } from "./market";

let bot: TelegramBot | null = null;
const ADMIN_USERNAME = "hamdhan";

function getBot(): TelegramBot | null {
  return bot;
}

export function initTelegramBot(): void {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN not set, Telegram bot disabled");
    return;
  }

  try {
    bot = new TelegramBot(token, { polling: true });
    logger.info("Telegram bot started: ham_evil_bot");

    bot.on("message", async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text?.trim() || "";

      try {
        // Command handlers
        if (text.startsWith("/profit") || text === "/p") {
          await handleProfit(chatId);
          return;
        }
        if (text.startsWith("/die ")) {
          const symbol = text.split(" ")[1]?.toUpperCase();
          if (symbol) await handleDie(chatId, symbol);
          return;
        }
        if (text === "/stats") {
          await handleStats(chatId);
          return;
        }
        if (text === "/portfolio") {
          await handleProfit(chatId);
          return;
        }
        if (text === "/start" || text === "/help") {
          await bot!.sendMessage(chatId,
            '☠️ NETHERWORLD TERMINAL — ham_evil_bot\n\nSend me a symbol + timeframe to get a signal:\nExamples: BTCUSDT 1h or EURUSD 4h\n\nSupported timeframes: 1m 5m 15m 30m 1h 4h 12h 1d\n\nAdmin Commands:\n/profit or /p — Active trades P/L\n/die SYMBOL — Force close a trade\n/stats — Todays scorecard\n/portfolio — Active positions\n\nPowered by Mr.black_a_n_o ☠️',
            { parse_mode: undefined }
          );
          return;
        }

        // Signal request: "BTCUSDT 1h" format
        const parts = text.split(/\s+/);
        if (parts.length === 2) {
          const symbol = parts[0].toUpperCase();
          const timeframe = parts[1].toLowerCase();
          const validTf = ["1m", "5m", "15m", "30m", "1h", "4h", "12h", "1d"];
          if (validTf.includes(timeframe)) {
            await handleSignalRequest(chatId, symbol, timeframe);
            return;
          }
        }
      } catch (err) {
        logger.error({ err, chatId, text }, "Telegram message handler error");
        await bot!.sendMessage(chatId, "❌ Error processing request. Try again.");
      }
    });

    bot.on("error", (err) => {
      logger.error({ err }, "Telegram bot error");
    });

    bot.on("polling_error", (err) => {
      logger.error({ err }, "Telegram polling error");
    });

  } catch (err) {
    logger.error({ err }, "Failed to initialize Telegram bot");
  }
}

async function handleSignalRequest(chatId: number, symbol: string, timeframe: string): Promise<void> {
  if (!bot) return;

  // Check for existing active trade
  const [existingTrade] = await db
    .select()
    .from(tradesTable)
    .where(and(eq(tradesTable.symbol, symbol), eq(tradesTable.isActive, true)))
    .limit(1);

  if (existingTrade) {
    await bot.sendMessage(chatId, "තාම trade එක ඉවරනෑ cuduuu😘. චුච්චක් ඉන්නො😋");
    return;
  }

  await bot.sendMessage(chatId, `🔍 Analyzing ${symbol} on ${timeframe}...`);

  const analysis = await analyzeAsset(symbol, timeframe);

  const dirEmoji = analysis.direction === "BUY" ? "🔥" : "☠️";
  const strengthLabels = ["", "🔴 VERY WEAK", "🟠 WEAK", "🟡 MODERATE", "🟢 STRONG", "⚡ ELITE"];
  const strengthLabel = strengthLabels[analysis.strength] || "🟡 MODERATE";

  const condLines = [
    `EMA200: ${analysis.conditions.ema200 ? "✅" : "❌"}`,
    `RSI Divergence: ${analysis.conditions.rsiDivergence ? "✅" : "❌"}`,
    `Volume Spike: ${analysis.conditions.volumeSpike ? "✅" : "❌"}`,
    `Support/Resistance: ${analysis.conditions.supportResistance ? "✅" : "❌"}`,
    `Momentum: ${analysis.conditions.momentum ? "✅" : "❌"}`,
  ].join("\n");

  const message =
    `${dirEmoji} *${analysis.direction} SIGNAL — ${symbol}*\n` +
    `━━━━━━━━━━━━━━━\n` +
    `📊 Timeframe: ${timeframe.toUpperCase()}\n` +
    `🕐 Entry Time: ${new Date().toUTCString()}\n` +
    `💰 Entry Price: ${analysis.entryPrice.toFixed(6)}\n` +
    `🛑 Stop Loss: ${analysis.stopLoss.toFixed(6)}\n` +
    `🎯 Take Profit: ${analysis.takeProfit.toFixed(6)}\n` +
    `━━━━━━━━━━━━━━━\n` +
    `Strength: ${analysis.strength}/5 — ${strengthLabel}\n` +
    `━━━━━━━━━━━━━━━\n` +
    `*Conditions:*\n${condLines}\n` +
    `━━━━━━━━━━━━━━━\n` +
    `_☠️ ham_evil_bot — netherworld edition_`;

  await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });

  // Save signal and trade to DB
  const [signal] = await db.insert(signalsTable).values({
    symbol,
    timeframe,
    direction: analysis.direction,
    strength: analysis.strength,
    entryPrice: analysis.entryPrice,
    stopLoss: analysis.stopLoss,
    takeProfit: analysis.takeProfit,
    conditionEma200: analysis.conditions.ema200,
    conditionRsiDivergence: analysis.conditions.rsiDivergence,
    conditionVolumeSpike: analysis.conditions.volumeSpike,
    conditionSupportResistance: analysis.conditions.supportResistance,
    conditionMomentum: analysis.conditions.momentum,
    status: "active",
  }).returning();

  await db.insert(tradesTable).values({
    signalId: signal.id,
    symbol,
    direction: analysis.direction,
    entryPrice: analysis.entryPrice,
    stopLoss: analysis.stopLoss,
    takeProfit: analysis.takeProfit,
    currentPrice: analysis.entryPrice,
    pnlPercent: 0,
    pnlAmount: 0,
    isActive: true,
  });
}

async function handleProfit(chatId: number): Promise<void> {
  if (!bot) return;

  const trades = await db
    .select()
    .from(tradesTable)
    .where(eq(tradesTable.isActive, true));

  if (trades.length === 0) {
    await bot.sendMessage(chatId, "📭 No active trades.");
    return;
  }

  let totalPnl = 0;
  let totalPct = 0;
  let lines = "🔥 *ACTIVE TRADES PROFIT/LOSS*\n━━━━━━━━━━━━━━━\n";

  for (const trade of trades) {
    try {
      const priceData = await fetchPrice(trade.symbol);
      const currentPrice = priceData.price;
      const pnlPct = trade.direction === "BUY"
        ? ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100
        : ((trade.entryPrice - currentPrice) / trade.entryPrice) * 100;
      const pnlAmt = pnlPct * 100; // assume $10k base

      totalPnl += pnlAmt;
      totalPct += pnlPct;

      const emoji = trade.direction === "BUY" ? "📈" : "📉";
      lines +=
        `${emoji} *${trade.symbol} - ${trade.direction}*\n` +
        `Entry: ${trade.entryPrice.toFixed(6)}\n` +
        `Current: ${currentPrice.toFixed(6)}\n` +
        `Profit: ${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}% | ${pnlAmt >= 0 ? "+" : ""}$${Math.abs(pnlAmt).toFixed(0)}\n` +
        `━━━━━━━━━━━━━━━\n`;
    } catch {
      lines += `⚠️ ${trade.symbol}: price fetch error\n━━━━━━━━━━━━━━━\n`;
    }
  }

  const avg = trades.length > 0 ? totalPct / trades.length : 0;
  lines += `💰 *TOTAL: ${totalPnl >= 0 ? "+" : ""}$${Math.abs(totalPnl).toFixed(0)} | ${avg >= 0 ? "+" : ""}${avg.toFixed(2)}%*`;

  await bot.sendMessage(chatId, lines, { parse_mode: "Markdown" });
}

async function handleDie(chatId: number, symbol: string): Promise<void> {
  if (!bot) return;

  const [trade] = await db
    .select()
    .from(tradesTable)
    .where(and(eq(tradesTable.symbol, symbol), eq(tradesTable.isActive, true)))
    .limit(1);

  if (!trade) {
    await bot.sendMessage(chatId, `❌ No active trade found for ${symbol}`);
    return;
  }

  const priceData = await fetchPrice(symbol);
  const exitPrice = priceData.price;
  const pnlPct = trade.direction === "BUY"
    ? ((exitPrice - trade.entryPrice) / trade.entryPrice) * 100
    : ((trade.entryPrice - exitPrice) / trade.entryPrice) * 100;
  const pnlAmt = pnlPct * 100;

  const entryTime = new Date(trade.entryTime);
  const now = new Date();
  const diffMs = now.getTime() - entryTime.getTime();
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);

  await db.update(tradesTable).set({
    isActive: false,
    currentPrice: exitPrice,
    pnlPercent: pnlPct,
    pnlAmount: pnlAmt,
    closedAt: now,
    closeReason: "manual",
    exitPrice,
  }).where(eq(tradesTable.id, trade.id));

  await db.update(signalsTable).set({ status: "closed_manual" })
    .where(eq(signalsTable.id, trade.signalId));

  const message =
    `💀 *TRADE FORCE CLOSED*\n` +
    `━━━━━━━━━━━━━━━\n` +
    `🪙 ${symbol} - ${trade.direction}\n` +
    `Entry: ${trade.entryPrice.toFixed(6)}\n` +
    `Exit: ${exitPrice.toFixed(6)} (Manual Close)\n` +
    `Result: ${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}% | ${pnlAmt >= 0 ? "+" : ""}$${Math.abs(pnlAmt).toFixed(0)}\n` +
    `Time Active: ${hours}h ${minutes}m\n` +
    `━━━━━━━━━━━━━━━\n` +
    `Trade unlocked ✅`;

  await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
}

async function handleStats(chatId: number): Promise<void> {
  if (!bot) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const allTrades = await db
    .select()
    .from(tradesTable)
    .where(eq(tradesTable.isActive, false))
    .orderBy(desc(tradesTable.closedAt));

  const todayTrades = allTrades.filter(t => t.closedAt && new Date(t.closedAt) >= today);
  const tp = todayTrades.filter(t => t.closeReason === "tp").length;
  const sl = todayTrades.filter(t => t.closeReason === "sl").length;
  const manual = todayTrades.filter(t => t.closeReason === "manual").length;
  const winRate = todayTrades.length > 0 ? (tp / todayTrades.length) * 100 : 0;

  const sorted = todayTrades.sort((a, b) => (b.pnlPercent || 0) - (a.pnlPercent || 0));
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  const message =
    `📊 *TODAY'S SCORECARD*\n` +
    `━━━━━━━━━━━━━━━\n` +
    `Total Signals: ${todayTrades.length}\n` +
    `✅ TP Hits: ${tp}\n` +
    `❌ SL Hits: ${sl}\n` +
    `💀 Manual Closes: ${manual}\n` +
    `Win Rate: ${winRate.toFixed(1)}%\n` +
    `━━━━━━━━━━━━━━━\n` +
    `🏆 Best: ${best ? `${best.symbol} ${best.pnlPercent >= 0 ? "+" : ""}${best.pnlPercent?.toFixed(2)}%` : "N/A"}\n` +
    `💀 Worst: ${worst ? `${worst.symbol} ${worst.pnlPercent >= 0 ? "+" : ""}${worst.pnlPercent?.toFixed(2)}%` : "N/A"}\n` +
    `━━━━━━━━━━━━━━━\n` +
    `_☠️ ham_evil_bot — netherworld edition_`;

  await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
}

// Hardcoded admin chat ID — all auto alerts and broadcasts go here
const ADMIN_CHAT_ID = 6897968779;

export async function broadcastToAdmin(message: string): Promise<void> {
  if (!bot) return;
  try {
    await bot.sendMessage(ADMIN_CHAT_ID, message);
  } catch (err) {
    logger.error({ err }, "Failed to broadcast to admin");
  }
}

export async function sendTelegramAlert(message: string): Promise<void> {
  await broadcastToAdmin(message);
}

export { getBot };
