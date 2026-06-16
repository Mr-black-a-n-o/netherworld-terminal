import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, ne } from "drizzle-orm";
import { BlockUserParams, UnblockUserParams, DeleteUserParams } from "@workspace/api-zod";

const router = Router();

router.get("/users", async (req, res): Promise<void> => {
  const users = await db
    .select()
    .from(usersTable)
    .where(ne(usersTable.role, "admin"))
    .orderBy(usersTable.createdAt);

  res.json(users.map(u => ({
    id: u.id,
    username: u.username,
    deviceInfo: u.deviceInfo ?? null,
    isBlocked: u.isBlocked,
    createdAt: u.createdAt.toISOString(),
  })));
});

router.post("/users/:id/block", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const params = BlockUserParams.safeParse({ id });
  if (!params.success) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const [user] = await db.update(usersTable).set({ isBlocked: true })
    .where(eq(usersTable.id, id)).returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    username: user.username,
    deviceInfo: user.deviceInfo ?? null,
    isBlocked: user.isBlocked,
    createdAt: user.createdAt.toISOString(),
  });
});

router.post("/users/:id/unblock", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const params = UnblockUserParams.safeParse({ id });
  if (!params.success) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const [user] = await db.update(usersTable).set({ isBlocked: false })
    .where(eq(usersTable.id, id)).returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    username: user.username,
    deviceInfo: user.deviceInfo ?? null,
    isBlocked: user.isBlocked,
    createdAt: user.createdAt.toISOString(),
  });
});

router.delete("/users/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const params = DeleteUserParams.safeParse({ id });
  if (!params.success) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.sendStatus(204);
});

router.post("/users/block-all", async (req, res): Promise<void> => {
  await db.update(usersTable).set({ isBlocked: true }).where(ne(usersTable.role, "admin"));
  res.json({ success: true });
});

export default router;
