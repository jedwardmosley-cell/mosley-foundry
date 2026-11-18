import { redirect } from "next/navigation";

/** The Vehicle Controls used to live at /blueprint. Old links land on the new address. */
export default function OldBlueprint() {
  redirect("/road");
}
