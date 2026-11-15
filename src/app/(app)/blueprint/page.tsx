import { redirect } from "next/navigation";

/** My Design used to live at /blueprint. Old links land on the new address. */
export default function OldBlueprint() {
  redirect("/road");
}
