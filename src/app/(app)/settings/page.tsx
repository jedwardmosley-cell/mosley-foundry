import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveSettings } from "@/app/actions/participant";
import { deleteAllConversations } from "@/app/actions/ai";
import { PageHeader, Card, Field } from "@/components/ui";
import { Submit } from "@/components/Submit";
import { StartOverForm } from "@/components/StartOverForm";

export const metadata = { title: "Settings" };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function SettingsPage() {
  const u = await requireUser("PARTICIPANT");
  const p = await db.profile.findUniqueOrThrow({ where: { userId: u.id } });
  const days = new Set(p.reminderDays.split(",").filter(Boolean));
  return (
    <>
      <PageHeader title="Settings" />
      <Card>
        <form action={saveSettings} className="space-y-5">
          <h2 className="h3">Daily reminder</h2>
          <label className="flex items-center gap-2 text-[15px]"><input type="checkbox" name="remindersOn" defaultChecked={p.remindersOn} className="h-4 w-4 accent-navy" /> Remind me to check in</label>
          <Field label="Time"><input type="time" name="reminderTime" defaultValue={p.reminderTime} className="input max-w-[160px]" /></Field>
          <ReminderDays days={days} />
          <p className="text-xs text-ink-mute">Reminders are not sent yet. Your choices are saved for when they are.</p>
          <h2 className="h3 pt-4 border-t border-line">AI companion</h2>
          <label className="flex items-center gap-2 text-[15px]"><input type="checkbox" name="aiEnabled" defaultChecked={p.aiEnabled} className="h-4 w-4 accent-navy" /> Use the AI companion</label>
          <Field label="Keep conversations for (days)" hint="Conversations older than this are deleted automatically.">
            <input type="number" name="aiRetentionDays" min={1} max={365} defaultValue={p.aiRetentionDays} className="input max-w-[160px]" />
          </Field>
          <Submit>Save settings</Submit>
        </form>
        <form action={deleteAllConversations} className="mt-6 border-t border-line pt-5">
          <button className="btn-quiet !text-clay">Delete all AI conversations now</button>
        </form>
      </Card>
      <div className="mt-6"><StartOverForm /></div>
    </>
  );
}

function ReminderDays({ days }: { days: Set<string> }) {
  return (
    <fieldset>
      <legend className="label">Days</legend>
      <ReminderDaysInputs days={days} />
    </fieldset>
  );
}

/** Preset day patterns posted as a single comma-separated value. */
function ReminderDaysInputs({ days }: { days: Set<string> }) {
  return (
    <div className="flex flex-wrap gap-2">
      <select name="reminderDays" defaultValue={[...days].sort().join(",")} className="input max-w-xs">
        <option value="1,2,3,4,5">Weekdays</option>
        <option value="0,1,2,3,4,5,6">Every day</option>
        <option value="1,3,5">Mon, Wed, Fri</option>
        <option value="0">Sundays only</option>
      </select>
      <span className="text-xs text-ink-mute self-center">{[...days].map((d) => DAYS[Number(d)]).join(", ")}</span>
    </div>
  );
}
