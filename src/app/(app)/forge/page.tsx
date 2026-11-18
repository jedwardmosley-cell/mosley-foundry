import { redirect } from "next/navigation";

/** The FORGE opening now sits on the Driver's Seat, above the five letters. */
export default function ForgeIntro() {
  redirect("/identity#forge");
}
