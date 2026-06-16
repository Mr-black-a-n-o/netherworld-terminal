import cron from "node-cron";
import { logger } from "./logger";
import { db, signalsTable, tradesTable, assetsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { fetchPrice } from "./market";
import { analyzeAsset } from "./analyzer";
import { sendTelegramAlert } from "./telegram";

export function initScheduler(): void {
  // Every 15 minutes: check active trades for TP/SL hits and analyze assets
  cron.schedule("*/15 * * * *", async () => {
    logger.info("Scheduler: running 15-minute scan");
    await checkActiveTrades();
    await analyzeScheduledAssets();
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

      if (trade.direction === "BUY") {
        if (currentPrice >= trade.takeProfit) {
          closed = true;
          closeReason = "tp";
          status = "closed_tp";
        } else if (currentPrice <= trade.stopLoss) {
          closed = true;
          closeReason = "sl";
          status = "closed_sl";
        }
      } else {
        if (currentPrice <= trade.takeProfit) {
          closed = true;
          closeReason = "tp";
          status = "closed_tp";
        } else if (currentPrice >= trade.stopLoss) {
          closed = true;
          closeReason = "sl";
          status = "closed_sl";
        }
      }

      const pnlPct = trade.direction === "BUY"
        ? ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100
        : ((trade.entryPrice - currentPrice) / trade.entryPrice) * 100;
      const pnlAmt = pnlPct * 100;

      if (closed) {
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

        const emoji = closeReason === "tp" ? "🎯" : "💀";
        const msg =
          `${emoji} *TRADE ${closeReason === "tp" ? "TP HIT" : "SL HIT"}*\n` +
          `━━━━━━━━━━━━━━━\n` +
          `🪙 ${trade.symbol} - ${trade.direction}\n` +
          `Entry: ${trade.entryPrice.toFixed(6)}\n` +
          `Exit: ${currentPrice.toFixed(6)}\n` +
          `Result: ${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}% | ${pnlAmt >= 0 ? "+" : ""}$${Math.abs(pnlAmt).toFixed(0)}\n` +
          `━━━━━━━━━━━━━━━\n` +
          `Trade unlocked ✅`;

        await sendTelegramAlert(msg);
        logger.info({ symbol: trade.symbol, closeReason, pnlPct }, "Trade closed");
      } else {
        // Update current price and PnL
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

async function analyzeScheduledAssets(): Promise<void> {
  const assets = await db
    .select()
    .from(assetsTable)
    .where(eq(assetsTable.isActive, true));

  for (const asset of assets) {
    try {
      // Only auto-analyze if no active trade for this asset
      const [existing] = await db
        .select()
        .from(tradesTable)
        .where(and(eq(tradesTable.symbol, asset.symbol), eq(tradesTable.isActive, true)))
        .limit(1);

      if (existing) continue;

      const analysis = await analyzeAsset(asset.symbol, "1h");

      // Only save signals with strength >= 3 in auto-mode
      if (analysis.strength >= 3) {
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

        logger.info({ symbol: asset.symbol, strength: analysis.strength }, "Auto-signal generated");
      }
    } catch (err) {
      logger.error({ err, symbol: asset.symbol }, "Error in scheduled analysis");
    }
  }
}
