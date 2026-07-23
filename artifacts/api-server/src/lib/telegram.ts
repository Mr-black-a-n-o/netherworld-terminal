import TelegramBot from "node-telegram-bot-api";
import { logger } from "./logger";
import { analyzeAsset } from "./analyzer";
import { db, signalsTable, tradesTable, assetsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { fetchPrice } from "./market";

function fmtPrice(n: number): string {
  if (n >= 1) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n.toFixed(6);
}

let bot: TelegramBot | null = null;
const ADMIN_CHAT_ID = 6897968779;

export function getBot(): TelegramBot | null { return bot; }

export function initTelegramBot(): void {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) { logger.warn("TELEGRAM_BOT_TOKEN not set"); return; }
  try {
    bot = new TelegramBot(token, { polling: true });
    logger.info("Telegram bot started: ham_evil_bot");
    bot.on("message", async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text?.trim() || "";
      try {
        if (text === "/profit" || text === "/p") { await handleProfit(chatId); return; }
        if (text === "/die") { await handleDieAll(chatId); return; }
        if (text.startsWith("/die ")) { const s = text.split(" ")[1]?.toUpperCase(); if (s) await handleDie(chatId, s); return; }
        if (text === "/go") { await handleGo(chatId, false); return; }
        if (text === "/stats") { await handleStats(chatId); return; }
        if (text === "/start" || text === "/help") {
          await bot!.sendMessage(chatId, "NETHERWORLD TERMINAL\n\n/go - Scan assets\n/profit - Active P/L\n/die - Close all\n/die SYMBOL - Close one\n/stats - Scorecard\n\nOr send: BTCUSDT 1h");
          return;
        }
        const parts = text.split(/\s+/);
        if (parts.length === 2) {
          const sym = parts[0].toUpperCase();
          const tf = parts[1].toLowerCase();
          if (["1m","5m","15m","30m","1h","4h","12h","1d"].includes(tf)) {
            await handleSignalRequest(chatId, sym, tf);
          }
        }
      } catch (err) {
        logger.error({ err }, "Message handler error");
        try { await bot!.sendMessage(chatId, "Error. Try again."); } catch(e) {}
      }
    });
    bot.on("polling_error", (err: any) => {
      if (err?.response?.statusCode === 409) { logger.warn("Duplicate bot"); bot?.stopPolling(); return; }
      logger.error({ err }, "Polling error");
    });
    setInterval(async () => { try { await handleGo(ADMIN_CHAT_ID, true); } catch(e) {} }, 15 * 60 * 1000);
    setInterval(async () => { try { await monitorTrades(); } catch(e) {} }, 2 * 60 * 1000);
    logger.info("Bot ready");
  } catch (err) { logger.error({ err }, "Failed to init bot"); }
}

