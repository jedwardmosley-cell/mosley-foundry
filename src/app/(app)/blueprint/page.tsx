import { redirect } from "next/navigation";

/** My road used to live at /blueprint. Old links land on the new address. */
export default function OldBlueprint() {
  redirect("/road");
}
