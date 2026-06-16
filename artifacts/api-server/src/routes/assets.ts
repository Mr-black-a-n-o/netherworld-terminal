import { Router } from "express";
import { db, assetsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateAssetBody, DeleteAssetParams } from "@workspace/api-zod";

const router = Router();

router.get("/assets", async (req, res): Promise<void> => {
  const assets = await db.select().from(assetsTable).orderBy(assetsTable.symbol);
  res.json(assets.map(a => ({
    id: a.id,
    symbol: a.symbol,
    type: a.type,
    isActive: a.isActive,
  })));
});

router.post("/assets", async (req, res): Promise<void> => {
  const parsed = CreateAssetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [asset] = await db.insert(assetsTable).values({
    symbol: parsed.data.symbol.toUpperCase(),
    type: parsed.data.type,
    isActive: true,
  }).returning();

  res.status(201).json({
    id: asset.id,
    symbol: asset.symbol,
    type: asset.type,
    isActive: asset.isActive,
  });
});

router.delete("/assets/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const params = DeleteAssetParams.safeParse({ id });
  if (!params.success) {
    res.status(400).json({ error: "Invalid asset ID" });
    return;
  }

  await db.delete(assetsTable).where(eq(assetsTable.id, id));
  res.sendStatus(204);
});

export default router;
