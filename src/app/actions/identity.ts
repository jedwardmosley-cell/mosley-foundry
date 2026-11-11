"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parse, text } from "@/lib/validation";

const schema = z.object({
  level: z.enum(["CORE", "ROLE", "REINVENT"], { errorMap: () => ({ message: "Choose a level" }) }),
  becoming: z.string().trim().min(1, "Write who you are becoming").max(1500),
  situation: text(1500),
  behavior: text(1500),
  personaName: text(120),
  personaQualities: text(600),
  personaStandards: text(1500),
  personaSituations: text(600),
  personaCue: text(600),
  personaBehaviors: text(1500),
});

/**
 * Saves the participant's identity statement and chosen level. The level is always the
 * participant's choice. When the statement or level changes, the earlier version is kept in history.
 */
export async function saveIdentity(fd: FormData) {
  const u = await requireUser("PARTICIPANT");
  const d = parse(schema, fd);
  const prior = await db.identityProfile.findUnique({ where: { userId: u.id } });
  const now = new Date();
  if (!prior) {
    await db.identityProfile.create({ data: { ...d, userId: u.id, versionStartedAt: now } });
  } else {
    const changed = prior.level !== d.level || prior.becoming !== d.becoming || prior.situation !== d.situation || prior.behavior !== d.behavior || prior.personaName !== d.personaName;
    if (changed) {
      await db.identityHistory.create({
        data: { userId: u.id, level: prior.level, becoming: prior.becoming, situation: prior.situation, behavior: prior.behavior, personaName: prior.personaName, startedAt: prior.versionStartedAt, endedAt: now },
      });
    }
    await db.identityProfile.update({ where: { userId: u.id }, data: { ...d, ...(changed ? { versionStartedAt: now } : {}) } });
  }
  revalidatePath("/identity");
  revalidatePath("/dashboard");
  redirect("/identity?saved=1");
}

/** Turns the identity layer off. The current version moves to history, so nothing is lost. */
export async function removeIdentity() {
  const u = await requireUser("PARTICIPANT");
  const prior = await db.identityProfile.findUnique({ where: { userId: u.id } });
  if (prior) {
    await db.identityHistory.create({
      data: { userId: u.id, level: prior.level, becoming: prior.becoming, situation: prior.situation, behavior: prior.behavior, personaName: prior.personaName, startedAt: prior.versionStartedAt },
    });
    await db.identityProfile.delete({ where: { userId: u.id } });
  }
  revalidatePath("/identity");
  revalidatePath("/dashboard");
}
