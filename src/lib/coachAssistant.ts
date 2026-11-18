import "server-only";
import { db } from "./db";
import type { CurrentUser } from "./auth";
import { aiAvailable, planCoachActionsAI, type ProposedAction } from "./ai";
import { exerciseMenu } from "./exercises";
import { getContent } from "@/content";

/** A proposed action with the client it resolved to. participantId is "" when the name didn't match one client. */
export type DraftAction = ProposedAction & { participantId: string; clientName: string; exerciseTitle?: string };
export type DraftPlan = { actions: DraftAction[]; unclear: string[] };

/** The coach's active clients, by the name the coach knows them by. */
export async function coachClients(coachId: string) {
  const rows = await db.coachAssignment.findMany({ where: { coachId, active: true }, include: { participant: { select: { id: true, name: true } } } });
  return rows.map((r) => ({ id: r.participant.id, name: r.participant.name.replace(/\s*\((?:demo|Demo)[^)]*\)\s*$/, "").trim() }));
}

/** Full name first, then a first name or a part of the name that fits exactly one client. */
export function resolveClient(said: string, clients: { id: string; name: string }[]): { id: string; name: string } | null {
  const s = said.trim().toLowerCase();
  if (!s) return null;
  const exact = clients.filter((c) => c.name.toLowerCase() === s);
  if (exact.length === 1) return exact[0];
  const first = clients.filter((c) => c.name.toLowerCase().split(/\s+/)[0] === s);
  if (first.length === 1) return first[0];
  const part = clients.filter((c) => c.name.toLowerCase().includes(s));
  return part.length === 1 ? part[0] : null;
}

export type PlanResult = { ok: true; draftId: string } | { ok: false; reason: "ai_off" | "no_clients" | "failed" };

/** Asks the AI for a plan and keeps it as a draft for the coach to approve. Nothing is done here. */
export async function planForCoach(coach: CurrentUser, instruction: string): Promise<PlanResult> {
  if (!aiAvailable()) return { ok: false, reason: "ai_off" };
  const clients = await coachClients(coach.id);
  if (!clients.length) return { ok: false, reason: "no_clients" };
  const { pack } = await getContent();
  const menu = exerciseMenu(pack);
  const today = new Date().toLocaleDateString("en-CA") + ` (${new Date().toLocaleDateString("en-US", { weekday: "long" })})`;
  const plan = await planCoachActionsAI(instruction, clients.map((c) => c.name), menu.map(({ ref, title }) => ({ ref, title })), today);
  if (!plan) return { ok: false, reason: "failed" };
  const unclear = [...plan.unclear];
  const actions: DraftAction[] = [];
  for (const a of plan.actions) {
    const c = resolveClient(a.client, clients);
    if (!c) { unclear.push(`No single client matches "${a.client}", so that one is left out.`); continue; }
    if (a.type === "assign_exercise") {
      const m = a.exerciseRef !== "custom" ? menu.find((x) => x.ref === a.exerciseRef) : null;
      if (a.exerciseRef !== "custom" && !m) { unclear.push(`An exercise for ${c.name} didn't match the program list, so it's left out.`); continue; }
      actions.push({ ...a, participantId: c.id, clientName: c.name, exerciseTitle: m?.title ?? a.title });
    } else actions.push({ ...a, participantId: c.id, clientName: c.name });
  }
  const draft = await db.coachDraft.create({ data: { coachId: coach.id, instruction: instruction.trim().slice(0, 4000), actions: JSON.stringify({ actions, unclear } satisfies DraftPlan) } });
  return { ok: true, draftId: draft.id };
}

export async function getDraft(coachId: string, id: string): Promise<{ id: string; instruction: string; plan: DraftPlan } | null> {
  const d = await db.coachDraft.findFirst({ where: { id, coachId, kind: "ACTIONS" } });
  if (!d) return null;
  try {
    return { id: d.id, instruction: d.instruction, plan: JSON.parse(d.actions) as DraftPlan };
  } catch {
    return null;
  }
}
