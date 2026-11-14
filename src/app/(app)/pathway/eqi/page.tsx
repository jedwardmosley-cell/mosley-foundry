import { redirect } from "next/navigation";

/** EQ-i priorities now live in My feedback, with each priority under the debrief it came from. */
export default function OldEqi() {
  redirect("/feedback");
}
