import "server-only";
import { positionWord } from "@/lib/distance";
import { db } from "./db";
import type { CurrentUser } from "./auth";
import { getCoachView, getCoachWork } from "./access";
import { attentionFlags } from "./coachSummary";
import { cyclePosition, cycleWeeks, practiceSummary } from "./cycle";
import { scoresFrom } from "./forge";
import { aiAvailable, coachBriefAI, type CoachBriefContent } from "./ai";
import { exerciseMenu } from "./exercises";
import { getContent } from "@/content";
import { FORGE_LINES } from "@/content/forgeLines";
import { RELATIONSHIP_ROLES } from "@/content/program";

/**
 * Session prep. The context is built from the coach view, which already applies the client's sharing choices,
 * plus the coach's own sessions, notes and exercises. Nothing the client keeps private reaches the AI.
 */
type View = Awaited<ReturnType<typeof getCoachView>>;
type Work = Awaited<ReturnType<typeof getCoachWork>>;

const day = (d: Date | string) => new Date(typeof d === "string" ? `${d}T12:00:00` : d).toDateString();

export function briefContext(v: View, work: Work, pack: Awaited<ReturnType<typeof getContent>>["pack"], identityForAi: boolean): string {
  const first = v.participant.name.split(" (")[0].split(" ")[0];
  const L: string[] = [`First name: ${first}`, `Shared with the coach: ${v.scopes.join(", ") || "nothing"}`];
  const now = new Date();
  const past = work.sessions.filter((s) => s.scheduledAt <= now);
  const next = work.sessions.filter((s) => s.scheduledAt > now).at(-1);
  const last = past[0];
  if (last) {
    L.push(`Last session: ${day(last.scheduledAt)}${last.agenda ? `. Agenda: ${last.agenda}` : ""}`);
    if (last.commitments) L.push(`Commitments agreed last time: ${last.commitments}`);
    if (last.coachNotes) L.push(`Coach's own notes from last time: ${last.coachNotes}`);
  } else L.push("No earlier session on record.");
  if (next) {
    L.push(`Next session: ${day(next.scheduledAt)}${next.agenda ? `. Agenda: ${next.agenda}` : ""}`);
    if (next.participantPrep) L.push(`The client's own prep note for it: ${next.participantPrep}`);
  }
  const since = last?.scheduledAt;

  if (v.profile) {
    for (const l of FORGE_LINES) if (v.profile[l.field]) L.push(`FORGE line ${l.pillar}, ${l.label} (their words): ${v.profile[l.field]}`);
    if (v.profile.forgeStatement) L.push(`My statement (their words): ${v.profile.forgeStatement}`);
  }
  for (const g of v.goals) L.push(`Goal ${g.pillar}${g.isPriority ? " (priority)" : ""}: now "${g.whereNow}", want "${g.whereWant}"${g.oneMove ? `, one move "${g.oneMove}"` : ""}`);
  if (identityForAi && v.identity) {
    if (v.identity.role) L.push(`The role this is about: ${v.identity.role}`);
    if (v.identity.becoming) L.push(`Their identity statement: ${v.identity.becoming}`);
    if (v.identity.behavior) L.push(`Behavior that would show it: ${v.identity.behavior}`);
  }
  if (v.assessment) {
    const s = scoresFrom(v.assessment);
    L.push(`Latest Where I am check, their own answers against their own lines (${day(v.assessment.completedAt)}): F ${positionWord(s.F)}, O ${positionWord(s.O)}, R ${positionWord(s.R)}, G ${positionWord(s.G)}, E ${positionWord(s.E)}`);
  }
  if (v.cycle) {
    const pos = cyclePosition(v.cycle.startDate);
    const week = cycleWeeks(v.cycle.template, pack).weeks[pos.week - 1];
    L.push(`Current 30 days: rule ${v.cycle.pillar}${v.cycle.focus ? `, focus "${v.cycle.focus}"` : ""}, day ${pos.day} of 30, week ${pos.week}${week?.phase ? ` (${week.phase})` : ""}${v.cycle.seasonMonth ? `, season month ${v.cycle.seasonMonth} of 3` : ""}${v.cycle.decision ? `, day 30 decision: ${v.cycle.decision}` : ""}`);
  }
  const recent = since ? v.practice.filter((p) => new Date(`${p.date}T12:00:00`) > since) : v.practice.slice(0, 14);
  const withStatus = recent.filter((p) => p.status);
  if (withStatus.length) {
    const s = practiceSummary(withStatus);
    L.push(`Daily check-ins ${since ? "since the last session" : "in the last two weeks"}: ${s.done} done, ${s.partial} partial, ${s.notYet} not yet, over ${withStatus.length} days logged`);
    const tags = new Map<string, number>();
    for (const p of withStatus) for (const t of p.tags) tags.set(t, (tags.get(t) ?? 0) + 1);
    if (tags.size) L.push(`Where practice happened: ${[...tags].map(([t, n]) => `${t} (${n})`).join(", ")}`);
  }
  const acted = recent.filter((p) => p.identityActed);
  if (acted.length) L.push(`"Showed up as who I am" answers: ${acted.filter((p) => p.identityActed === "YES").length} yes, ${acted.filter((p) => p.identityActed === "PARTLY").length} partly, ${acted.filter((p) => p.identityActed === "NOT_YET").length} not yet`);
  for (const p of recent) if (p.reflection || p.note) L.push(`Shared check-in, ${p.date}: ${[p.note, p.reflection].filter(Boolean).join(" ")}`);
  for (const w of v.weekly.slice(0, 3)) L.push(`Shared look back (the Mirrors), week of ${w.weekOf}: did what they said: ${w.didIt || "not answered"}${w.built ? `. Built: ${w.built}` : ""}${w.avoided ? `. Avoided: ${w.avoided}` : ""}${w.nextWeek ? `. Next week: ${w.nextWeek}` : ""}`);
  if (v.plan?.plan) L.push(`Their 30-day plan (their words): ${v.plan.plan}`);
  if (v.plan?.gap) L.push(`What makes the new response hard (their words): ${v.plan.gap}`);
  for (const c of v.commitments.slice(0, 8)) L.push(`Routine or commitment: ${c.title}${c.when ? ` (${c.when})` : ""}`);
  for (const r of v.relationships) {
    const overdue = r.nextCheckIn && r.nextCheckIn < now;
    L.push(`Person: ${r.name}, ${RELATIONSHIP_ROLES[r.role as keyof typeof RELATIONSHIP_ROLES] ?? r.role}${overdue ? ", check-in overdue" : ""}`);
  }
  for (const e of v.eqi) L.push(`Working on from their feedback (their words): ${e.label}${e.practice ? `, practice: ${e.practice}` : ""}`);
  for (const f of v.feedback.slice(0, 3)) if (f.summary) L.push(`Shared feedback summary (their words): ${f.summary.slice(0, 600)}`);
  for (const x of work.exercises.slice(0, 4)) L.push(`Exercise assigned: ${x.title}, ${x.status.toLowerCase().replace("_", " ")}${x.response ? `. Their shared response: ${x.response.slice(0, 400)}` : ""}`);
  const flags = attentionFlags(v);
  if (flags.length) L.push(`App flags: ${flags.join("; ")}`);
  return L.join("\n");
}