async function handleSignalRequest(chatId: number, symbol: string, timeframe: string): Promise<void> {
  if (!bot) return;
  const [existing] = await db.select().from(tradesTable).where(and(eq(tradesTable.symbol, symbol), eq(tradesTable.isActive, true))).limit(1);
  if (existing) { await bot.sendMessage(chatId, "තාම trade එක ඉවරනෑ cuduuu😘. චුච්චක් ඉන්නො😋"); return; }
  await bot.sendMessage(chatId, "Analyzing " + symbol + " " + timeframe + "...");
  const a = await analyzeAsset(symbol, timeframe);
  const c = a.conditions;
  const labels: Record<number,string> = {1:"VERY WEAK",2:"WEAK",3:"MODERATE",4:"STRONG",5:"ELITE"};
  const emoji = a.direction === "BUY" ? "🟢" : "🔴";
  const strengthEmoji: Record<number,string> = {1:"⚪",2:"🟡",3:"🟠",4:"🟢",5:"🔥"};
  const labels2: Record<number,string> = {1:"VERY WEAK",2:"WEAK",3:"MODERATE",4:"STRONG",5:"ELITE"};
  await bot.sendMessage(chatId,
    "┌─────────────────────┐\n" +
    "│  ⚡ " + symbol + " SIGNAL  │\n" +
    "└─────────────────────┘\n" +
    emoji + " *" + a.direction + "* — " + (labels2[a.strength]||"MODERATE") + " " + (strengthEmoji[a.strength]||"🟡") + "\n\n" +
    "💰 Entry:  `" + fmtPrice(a.entryPrice) + "`\n" +
    "🎯 TP:     `" + fmtPrice(a.takeProfit) + "`\n" +
    "🛑 SL:     `" + fmtPrice(a.stopLoss) + "`\n\n" +
    "📊 Conditions:\n" +
    (c.ema200?"✅":"❌") + " EMA200   " + (c.rsiDivergence?"✅":"❌") + " RSI\n" +
    (c.volumeSpike?"✅":"❌") + " Volume   " + (c.supportResistance?"✅":"❌") + " S/R Zone\n" +
    (c.momentum?"✅":"❌") + " Momentum\n\n" +
    "🕐 " + timeframe.toUpperCase() + "  |  ☠️ _ham\_evil\_bot_",
    { parse_mode: "Markdown" }
  );
  const [signal] = await db.insert(signalsTable).values({ symbol, timeframe, direction: a.direction, strength: a.strength, entryPrice: a.entryPrice, stopLoss: a.stopLoss, takeProfit: a.takeProfit, conditionEma200: c.ema200, conditionRsiDivergence: c.rsiDivergence, conditionVolumeSpike: c.volumeSpike, conditionSupportResistance: c.supportResistance, conditionMomentum: c.momentum, status: "active" }).returning();
  await db.insert(tradesTable).values({ signalId: signal.id, symbol, direction: a.direction, entryPrice: a.entryPrice, stopLoss: a.stopLoss, takeProfit: a.takeProfit, currentPrice: a.entryPrice, pnlPercent: 0, pnlAmount: 0, isActive: true });
}

async function handleProfit(chatId: number): Promise<void> {
  if (!bot) return;
  const trades = await db.select().from(tradesTable).where(eq(tradesTable.isActive, true));
  if (trades.length === 0) { await bot.sendMessage(chatId, "No active trades."); return; }
  let totalPnl = 0, totalPct = 0;
  let lines = "🔥 *ACTIVE TRADES P/L*\n━━━━━━━━━━━━━━━━━━━━\n";
  for (const trade of trades) {
    try {
      const price = (await fetchPrice(trade.symbol)).price;
      const pct = trade.direction === "BUY" ? ((price - trade.entryPrice) / trade.entryPrice) * 100 : ((trade.entryPrice - price) / trade.entryPrice) * 100;
      const amt = pct * 100;
      totalPnl += amt; totalPct += pct;
      lines += (trade.direction === "BUY" ? "📈" : "📉") + " " + trade.symbol + "\nEntry: " + fmtPrice(trade.entryPrice) + "\nNow: " + fmtPrice(price) + "\nP/L: " + (pct >= 0 ? "+" : "") + pct.toFixed(2) + "% | $" + Math.abs(amt).toFixed(0) + "\n━━━━━━━━━━━━━━━\n";
    } catch { lines += "⚠️ " + trade.symbol + ": error\n━━━━━━━━━━━━━━━\n"; }
  }
  const avg = trades.length > 0 ? totalPct / trades.length : 0;
  lines += "━━━━━━━━━━━━━━━━━━━━\n💰 *TOTAL: " + (totalPnl >= 0 ? "+" : "") + "$" + Math.abs(totalPnl).toFixed(0) + "* | " + (avg >= 0 ? "+" : "") + avg.toFixed(2) + "%\n_☠️ ham\_evil\_bot_";
  await bot.sendMessage(chatId, lines, { parse_mode: "Markdown" });
}

