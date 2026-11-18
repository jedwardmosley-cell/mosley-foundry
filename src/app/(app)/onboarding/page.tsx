import { requireUser } from "@/lib/auth";
import { PATHWAYS } from "@/content/program";
import { choosePathway } from "@/app/actions/participant";
import { PageHeader } from "@/components/ui";
import { Submit } from "@/components/Submit";

export const metadata = { title: "Choose your pathway" };

export default async function Onboarding() {
  const u = await requireUser("PARTICIPANT");
  return (
    <>
      <PageHeader eyebrow="Getting in the Driver's Seat" title={`Which program are you in, ${u.name.split(" ")[0]}?`}>
        This sets which program materials you see. Next, you&apos;ll name the seat you&apos;re in. You can change the program later.
      </PageHeader>
      <div className="grid gap-4">
        {Object.values(PATHWAYS).map((p) => (
          <form key={p.key} action={choosePathway} className="card flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <input type="hidden" name="pathway" value={p.key} />
            <div>
              <h2 className="h2">{p.name}</h2>
              <p className="muted mt-1 text-[15px]">{p.line}</p>
            </div>
            <Submit className="btn-primary shrink-0">Choose</Submit>
          </form>
        ))}
      </div>
      <p className="mt-8 text-sm muted max-w-2xl">
        This is a leadership development experience, not therapy. You choose how much to disclose. Your reflections and journal are private unless you decide to share specific items with your coach.
      </p>
    </>
  );
}