export type BriefResult = { ok: true } | { ok: false; reason: "ai_off" | "client_ai_off" | "nothing_shared" | "failed" };

/** Builds and stores a new brief. Respects the client's own AI choice and their identity AI setting. */
export async function prepareBrief(coach: CurrentUser, participantId: string): Promise<BriefResult> {
  if (!aiAvailable()) return { ok: false, reason: "ai_off" };
  const v = await getCoachView(coach, participantId);
  const work = await getCoachWork(coach, participantId);
  const [profile, idRow] = await Promise.all([
    db.profile.findUnique({ where: { userId: participantId }, select: { aiEnabled: true } }),
    db.identityProfile.findUnique({ where: { userId: participantId }, select: { aiUse: true } }),
  ]);
  if (profile?.aiEnabled === false) return { ok: false, reason: "client_ai_off" };
  if (!v.scopes.length && !work.sessions.length) return { ok: false, reason: "nothing_shared" };
  const { pack } = await getContent();
  const menu = exerciseMenu(pack);
  const context = briefContext(v, work, pack, idRow?.aiUse !== false);
  const query = [v.cycle?.focus, v.cycle?.pillar, v.profile?.forgeStatement].filter(Boolean).join(" ") || "coaching session preparation";
  const brief = await coachBriefAI(context, query, menu.map(({ ref, title }) => ({ ref, title })));
  if (!brief) return { ok: false, reason: "failed" };
  await db.coachBrief.create({ data: { coachId: coach.id, participantId, scopes: v.scopes.join(","), content: JSON.stringify(brief) } });
  return { ok: true };
}

