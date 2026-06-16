import { Router } from "express";
import { db, profileTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpdateProfileBody } from "@workspace/api-zod";

const router = Router();

async function getOrCreateProfile() {
  const [existing] = await db.select().from(profileTable).limit(1);
  if (existing) return existing;

  const [created] = await db.insert(profileTable).values({
    creatorName: "Mr.black_a_n_o",
    bio: "Netherworld Signal Intelligence",
    contactInfo: null,
    socialLinks: null,
    photoUrl: null,
  }).returning();

  return created;
}

router.get("/profile", async (req, res): Promise<void> => {
  const profile = await getOrCreateProfile();
  res.json({
    id: profile.id,
    creatorName: profile.creatorName,
    bio: profile.bio ?? null,
    contactInfo: profile.contactInfo ?? null,
    socialLinks: profile.socialLinks ?? null,
    photoUrl: profile.photoUrl ?? null,
  });
});

router.patch("/profile", async (req, res): Promise<void> => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const profile = await getOrCreateProfile();

  const [updated] = await db.update(profileTable).set({
    ...parsed.data,
    updatedAt: new Date(),
  }).where(eq(profileTable.id, profile.id)).returning();

  res.json({
    id: updated.id,
    creatorName: updated.creatorName,
    bio: updated.bio ?? null,
    contactInfo: updated.contactInfo ?? null,
    socialLinks: updated.socialLinks ?? null,
    photoUrl: updated.photoUrl ?? null,
  });
});

export default router;
