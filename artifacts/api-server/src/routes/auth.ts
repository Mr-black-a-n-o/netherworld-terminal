import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const ADMIN_USERNAME = "hamdhan";
const ADMIN_PASSWORD = "hamdhan246";

router.post("/auth/login", async (req, res): Promise<void> => {
  const { role, username, password, deviceFingerprint } = req.body;

  if (role === "admin") {
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      req.session.role = "admin";
      req.session.username = ADMIN_USERNAME;
      res.json({ success: true, role: "admin", username: ADMIN_USERNAME, passkey: null });
      return;
    }
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (role === "user") {
    if (!username || typeof username !== "string") {
      res.status(400).json({ error: "Username required" });
      return;
    }
    const clean = username.trim();
    if (clean.length < 3) {
      res.status(400).json({ error: "Username must be at least 3 characters" });
      return;
    }
    if (!/^[\p{L}]+$/u.test(clean)) {
      res.status(400).json({ error: "Username must contain letters only (no numbers, symbols, or spaces)" });
      return;
    }

    const [existing] = await db.select().from(usersTable).where(eq(usersTable.username, clean)).limit(1);

    if (existing) {
      if (existing.isBlocked) {
        res.status(403).json({ error: "BLOCKED", message: "Access denied — you have been blocked" });
        return;
      }
      if (existing.deviceFingerprint && deviceFingerprint && existing.deviceFingerprint !== deviceFingerprint) {
        res.status(401).json({ error: "This passkey does not work on this device" });
        return;
      }
      req.session.role = "user";
      req.session.username = clean;
      res.json({ success: true, role: "user", username: clean, passkey: existing.deviceFingerprint });
      return;
    }

    const passkey = deviceFingerprint || Math.random().toString(36).slice(2, 10).toUpperCase();
    await db.insert(usersTable).values({
      username: clean,
      deviceFingerprint: passkey,
      deviceInfo: req.headers["user-agent"]?.slice(0, 200) || "unknown",
      isBlocked: false,
      role: "user",
    });

    req.session.role = "user";
    req.session.username = clean;
    res.json({ success: true, role: "user", username: clean, passkey });
    return;
  }

  res.status(400).json({ error: "Invalid role" });
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

router.get("/auth/me", (req, res): void => {
  if (!req.session.role) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json({
    authenticated: true,
    role: req.session.role,
    username: req.session.username,
  });
});

export default router;
