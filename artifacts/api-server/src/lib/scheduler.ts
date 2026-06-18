import cron from "node-cron";
import { logger } from "./logger";
import { db, signalsTable, tradesTable, assetsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { fetchPrice } from "./market";
import { analyzeAsset } from "./analyzer";
import { broadcastToAdmin } from "./telegram";

function fmtPrice(n: number): string {
  if (n >= 1) {
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return n.toFixed(6);
}

function fmtDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function fmtIST(date: Date): string {
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const STRENGTH_LABELS: Record<number, string> = {
  1: "VERY WEAK",
  2: "WEAK",
  3: "MODERATE",
  4: "STRONG",
  5: "ELITE",
};

export function initScheduler(): void {
  cron.schedule("*/15 * * * *", async () => {
    logger.info("Scheduler: running 15-minute scan");
    await checkActiveTrades();
    await broadcastAutoSignals();
  });

  logger.info("Scheduler initialized (every 15 minutes)");
}

async function checkActiveTrades(): Promise<void> {
  const activeTrades = await db
    .select()
    .from(tradesTable)
    .where(eq(tradesTable.isActive, true));

  for (const trade of activeTrades) {
    try {
      const priceData = await fetchPrice(trade.symbol);
      const currentPrice = priceData.price;
      const now = new Date();

      let closed = false;
      let closeReason = "";
      let status = "";
      let isTP = false;

      if (trade.direction === "BUY") {
        if (currentPrice >= trade.takeProfit) {
          closed = true; closeReason = "tp"; status = "closed_tp"; isTP = true;
        } else if (currentPrice <= trade.stopLoss) {
          closed = true; closeReason = "sl"; status = "closed_sl"; isTP = false;
        }
      } else {
        if (currentPrice <= trade.takeProfit) {
          closed = true; closeReason = "tp"; status = "closed_tp"; isTP = true;
        } else if (currentPrice >= trade.stopLoss) {
          closed = true; closeReason = "sl"; status = "closed_sl"; isTP = false;
        }
      }

      const pnlPct = trade.direction === "BUY"
        ? ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100
        : ((trade.entryPrice - currentPrice) / trade.entryPrice) * 100;
      const pnlAmt = pnlPct * 100;

      if (closed) {
        const entryTime = new Date(trade.entryTime);
        const timeActive = fmtDuration(now.getTime() - entryTime.getTime());
        const pnlSign = pnlPct >= 0 ? "+" : "";
        const amtSign = pnlAmt >= 0 ? "+" : "";
        const exitLabel = isTP
          ? `${fmtPrice(currentPrice)} (TP Hit ✅)`
          : `${fmtPrice(currentPrice)} (SL Hit ❌)`;

        await db.update(tradesTable).set({
          isActive: false,
          currentPrice,
          pnlPercent: pnlPct,
          pnlAmount: pnlAmt,
          closedAt: now,
          closeReason,
          exitPrice: currentPrice,
        }).where(eq(tradesTable.id, trade.id));

        await db.update(signalsTable)
          .set({ status })
          .where(eq(signalsTable.id, trade.signalId));

        const header = isTP
          ? "✅ TRADE CLOSED - TAKE PROFIT HIT"
          : "❌ TRADE CLOSED - STOP LOSS HIT";

        const msg =
          `${header}\n` +
          `━━━━━━━━━━━━━━━\n` +
          `🪙 ${trade.symbol} - ${trade.direction}\n` +
          `Entry: ${fmtPrice(trade.entryPrice)}\n` +
          `Exit: ${exitLabel}\n` +
          `Result: ${pnlSign}${pnlPct.toFixed(2)}% | ${amtSign}$${Math.abs(pnlAmt).toFixed(0)}\n` +
          `Time Active: ${timeActive}\n` +
          `━━━━━━━━━━━━━━━\n` +
          `Coin unlocked for next signal ✅`;

        await broadcastToAdmin(msg);
        logger.info({ symbol: trade.symbol, closeReason, pnlPct }, "Trade auto-closed");
      } else {
        await db.update(tradesTable).set({
          currentPrice,
          pnlPercent: pnlPct,
          pnlAmount: pnlAmt,
        }).where(eq(tradesTable.id, trade.id));
      }
    } catch (err) {
      logger.error({ err, tradeId: trade.id }, "Error checking trade");
    }
  }
}

async function broadcastAutoSignals(): Promise<void> {
  const assets = await db
    .select()
    .from(assetsTable)
    .where(eq(assetsTable.isActive, true));

  for (const asset of assets) {
    try {
      const [existing] = await db
        .select()
        .from(tradesTable)
        .where(and(eq(tradesTable.symbol, asset.symbol), eq(tradesTable.isActive, true)))
        .limit(1);

      if (existing) continue;

      const analysis = await analyzeAsset(asset.symbol, "1h");

      // Only broadcast ELITE signals (strength 4 or 5)
      if (analysis.strength < 4) continue;

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

      const dirEmoji = analysis.direction === "BUY" ? "📈" : "📉";
      const strengthLabel = STRENGTH_LABELS[analysis.strength] || "STRONG";
      const now = new Date();
      const c = analysis.conditions;

      const msg =
        `⚡ AUTO SIGNAL — ${asset.symbol}\n` +
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
        `🕐 Entry Time: ${fmtIST(now)}\n` +
        `📊 Timeframe: 1h`;

      await broadcastToAdmin(msg);
      logger.info({ symbol: asset.symbol, strength: analysis.strength, direction: analysis.direction }, "Elite auto-signal broadcast");
    } catch (err) {
      logger.error({ err, symbol: asset.symbol }, "Error in scheduled analysis");
    }
  }
}