/**
 * The latest brief, only while everything it was built from is still shared. A brief built from an area the client
 * has since turned off is deleted, so it can't show what they took back.
 */
export async function latestBrief(coachId: string, participantId: string, scopesNow: string[]): Promise<{ createdAt: Date; scopes: string[]; content: CoachBriefContent } | null> {
  const b = await db.coachBrief.findFirst({ where: { coachId, participantId }, orderBy: { createdAt: "desc" } });
  if (!b) return null;
  const scopes = b.scopes ? b.scopes.split(",") : [];
  if (scopes.some((s) => !scopesNow.includes(s))) {
    await db.coachBrief.deleteMany({ where: { coachId, participantId } });
    return null;
  }
  try {
    return { createdAt: b.createdAt, scopes, content: JSON.parse(b.content) as CoachBriefContent };
  } catch {
    return null;
  }
}

export type WrapUpDraft = { sessionId: string; sessionAt: string; notes: string; commitments: string; followUp: string; exercise: { ref: string; title: string; why: string } | null };
export type WrapUpResult = { ok: true; draftId: string } | { ok: false; reason: "ai_off" | "failed" };

/**
 * After-session wrap-up: drafts tidy notes, commitments, a follow-up and the next exercise from the coach's rough notes,
 * for the most recent session that has already happened. Client data goes in only if the client allows AI.
 */
export async function draftWrapUp(coach: CurrentUser, participantId: string, roughNotes: string): Promise<WrapUpResult> {
  if (!aiAvailable()) return { ok: false, reason: "ai_off" };
  const v = await getCoachView(coach, participantId);
  const work = await getCoachWork(coach, participantId);
  const [profile, idRow, { pack }] = await Promise.all([
    db.profile.findUnique({ where: { userId: participantId }, select: { aiEnabled: true } }),
    db.identityProfile.findUnique({ where: { userId: participantId }, select: { aiUse: true } }),
    getContent(),
  ]);
  const context = profile?.aiEnabled === false ? "" : briefContext(v, work, pack, idRow?.aiUse !== false);
  const menu = exerciseMenu(pack);
  const first = v.participant.name.split(" (")[0].split(" ")[0];
  const w = await (await import("./ai")).wrapUpAI(roughNotes, first, context, menu.map(({ ref, title }) => ({ ref, title })));
  if (!w) return { ok: false, reason: "failed" };
  const last = work.sessions.find((s) => s.scheduledAt <= new Date());
  const draft: WrapUpDraft = { sessionId: last?.id ?? "", sessionAt: last?.scheduledAt.toISOString() ?? "", ...w };
  const d = await db.coachDraft.create({ data: { coachId: coach.id, kind: "WRAPUP", participantId, instruction: roughNotes.trim().slice(0, 8000), actions: JSON.stringify(draft) } });
  return { ok: true, draftId: d.id };
}

export async function getWrapUp(coachId: string, participantId: string, id: string): Promise<{ id: string; draft: WrapUpDraft } | null> {
  const d = await db.coachDraft.findFirst({ where: { id, coachId, participantId, kind: "WRAPUP" } });
  if (!d) return null;
  try {
    return { id: d.id, draft: JSON.parse(d.actions) as WrapUpDraft };
  } catch {
    return null;
  }
}