async function handleDie(chatId: number, symbol: string): Promise<void> {
  if (!bot) return;
  const [trade] = await db.select().from(tradesTable).where(and(eq(tradesTable.symbol, symbol), eq(tradesTable.isActive, true))).limit(1);
  if (!trade) { await bot.sendMessage(chatId, "No active trade for " + symbol); return; }
  const exit = (await fetchPrice(symbol)).price;
  const pct = trade.direction === "BUY" ? ((exit - trade.entryPrice) / trade.entryPrice) * 100 : ((trade.entryPrice - exit) / trade.entryPrice) * 100;
  const amt = pct * 100;
  const now = new Date();
  await db.update(tradesTable).set({ isActive: false, currentPrice: exit, pnlPercent: pct, pnlAmount: amt, closedAt: now, closeReason: "manual", exitPrice: exit }).where(eq(tradesTable.id, trade.id));
  await db.update(signalsTable).set({ status: "closed_manual" }).where(eq(signalsTable.id, trade.signalId));
  await bot.sendMessage(chatId,
    "💀 *TRADE CLOSED — " + symbol + "*\n" +
    "━━━━━━━━━━━━━━━━━━━━\n" +
    "📥 Entry:  `" + fmtPrice(trade.entryPrice) + "`\n" +
    "📤 Exit:   `" + fmtPrice(exit) + "`\n" +
    "━━━━━━━━━━━━━━━━━━━━\n" +
    (pct >= 0 ? "💚 Profit: *+" : "🔴 Loss: *") + pct.toFixed(2) + "%* | $" + Math.abs(amt).toFixed(0) + "\n" +
    "🔓 Trade unlocked ✅\n" +
    "_☠️ ham\_evil\_bot_",
    { parse_mode: "Markdown" }
  );
}

async function handleDieAll(chatId: number): Promise<void> {
  if (!bot) return;
  const trades = await db.select().from(tradesTable).where(eq(tradesTable.isActive, true));
  if (trades.length === 0) { await bot.sendMessage(chatId, "No active trades."); return; }
  const now = new Date();
  let totalAmt = 0, totalPct = 0;
  const lines: string[] = [];
  for (const trade of trades) {
    try {
      const exit = (await fetchPrice(trade.symbol)).price;
      const pct = trade.direction === "BUY" ? ((exit - trade.entryPrice) / trade.entryPrice) * 100 : ((trade.entryPrice - exit) / trade.entryPrice) * 100;
      const amt = pct * 100;
      await db.update(tradesTable).set({ isActive: false, currentPrice: exit, pnlPercent: pct, pnlAmount: amt, closedAt: now, closeReason: "manual", exitPrice: exit }).where(eq(tradesTable.id, trade.id));
      await db.update(signalsTable).set({ status: "closed_manual" }).where(eq(signalsTable.id, trade.signalId));
      totalAmt += amt; totalPct += pct;
      lines.push(trade.symbol + " " + trade.direction + ": " + (pct >= 0 ? "+" : "") + pct.toFixed(2) + "% | $" + Math.abs(amt).toFixed(0));
    } catch { lines.push("⚠️ " + trade.symbol + ": failed"); }
  }
  const avg = trades.length > 0 ? totalPct / trades.length : 0;
  await bot.sendMessage(chatId,
    "💀 *ALL TRADES FORCE CLOSED*\n" +
    "━━━━━━━━━━━━━━━━━━━━\n" +
    lines.join("\n") + "\n" +
    "━━━━━━━━━━━━━━━━━━━━\n" +
    "💰 TOTAL: *" + (totalAmt >= 0 ? "+" : "") + "$" + Math.abs(totalAmt).toFixed(0) + "* | " + (avg >= 0 ? "+" : "") + avg.toFixed(2) + "%\n" +
    "🔓 All trades unlocked ✅\n" +
    "_☠️ ham\_evil\_bot_",
    { parse_mode: "Markdown" }
  );
}

