import { redirect } from "next/navigation";

/** The FORGE opening now sits on Who's behind the wheel, above the five letters. */
export default function ForgeIntro() {
  redirect("/identity#forge");
}
