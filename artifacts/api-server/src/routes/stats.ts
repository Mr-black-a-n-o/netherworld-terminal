import { Router } from "express";
import { db, tradesTable, signalsTable } from "@workspace/db";
import { eq, and, gte, desc } from "drizzle-orm";
import { fetchPrice } from "../lib/market";

const router = Router();

router.get("/stats/today", async (req, res): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // All-time total signals count
  const allSignals = await db.select().from(signalsTable);

  const closedTrades = await db
    .select()
    .from(tradesTable)
    .where(and(eq(tradesTable.isActive, false), gte(tradesTable.entryTime, today)));

  const tp = closedTrades.filter(t => t.closeReason === "tp" || (t.closeReason === "manual" && (t.pnlPercent || 0) > 0)).length;
  const sl = closedTrades.filter(t => t.closeReason === "sl").length;
  const manual = closedTrades.filter(t => t.closeReason === "manual").length;
  const total = closedTrades.length;
  const winRate = total > 0 ? (tp / total) * 100 : 0;

  const sorted = [...closedTrades].sort((a, b) => (b.pnlPercent || 0) - (a.pnlPercent || 0));
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  res.json({
    totalSignals: allSignals.length,
    tpHits: tp,
    slHits: sl,
    manualCloses: manual,
    winRate,
    bestTrade: best ? `${best.symbol} +${best.pnlPercent?.toFixed(2)}%` : null,
    worstTrade: worst && worst !== best ? `${worst.symbol} ${worst.pnlPercent?.toFixed(2)}%` : null,
  });
});

router.get("/stats/portfolio", async (req, res): Promise<void> => {
  const trades = await db
    .select()
    .from(tradesTable)
    .where(eq(tradesTable.isActive, true))
    .orderBy(desc(tradesTable.entryTime));

  let totalPnlPercent = 0;
  let totalPnlAmount = 0;

  const mapped = await Promise.all(trades.map(async (t) => {
    let currentPrice = t.currentPrice;
    let pnlPercent = t.pnlPercent;
    let pnlAmount = t.pnlAmount;

    try {
      const priceData = await fetchPrice(t.symbol);
      currentPrice = priceData.price;
      pnlPercent = t.direction === "BUY"
        ? ((currentPrice - t.entryPrice) / t.entryPrice) * 100
        : ((t.entryPrice - currentPrice) / t.entryPrice) * 100;
      pnlAmount = pnlPercent * 100;
    } catch {
      // use stored values
    }

    totalPnlPercent += pnlPercent;
    totalPnlAmount += pnlAmount;

    return {
      id: t.id,
      signalId: t.signalId,
      symbol: t.symbol,
      direction: t.direction,
      entryPrice: t.entryPrice,
      stopLoss: t.stopLoss,
      takeProfit: t.takeProfit,
      currentPrice,
      pnlPercent,
      pnlAmount,
      entryTime: t.entryTime.toISOString(),
      isActive: t.isActive,
      closedAt: t.closedAt ? t.closedAt.toISOString() : null,
      closeReason: t.closeReason ?? null,
    };
  }));

  const avg = trades.length > 0 ? totalPnlPercent / trades.length : 0;

  res.json({
    trades: mapped,
    totalPnlPercent: avg,
    totalPnlAmount,
  });
});

router.get("/stats/history", async (req, res): Promise<void> => {
  const limit = parseInt(String(req.query.limit || "20"), 10);

  const closedTrades = await db
    .select()
    .from(tradesTable)
    .where(eq(tradesTable.isActive, false))
    .orderBy(desc(tradesTable.closedAt))
    .limit(limit);

  res.json(closedTrades.map(t => ({
    id: t.id,
    symbol: t.symbol,
    direction: t.direction,
    entryPrice: t.entryPrice,
    exitPrice: t.exitPrice ?? t.currentPrice,
    pnlPercent: t.pnlPercent,
    pnlAmount: t.pnlAmount,
    closeReason: t.closeReason ?? "manual",
    entryTime: t.entryTime.toISOString(),
    closedAt: t.closedAt ? t.closedAt.toISOString() : new Date().toISOString(),
  })));
});

export default router;