async function handleGo(chatId: number, silent: boolean): Promise<void> {
  if (!bot) return;
  const assets = await db.select().from(assetsTable).where(eq(assetsTable.isActive, true));
  if (assets.length === 0) { if (!silent) await bot.sendMessage(chatId, "No assets."); return; }
  if (!silent) await bot.sendMessage(chatId, "Scanning " + assets.length + " assets...");
  let sent = 0, skipped = 0;
  const labels: Record<number,string> = {1:"VERY WEAK",2:"WEAK",3:"MODERATE",4:"STRONG",5:"ELITE"};
  for (const asset of assets) {
    try {
      const [existing] = await db.select().from(tradesTable).where(and(eq(tradesTable.symbol, asset.symbol), eq(tradesTable.isActive, true))).limit(1);
      if (existing) { skipped++; continue; }
      const a = await analyzeAsset(asset.symbol, "1h");
      const minStrength = silent ? 3 : 1;
      if (a.strength < minStrength) { skipped++; continue; }
      const c = a.conditions;
      const emoji = a.direction === "BUY" ? "🟢" : "🔴";
      const strengthEmoji: Record<number,string> = {1:"⚪",2:"🟡",3:"🟠",4:"🟢",5:"🔥"};
      await bot.sendMessage(chatId,
        "┌─────────────────────┐\n" +
        "│  ⚡ " + asset.symbol + " SIGNAL  │\n" +
        "└─────────────────────┘\n" +
        emoji + " *" + a.direction + "* — " + (labels[a.strength]||"MODERATE") + " " + (strengthEmoji[a.strength]||"🟡") + "\n\n" +
        "💰 Entry:  `" + fmtPrice(a.entryPrice) + "`\n" +
        "🎯 TP:     `" + fmtPrice(a.takeProfit) + "`\n" +
        "🛑 SL:     `" + fmtPrice(a.stopLoss) + "`\n\n" +
        "📊 Conditions:\n" +
        (c.ema200?"✅":"❌") + " EMA200   " + (c.rsiDivergence?"✅":"❌") + " RSI\n" +
        (c.volumeSpike?"✅":"❌") + " Volume   " + (c.supportResistance?"✅":"❌") + " S/R Zone\n" +
        (c.momentum?"✅":"❌") + " Momentum\n\n" +
        "🕐 1H  |  ☠️ _ham\_evil\_bot_",
        { parse_mode: "Markdown" }
      );
      const [signal] = await db.insert(signalsTable).values({ symbol: asset.symbol, timeframe: "1h", direction: a.direction, strength: a.strength, entryPrice: a.entryPrice, stopLoss: a.stopLoss, takeProfit: a.takeProfit, conditionEma200: c.ema200, conditionRsiDivergence: c.rsiDivergence, conditionVolumeSpike: c.volumeSpike, conditionSupportResistance: c.supportResistance, conditionMomentum: c.momentum, status: "active" }).returning();
      await db.insert(tradesTable).values({ signalId: signal.id, symbol: asset.symbol, direction: a.direction, entryPrice: a.entryPrice, stopLoss: a.stopLoss, takeProfit: a.takeProfit, currentPrice: a.entryPrice, pnlPercent: 0, pnlAmount: 0, isActive: true });
      sent++;
    } catch (err) { logger.error({ err, symbol: asset.symbol }, "Go error"); }
  }
  if (!silent) await bot.sendMessage(chatId, "Done - " + sent + " signals sent, " + skipped + " skipped");
}

