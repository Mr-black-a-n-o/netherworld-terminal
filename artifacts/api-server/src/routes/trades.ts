import { Router } from "express";
import { db, tradesTable, signalsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { fetchPrice } from "../lib/market";
import { CloseTradeParams } from "@workspace/api-zod";

const router = Router();

async function mapTrade(t: typeof tradesTable.$inferSelect) {
  let currentPrice = t.currentPrice;
  let pnlPercent = t.pnlPercent;
  let pnlAmount = t.pnlAmount;

  if (t.isActive) {
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
  }

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
}

router.get("/trades", async (req, res): Promise<void> => {
  const trades = await db
    .select()
    .from(tradesTable)
    .where(eq(tradesTable.isActive, true))
    .orderBy(desc(tradesTable.entryTime));

  const mapped = await Promise.all(trades.map(mapTrade));
  res.json(mapped);
});

router.post("/trades/:id/close", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const params = CloseTradeParams.safeParse({ id });
  if (!params.success) {
    res.status(400).json({ error: "Invalid trade ID" });
    return;
  }

  const [trade] = await db.select().from(tradesTable).where(eq(tradesTable.id, id)).limit(1);
  if (!trade) {
    res.status(404).json({ error: "Trade not found" });
    return;
  }

  const priceData = await fetchPrice(trade.symbol);
  const exitPrice = priceData.price;
  const pnlPercent = trade.direction === "BUY"
    ? ((exitPrice - trade.entryPrice) / trade.entryPrice) * 100
    : ((trade.entryPrice - exitPrice) / trade.entryPrice) * 100;
  const pnlAmount = pnlPercent * 100;
  const now = new Date();

  const [updated] = await db.update(tradesTable).set({
    isActive: false,
    currentPrice: exitPrice,
    pnlPercent,
    pnlAmount,
    closedAt: now,
    closeReason: "manual",
    exitPrice,
  }).where(eq(tradesTable.id, id)).returning();

  await db.update(signalsTable).set({ status: "closed_manual" })
    .where(eq(signalsTable.id, trade.signalId));

  res.json(await mapTrade(updated));
});

export default router;
