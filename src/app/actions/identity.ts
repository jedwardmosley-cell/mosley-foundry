"use server";
import { toClaim } from "@/lib/claim";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parse, text } from "@/lib/validation";
import { PRACTICE, type IdentityLevel } from "@/content/identity";
import { FORGE_LINES, withPrefix } from "@/content/forgeLines";

const schema = z.object({
  level: z.enum(["CORE", "ROLE", "REINVENT"], { errorMap: () => ({ message: "Choose a level" }) }),
  claim: z.string().trim().min(1, "Finish your I am statement").max(1500),
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
  const { claim, ...rest } = parse(schema, fd);
  // Chips post several values; join them with anything typed in the "other" box.
  const join = (picks: FormDataEntryValue[], other: string) => [...picks.map(String), ...other.split(",")].map((x) => x.trim()).filter(Boolean).join(", ");
  rest.personaQualities = join(fd.getAll("qualityPick"), rest.personaQualities);
  rest.personaSituations = join(fd.getAll("situationPick"), rest.personaSituations);
  const d = { ...rest, becoming: toClaim(claim) };
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
  redirect(fd.get("next") === "/start" ? "/start?step=2" : "/identity?saved=1");
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

/**
 * Adds one identity practice to the blueprint from the participant's own words.
 * The participant can change or remove it like any other commitment.
 */
export async function addIdentityPractice(fd: FormData) {
  const u = await requireUser("PARTICIPANT");
  const { index } = parse(z.object({ index: z.coerce.number().int().min(0).max(10) }), fd);
  const id = await db.identityProfile.findUnique({ where: { userId: u.id } });
  if (!id) redirect("/identity");
  const item = PRACTICE[id.level as IdentityLevel]?.[index];
  if (!item || item.action.kind !== "commit") throw new Error("Not found");
  const a = item.action;
  const firstLine = (t: string) => t.split("\n")[0].trim().slice(0, 200);
  const title =
    a.from === "behavior" ? firstLine(id.behavior)
    : a.from === "cue" ? firstLine(id.personaCue)
    : a.from === "standards" ? "Read my standards"
    : "Review my week against my standards";
  if (!title) redirect("/identity");
  const detail = "Who I am";
  const exists = await db.commitment.findFirst({ where: { userId: u.id, active: true, title, detail } });
  if (!exists) await db.commitment.create({ data: { userId: u.id, area: a.area, title, detail, cadence: a.cadence } });
  revalidatePath("/blueprint");
}

/** The participant's controls for tone, AI use and coach sharing of the performance identity. */
export async function saveIdentityControls(fd: FormData) {
  const u = await requireUser("PARTICIPANT");
  const d = parse(z.object({
    tone: z.enum(["AUTO", "SUPPORTIVE", "DIRECT", "DEMANDING"]),
    aiUse: z.preprocess((v) => v === "on", z.boolean()),
    aiUsePersona: z.preprocess((v) => v === "on", z.boolean()),
    sharePersona: z.preprocess((v) => v === "on", z.boolean()),
  }), fd);
  const n = await db.identityProfile.updateMany({ where: { userId: u.id }, data: { ...d, aiUsePersona: d.aiUse && d.aiUsePersona } });
  if (!n.count) redirect("/identity");
  revalidatePath("/identity");
}

// ---------- Who I am: one activity ----------

const NEXT_OK = ["/start?step=1&part=2", "/start?step=1&part=3", "/start?step=2", "/identity?saved=1", "/forge/f?saved=1", "/forge/o", "/forge/r", "/forge/g", "/forge/e"];

/**
 * Saves Who I am: the role, the kind of change, the five FORGE statements and My statement.
 * Only the fields a form sends are changed, so the guided session can save it in parts.
 * My statement is stored in both places older screens read (the identity profile and the profile),
 * so Today, the coach view and the AI all show the same single statement.
 */
export async function saveWhoIAm(fd: FormData) {
  const u = await requireUser("PARTICIPANT");
  const has = (k: string) => fd.has(k);
  const str = (k: string, max: number) => String(fd.get(k) ?? "").trim().slice(0, max);
  const level = str("level", 10);
  if (level && !["CORE", "ROLE", "REINVENT"].includes(level)) throw new Error("Unknown kind of change");

  // The five statements and My statement live on the profile.
  const profileData: Record<string, string> = {};
  for (const l of FORGE_LINES) if (has(l.field)) profileData[l.field] = fd.get(`${l.field}__p`) === "1" ? withPrefix(l.prefix, str(l.field, 1500)) : str(l.field, 1500);
  let statement: string | undefined;
  if (has("statement")) {
    const raw = str("statement", 3000);
    statement = raw ? toClaim(raw) : "";
    profileData.forgeStatement = statement;
  }
  if (Object.keys(profileData).length) await db.profile.update({ where: { userId: u.id }, data: profileData });

  // The role, the kind of change, context and the folded performance identity live on the identity profile.
  const idData: Record<string, string> = {};
  if (has("role")) idData.role = str("role", 80);
  if (has("situation")) idData.situation = str("situation", 1500);
  if (level) idData.level = level;
  if (statement !== undefined) idData.becoming = statement;
  if (has("personaName")) {
    const join = (picks: FormDataEntryValue[], other: string) => [...picks.map(String), ...other.split(",")].map((x) => x.trim()).filter(Boolean).join(", ");
    idData.personaName = str("personaName", 120);
    idData.personaQualities = join(fd.getAll("qualityPick"), str("personaQualities", 600));
    idData.personaStandards = str("personaStandards", 1500);
    idData.personaSituations = join(fd.getAll("situationPick"), str("personaSituations", 600));
    idData.personaCue = str("personaCue", 600);
    idData.personaBehaviors = str("personaBehaviors", 1500);
  }
  const prior = await db.identityProfile.findUnique({ where: { userId: u.id } });
  const now = new Date();
  if (!prior) {
    // The identity profile needs a kind of change. Until one is chosen, the role waits on the next save.
    if (idData.level) await db.identityProfile.create({ data: { ...idData, level: idData.level, userId: u.id, versionStartedAt: now } });
  } else if (Object.keys(idData).length) {
    const next = { ...prior, ...idData };
    const changed = prior.level !== next.level || prior.becoming !== next.becoming || prior.role !== next.role || prior.situation !== next.situation || prior.personaName !== next.personaName;
    if (changed && (prior.becoming || prior.role)) {
      await db.identityHistory.create({
        data: { userId: u.id, level: prior.level, role: prior.role, becoming: prior.becoming, situation: prior.situation, behavior: prior.behavior, personaName: prior.personaName, startedAt: prior.versionStartedAt, endedAt: now },
      });
    }
    await db.identityProfile.update({ where: { userId: u.id }, data: { ...idData, ...(changed ? { versionStartedAt: now } : {}) } });
  }
  revalidatePath("/", "layout");
  const nxt = String(fd.get("next") ?? "");
  redirect(NEXT_OK.includes(nxt) ? nxt : "/identity?saved=1");
}

/** The behavior that would show it. It lives at the top of My road, since behavior is Discipline by Design. */
export async function saveBehavior(fd: FormData) {
  const u = await requireUser("PARTICIPANT");
  const behavior = String(fd.get("behavior") ?? "").trim().slice(0, 1500);
  const n = await db.identityProfile.updateMany({ where: { userId: u.id }, data: { behavior } });
  if (!n.count) redirect("/identity");
  revalidatePath("/blueprint");
  revalidatePath("/cycle/new");
}
