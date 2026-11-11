/** True for coaches, and for administrators who turned on coaching. Coach access rules apply to both. */
export const canCoach = (u: { role: string; alsoCoach?: boolean | null }) => u.role === "COACH" || (u.role === "ADMIN" && !!u.alsoCoach);
