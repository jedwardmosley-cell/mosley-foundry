import { redirect } from "next/navigation";

/** The FORGE plan is now part of Who I am. Old links land there. */
export default function PlanPage() {
  redirect("/identity");
}
