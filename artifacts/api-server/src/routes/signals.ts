import { Router } from "express";
import { db, signalsTable, tradesTable, assetsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { analyzeAsset } from "../lib/analyzer";
import { fetchPrice } from "../lib/market";
import { AnalyzeSignalBody, ListSignalsQueryParams } from "@workspace/api-zod";

const router = Router();

function mapSignal(s: typeof signalsTable.$inferSelect) {
  return {
    id: s.id,
    symbol: s.symbol,
    timeframe: s.timeframe,
    direction: s.direction,
    strength: s.strength,
    entryPrice: s.entryPrice,
    stopLoss: s.stopLoss,
    takeProfit: s.takeProfit,
    conditions: {
      ema200: s.conditionEma200,
      rsiDivergence: s.conditionRsiDivergence,
      volumeSpike: s.conditionVolumeSpike,
      supportResistance: s.conditionSupportResistance,
      momentum: s.conditionMomentum,
    },
    status: s.status,
    createdAt: s.createdAt.toISOString(),
  };
}

router.get("/signals", async (req, res): Promise<void> => {
  const params = ListSignalsQueryParams.safeParse(req.query);
  const limit = params.success ? (params.data.limit ?? 50) : 50;
  const symbol = params.success ? params.data.symbol : undefined;

  const query = db.select().from(signalsTable).orderBy(desc(signalsTable.createdAt)).limit(limit);
  const signals = await query;

  const filtered = symbol ? signals.filter(s => s.symbol === symbol) : signals;
  res.json(filtered.map(mapSignal));
});

router.post("/signals/analyze", async (req, res): Promise<void> => {
  const parsed = AnalyzeSignalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { symbol, timeframe } = parsed.data;
  const sym = symbol.toUpperCase();

  // Check for existing active trade
  const [existingTrade] = await db
    .select()
    .from(tradesTable)
    .where(and(eq(tradesTable.symbol, sym), eq(tradesTable.isActive, true)))
    .limit(1);

  if (existingTrade) {
    res.status(409).json({ error: "Active trade already exists for this symbol" });
    return;
  }

  const analysis = await analyzeAsset(sym, timeframe);

  const [signal] = await db.insert(signalsTable).values({
    symbol: sym,
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
    symbol: sym,
    direction: analysis.direction,
    entryPrice: analysis.entryPrice,
    stopLoss: analysis.stopLoss,
    takeProfit: analysis.takeProfit,
    currentPrice: analysis.entryPrice,
    pnlPercent: 0,
    pnlAmount: 0,
    isActive: true,
  });

  res.json(mapSignal(signal));
});

router.get("/market/price/:symbol", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.symbol) ? req.params.symbol[0] : req.params.symbol;
  const symbol = raw.toUpperCase();
  const data = await fetchPrice(symbol);
  res.json(data);
});

export default router;
