import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

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

    // ── Device-fingerprint block check ──────────────────────────────────────
    // If the incoming device fingerprint matches any blocked user, deny access
    // regardless of what name they try to use.
    if (deviceFingerprint) {
      const [blockedDevice] = await db
        .select()
        .from(usersTable)
        .where(and(eq(usersTable.deviceFingerprint, deviceFingerprint), eq(usersTable.isBlocked, true)))
        .limit(1);

      if (blockedDevice) {
        res.status(403).json({ error: "BLOCKED", message: "Access denied — your device has been blocked" });
        return;
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, clean))
      .limit(1);

    if (existing) {
      if (existing.isBlocked) {
        res.status(403).json({ error: "BLOCKED", message: "Access denied — you have been blocked" });
        return;
      }

      // Update device fingerprint if changed (handles fingerprint algorithm upgrades)
      if (deviceFingerprint && existing.deviceFingerprint !== deviceFingerprint) {
        await db.update(usersTable)
          .set({ deviceFingerprint })
          .where(eq(usersTable.id, existing.id));
      }

      req.session.role = "user";
      req.session.username = clean;
      res.json({ success: true, role: "user", username: clean, passkey: deviceFingerprint || existing.deviceFingerprint });
      return;
    }

    // New user — register with their device fingerprint
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

router.get("/auth/me", async (req, res): Promise<void> => {
  if (!req.session.role) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (req.session.role === "user") {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, req.session.username!))
      .limit(1);
    if (!user || user.isBlocked) {
      req.session.destroy(() => {});
      res.status(403).json({ error: "BLOCKED", message: "Access denied — you have been blocked" });
      return;
    }
  }
  res.json({
    authenticated: true,
    role: req.session.role,
    username: req.session.username,
  });
});

export default router;
