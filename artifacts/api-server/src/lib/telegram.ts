import TelegramBot from "node-telegram-bot-api";
import { logger } from "./logger";
import { analyzeAsset } from "./analyzer";
import { db, signalsTable, tradesTable, assetsTable, usersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { fetchPrice } from "./market";

function fmtPrice(n: number): string {
  if (n >= 1) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n.toFixed(6);
}

function fmtDuration(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

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
        // /die alone → close ALL trades | /die SYMBOL → close one
        if (text === "/die") {
          await handleDieAll(chatId);
          return;
        }
        if (text.startsWith("/die ")) {
          const symbol = text.split(" ")[1]?.toUpperCase();
          if (symbol) await handleDie(chatId, symbol);
          return;
        }
        if (text === "/go") {
          await handleGo(chatId);
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
            '☠️ NETHERWORLD TERMINAL — ham_evil_bot\n\n' +
            'Send me a symbol + timeframe to get a signal:\n' +
            'Examples: BTCUSDT 1h or EURUSD 4h\n\n' +
            'Supported timeframes: 1m 5m 15m 30m 1h 4h 12h 1d\n\n' +
            'Admin Commands:\n' +
            '/go — Scan ALL assets now & send signals\n' +
            '/profit or /p — Active trades P/L\n' +
            '/die — Force close ALL active trades\n' +
            '/die SYMBOL — Force close one trade\n' +
            '/stats — Today\'s scorecard\n' +
            '/portfolio — Active positions\n\n' +
            'Powered by Mr.black_a_n_o ☠️',
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

    // Auto signal every 15 minutes
    setInterval(async () => {
      try {
        await handleGo(ADMIN_CHAT_ID);
      } catch (err) {
        logger.error({ err }, "Auto signal error");
      }
    }, 15 * 60 * 1000);

    // TP/SL monitor every 2 minutes
    setInterval(async () => {
      try {
        await monitorTrades();
      } catch (err) {
        logger.error({ err }, "Trade monitor error");
      }
    }, 2 * 60 * 1000);

    logger.info("Auto signal + TP/SL monitor started");

  } catch (err) {
    logger.error({ err }, "Failed to initialize Telegram bot");
  }
}

const VALID_SYMBOLS = new Set([
  "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT",
  "EURUSD", "GBPUSD", "USDJPY",
]);

async function handleSignalRequest(chatId: number, symbol: string, timeframe: string): Promise<void> {
  if (!bot) return;

  if (!VALID_SYMBOLS.has(symbol)) {
    await bot.sendMessage(
      chatId,
      `❌ Unknown symbol: ${symbol}\n\nSupported: BTCUSDT, ETHUSDT, BNBUSDT, SOLUSDT, EURUSD, GBPUSD, USDJPY`
    );
    return;
  }

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

// /go — analyze ALL active assets and send a signal for each one
async function handleGo(chatId: number): Promise<void> {
  if (!bot) return;

  const assets = await db
    .select()
    .from(assetsTable)
    .where(eq(assetsTable.isActive, true));

  if (assets.length === 0) {
    await bot.sendMessage(chatId, "⚠️ No active assets configured.");
    return;
  }

  await bot.sendMessage(chatId, `⚡ Scanning ${assets.length} assets... stand by ☠️`);

  const STRENGTH_LABELS: Record<number, string> = {
    1: "VERY WEAK", 2: "WEAK", 3: "MODERATE", 4: "STRONG", 5: "ELITE",
  };

  let sent = 0;
  let skipped = 0;

  for (const asset of assets) {
    try {
      // Skip if trade already open
      const [existing] = await db
        .select()
        .from(tradesTable)
        .where(and(eq(tradesTable.symbol, asset.symbol), eq(tradesTable.isActive, true)))
        .limit(1);

      if (existing) {
        skipped++;
        continue;
      }

      const analysis = await analyzeAsset(asset.symbol, "1h");

      // Skip weak signals (less than 2 conditions pass)
      if (analysis.strength < 2) {
        skipped++;
        continue;
      }

      const dirEmoji = analysis.direction === "BUY" ? "📈" : "📉";
      const strengthLabel = STRENGTH_LABELS[analysis.strength] || "MODERATE";
      const c = analysis.conditions;

      const msg =
        `⚡ SIGNAL — ${asset.symbol}\n` +
        `━━━━━━━━━━━━━━━\n` +
        `${dirEmoji} ${analysis.direction}\n` +
        `💰 Entry: ${fmtPrice(analysis.entryPrice)}\n` +
        `🎯 TP: ${fmtPrice(analysis.takeProfit)}\n` +
        `🛑 SL: ${fmtPrice(analysis.stopLoss)}\n` +
        `⚡ Strength: ${strengthLabel} ${analysis.strength}/5\n` +
        `${c.ema200 ? "✅" : "❌"} EMA200: ${c.ema200 ? "Pass" : "Fail"}\n` +
        `${c.rsiDivergence ? "✅" : "❌"} RSI: ${c.rsiDivergence ? "Pass" : "Fail"}\n` +
        `${c.volumeSpike ? "✅" : "❌"} Volume: ${c.volumeSpike ? "Pass" : "Fail"}\n` +
        `${c.supportResistance ? "✅" : "❌"} S/R Zone: ${c.supportResistance ? "Pass" : "Fail"}\n` +
        `${c.momentum ? "✅" : "❌"} Momentum: ${c.momentum ? "Pass" : "Fail"}\n` +
        `━━━━━━━━━━━━━━━\n` +
        `📊 Timeframe: 1h`;

      await bot.sendMessage(chatId, msg);

      // Save signal + trade to DB
      const [signal] = await db.insert(signalsTable).values({
        symbol: asset.symbol,
        timeframe: "1h",
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
        symbol: asset.symbol,
        direction: analysis.direction,
        entryPrice: analysis.entryPrice,
        stopLoss: analysis.stopLoss,
        takeProfit: analysis.takeProfit,
        currentPrice: analysis.entryPrice,
        pnlPercent: 0,
        pnlAmount: 0,
        isActive: true,
      });

      sent++;
    } catch (err) {
      logger.error({ err, symbol: asset.symbol }, "/go analysis error");
      await bot.sendMessage(chatId, `⚠️ ${asset.symbol}: failed to analyze`);
    }
  }

  await bot.sendMessage(
    chatId,
    `✅ /go complete — ${sent} signal(s) sent, ${skipped} skipped (trade already open)`
  );
}

// /die (no args) — force close ALL active trades at once
async function handleDieAll(chatId: number): Promise<void> {
  if (!bot) return;

  const activeTrades = await db
    .select()
    .from(tradesTable)
    .where(eq(tradesTable.isActive, true));

  if (activeTrades.length === 0) {
    await bot.sendMessage(chatId, "📭 No active trades to close.");
    return;
  }

  const now = new Date();
  let totalPnlAmt = 0;
  let totalPnlPct = 0;
  const lines: string[] = [];

  for (const trade of activeTrades) {
    try {
      const priceData = await fetchPrice(trade.symbol);
      const exitPrice = priceData.price;
      const pnlPct = trade.direction === "BUY"
        ? ((exitPrice - trade.entryPrice) / trade.entryPrice) * 100
        : ((trade.entryPrice - exitPrice) / trade.entryPrice) * 100;
      const pnlAmt = pnlPct * 100;

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

      totalPnlAmt += pnlAmt;
      totalPnlPct += pnlPct;

      const sign = pnlPct >= 0 ? "+" : "";
      const amtSign = pnlAmt >= 0 ? "+" : "";
      lines.push(`🪙 ${trade.symbol} ${trade.direction}: ${sign}${pnlPct.toFixed(2)}% | ${amtSign}$${Math.abs(pnlAmt).toFixed(0)}`);
    } catch (err) {
      logger.error({ err, tradeId: trade.id }, "/die all — error closing trade");
      lines.push(`⚠️ ${trade.symbol}: failed to close`);
    }
  }

  const totalSign = totalPnlAmt >= 0 ? "+" : "";
  const avgPct = activeTrades.length > 0 ? totalPnlPct / activeTrades.length : 0;
  const avgSign = avgPct >= 0 ? "+" : "";

  const msg =
    `💀 ALL TRADES FORCE CLOSED\n` +
    `━━━━━━━━━━━━━━━\n` +
    lines.join("\n") + "\n" +
    `━━━━━━━━━━━━━━━\n` +
    `💰 TOTAL: ${totalSign}$${Math.abs(totalPnlAmt).toFixed(0)} | ${avgSign}${avgPct.toFixed(2)}%\n` +
    `All trades unlocked ✅`;

  await bot.sendMessage(chatId, msg);
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

// TP/SL monitor
async function monitorTrades(): Promise<void> {
  const activeTrades = await db
    .select()
    .from(tradesTable)
    .where(eq(tradesTable.isActive, true));

  if (activeTrades.length === 0) return;

  const now = new Date();

  for (const trade of activeTrades) {
    try {
      const priceData = await fetchPrice(trade.symbol);
      const currentPrice = priceData.price;

      const tpHit = trade.direction === "BUY"
        ? currentPrice >= trade.takeProfit
        : currentPrice <= trade.takeProfit;

      const slHit = trade.direction === "BUY"
        ? currentPrice <= trade.stopLoss
        : currentPrice >= trade.stopLoss;

      if (!tpHit && !slHit) continue;

      const reason = tpHit ? "tp" : "sl";
      const pnlPct = trade.direction === "BUY"
        ? ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100
        : ((trade.entryPrice - currentPrice) / trade.entryPrice) * 100;
      const pnlAmt = pnlPct * 100;

      await db.update(tradesTable).set({
        isActive: false,
        currentPrice,
        pnlPercent: pnlPct,
        pnlAmount: pnlAmt,
        closedAt: now,
        closeReason: reason,
        exitPrice: currentPrice,
      }).where(eq(tradesTable.id, trade.id));

      await db.update(signalsTable).set({
        status: reason === "tp" ? "closed_tp" : "closed_sl",
      }).where(eq(signalsTable.id, trade.signalId));

      const emoji = tpHit ? "✅" : "❌";
      const msg =
        `${emoji} *TRADE ${tpHit ? "TAKE PROFIT HIT" : "STOP LOSS HIT"}*
` +
        `━━━━━━━━━━━━━━━
` +
        `🪙 ${trade.symbol} - ${trade.direction}
` +
        `Entry: ${trade.entryPrice.toFixed(6)}
` +
        `Exit: ${currentPrice.toFixed(6)}
` +
        `Result: ${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}% | ${pnlAmt >= 0 ? "+" : ""}$${Math.abs(pnlAmt).toFixed(0)}
` +
        `━━━━━━━━━━━━━━━
` +
        `${tpHit ? "Coin unlocked for next signal ✅" : "Trade closed to protect capital 🛡️"}`;

      if (bot) await bot.sendMessage(ADMIN_CHAT_ID, msg, { parse_mode: "Markdown" });

    } catch (err) {
      logger.error({ err, tradeId: trade.id }, "Error monitoring trade");
    }
  }
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
