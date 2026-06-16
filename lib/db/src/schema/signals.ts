import { pgTable, text, serial, timestamp, integer, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const assetsTable = pgTable("assets", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull().unique(),
  type: text("type").notNull(), // crypto | forex
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAssetSchema = createInsertSchema(assetsTable).omit({ id: true, createdAt: true });
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Asset = typeof assetsTable.$inferSelect;

export const signalsTable = pgTable("signals", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  timeframe: text("timeframe").notNull(),
  direction: text("direction").notNull(), // BUY | SELL
  strength: integer("strength").notNull(), // 1-5
  entryPrice: real("entry_price").notNull(),
  stopLoss: real("stop_loss").notNull(),
  takeProfit: real("take_profit").notNull(),
  conditionEma200: boolean("condition_ema200").notNull().default(false),
  conditionRsiDivergence: boolean("condition_rsi_divergence").notNull().default(false),
  conditionVolumeSpike: boolean("condition_volume_spike").notNull().default(false),
  conditionSupportResistance: boolean("condition_support_resistance").notNull().default(false),
  conditionMomentum: boolean("condition_momentum").notNull().default(false),
  status: text("status").notNull().default("active"), // active | closed_tp | closed_sl | closed_manual
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSignalSchema = createInsertSchema(signalsTable).omit({ id: true, createdAt: true });
export type InsertSignal = z.infer<typeof insertSignalSchema>;
export type Signal = typeof signalsTable.$inferSelect;

export const tradesTable = pgTable("trades", {
  id: serial("id").primaryKey(),
  signalId: integer("signal_id").notNull().references(() => signalsTable.id),
  symbol: text("symbol").notNull(),
  direction: text("direction").notNull(), // BUY | SELL
  entryPrice: real("entry_price").notNull(),
  stopLoss: real("stop_loss").notNull(),
  takeProfit: real("take_profit").notNull(),
  currentPrice: real("current_price").notNull(),
  pnlPercent: real("pnl_percent").notNull().default(0),
  pnlAmount: real("pnl_amount").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  entryTime: timestamp("entry_time", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  closeReason: text("close_reason"), // tp | sl | manual
  exitPrice: real("exit_price"),
});

export const insertTradeSchema = createInsertSchema(tradesTable).omit({ id: true, entryTime: true });
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof tradesTable.$inferSelect;

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  deviceInfo: text("device_info"),
  deviceFingerprint: text("device_fingerprint"),
  isBlocked: boolean("is_blocked").notNull().default(false),
  role: text("role").notNull().default("user"), // admin | user
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

export const profileTable = pgTable("profile", {
  id: serial("id").primaryKey(),
  creatorName: text("creator_name").notNull().default("Mr.black_a_n_o"),
  bio: text("bio"),
  contactInfo: text("contact_info"),
  socialLinks: text("social_links"),
  photoUrl: text("photo_url"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProfileSchema = createInsertSchema(profileTable).omit({ id: true, updatedAt: true });
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profileTable.$inferSelect;