export async function monitorTrades(): Promise<void> {
  const trades = await db.select().from(tradesTable).where(eq(tradesTable.isActive, true));
  if (trades.length === 0) return;
  const now = new Date();
  for (const trade of trades) {
    try {
      const price = (await fetchPrice(trade.symbol)).price;
      const pct = trade.direction === "BUY" ? ((price - trade.entryPrice) / trade.entryPrice) * 100 : ((trade.entryPrice - price) / trade.entryPrice) * 100;
      const amt = pct * 100;
      await db.update(tradesTable).set({ currentPrice: price, pnlPercent: pct, pnlAmount: amt }).where(eq(tradesTable.id, trade.id));
      const tpHit = trade.direction === "BUY" ? price >= trade.takeProfit : price <= trade.takeProfit;
      const slHit = trade.direction === "BUY" ? price <= trade.stopLoss : price >= trade.stopLoss;
      if (!tpHit && !slHit) continue;
      const reason = tpHit ? "tp" : "sl";
      await db.update(tradesTable).set({ isActive: false, currentPrice: price, pnlPercent: pct, pnlAmount: amt, closedAt: now, closeReason: reason, exitPrice: price }).where(eq(tradesTable.id, trade.id));
      await db.update(signalsTable).set({ status: reason === "tp" ? "closed_tp" : "closed_sl" }).where(eq(signalsTable.id, trade.signalId));
      if (bot) await bot.sendMessage(ADMIN_CHAT_ID,
        (tpHit ? "✅ *TAKE PROFIT HIT!*" : "❌ *STOP LOSS HIT*") + "\n" +
        "━━━━━━━━━━━━━━━━━━━━\n" +
        "🪙 *" + trade.symbol + "* — " + trade.direction + "\n" +
        "📥 Entry: `" + fmtPrice(trade.entryPrice) + "`\n" +
        "📤 Exit:  `" + fmtPrice(price) + "`\n" +
        "━━━━━━━━━━━━━━━━━━━━\n" +
        (pct >= 0 ? "💚 *+" : "🔴 *") + pct.toFixed(2) + "%* | $" + Math.abs(amt).toFixed(0) + "\n" +
        (tpHit ? "🔓 Coin unlocked ✅" : "🛡️ Capital protected") + "\n" +
        "_☠️ ham\_evil\_bot_",
        { parse_mode: "Markdown" }
      );
    } catch (err) { logger.error({ err, tradeId: trade.id }, "Monitor error"); }
  }
}

async function handleStats(chatId: number): Promise<void> {
  if (!bot) return;
  const all = await db.select().from(tradesTable).where(eq(tradesTable.isActive, false)).orderBy(desc(tradesTable.closedAt));
  const tp = all.filter(t => t.closeReason === "tp").length;
  const sl = all.filter(t => t.closeReason === "sl").length;
  const manual = all.filter(t => t.closeReason === "manual").length;
  const wins = tp + all.filter(t => t.closeReason === "manual" && (t.pnlPercent || 0) > 0).length;
  const winRate = all.length > 0 ? (wins / all.length) * 100 : 0;
  const sorted = [...all].sort((a, b) => (b.pnlPercent || 0) - (a.pnlPercent || 0));
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  await bot.sendMessage(chatId,
    "📊 *SCORECARD*\n" +
    "━━━━━━━━━━━━━━━━━━━━\n" +
    "📈 Total Signals: *" + all.length + "*\n" +
    "✅ TP Hits: *" + tp + "*\n" +
    "❌ SL Hits: *" + sl + "*\n" +
    "💀 Manual Closes: *" + manual + "*\n" +
    "🏆 Win Rate: *" + winRate.toFixed(1) + "%*\n" +
    "━━━━━━━━━━━━━━━━━━━━\n" +
    "🥇 Best: " + (best ? "*" + best.symbol + "* " + (best.pnlPercent >= 0 ? "+" : "") + best.pnlPercent?.toFixed(2) + "%" : "N/A") + "\n" +
    "💀 Worst: " + (worst ? "*" + worst.symbol + "* " + (worst.pnlPercent >= 0 ? "+" : "") + worst.pnlPercent?.toFixed(2) + "%" : "N/A") + "\n" +
    "━━━━━━━━━━━━━━━━━━━━\n" +
    "_☠️ ham\_evil\_bot — netherworld edition_",
    { parse_mode: "Markdown" }
  );
}

export async function broadcastToAdmin(message: string): Promise<void> {
  if (!bot) return;
  try { await bot.sendMessage(ADMIN_CHAT_ID, message); } catch (err) { logger.error({ err }, "Broadcast error"); }
}

export async function sendTelegramAlert(message: string): Promise<void> {
  await broadcastToAdmin(message);
}
