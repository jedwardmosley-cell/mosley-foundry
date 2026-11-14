import { redirect } from "next/navigation";

/** Each FORGE letter now lives on Who's behind the wheel, all five on one page. Old links land on the letter. */
export default async function ForgeLetter({ params }: { params: Promise<{ letter: string }> }) {
  const { letter } = await params;
  redirect(`/identity#${letter.toLowerCase().slice(0, 1)}`);
}
