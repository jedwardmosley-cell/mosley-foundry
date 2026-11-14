import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveSettings, setCalendarLink } from "@/app/actions/participant";
import { appUrl, emailAvailable } from "@/lib/email";
import { TimezoneField } from "@/components/Timezone";
import { CopyLink } from "@/components/CopyLink";
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
  const feed = p.calendarToken ? `${appUrl()}/calendar/${p.calendarToken}.ics` : null;
  return (
    <>
      <PageHeader title="Settings" />
      <Card>
        {/* Keyed on the saved values, so after Save the fields show what was saved. */}
        <form key={[p.remindersOn, p.reminderTime, p.reminderDays, p.reminderBy, p.aiEnabled, p.aiRetentionDays].join("|")} action={saveSettings} className="space-y-5">
          <h2 className="h3">Daily check-in reminder</h2>
          <label className="flex items-center gap-2 text-[15px]"><input type="checkbox" name="remindersOn" defaultChecked={p.remindersOn} className="h-4 w-4 accent-navy" /> Remind me to check in</label>
          <Field label="Time"><input type="time" name="reminderTime" defaultValue={p.reminderTime} className="input max-w-[160px]" /></Field>
          <ReminderDays days={days} />
          <fieldset>
            <legend className="label">How</legend>
            <div className="flex flex-wrap gap-2">
              {([["EMAIL", "Email"], ["CALENDAR", "Calendar alert"], ["BOTH", "Both"]] as const).map(([k, l]) => (
                <label key={k} className="cursor-pointer">
                  <input type="radio" name="reminderBy" value={k} defaultChecked={p.reminderBy === k} className="peer sr-only" />
                  <span className="pick block peer-checked:bg-surface peer-checked:text-heading peer-checked:shadow-[0_0_0_2px_rgb(var(--navy)/0.45)]">{l}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <TimezoneField />
          <p className="text-xs text-ink-mute">
            One reminder a day at most, and none once you&apos;ve checked in. The email says only that it&apos;s time to check in, never what you&apos;re working on.
            {" "}Calendar alerts need your calendar link below.
            {!emailAvailable() && " Email reminders aren't switched on for this app yet, so for now use a calendar alert."}
          </p>
          <h2 className="h3 pt-4 border-t border-line">AI companion</h2>
          <label className="flex items-center gap-2 text-[15px]"><input type="checkbox" name="aiEnabled" defaultChecked={p.aiEnabled} className="h-4 w-4 accent-navy" /> Use the AI companion</label>
          <Field label="Keep conversations for (days)" hint="Conversations older than this are deleted automatically.">
            <input type="number" name="aiRetentionDays" min={1} max={365} defaultValue={p.aiRetentionDays} className="input max-w-[160px]" />
          </Field>
          <Submit>Save settings</Submit>
        </form>
        <form action={deleteAllConversations} className="mt-6 border-t border-line pt-5">
          <button className="btn-quiet !text-alert">Delete all AI conversations now</button>
        </form>
      </Card>
      <Card className="mt-6">
        <h2 className="h3">My calendar</h2>
        <p className="mt-2 text-[15px] text-ink-soft">
          Put your routines from My road, check-ins with your people and coaching sessions on the calendar you already use.
          Change something in the app and your calendar follows.
        </p>
        {feed ? (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={feed.replace(/^https?:/, "webcal:")} className="btn-quiet !px-4 !py-2 text-sm">Apple Calendar</a>
              <a href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(feed.replace(/^https?:/, "webcal:"))}`} target="_blank" rel="noopener" className="btn-quiet !px-4 !py-2 text-sm">Google Calendar</a>
              <a href={`https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(feed)}&name=${encodeURIComponent("Both Hands on the Wheel")}`} target="_blank" rel="noopener" className="btn-quiet !px-4 !py-2 text-sm">Outlook</a>
              <CopyLink url={feed} />
            </div>
            <p className="mt-3 text-xs text-ink-mute">
              This link is private. Anyone who has it can see these items, so don&apos;t share it. Calendar apps check for changes on their own schedule,
              anywhere from a few minutes to about a day. Routines with no day or time stay off the calendar until you add one on My road.
            </p>
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <form action={setCalendarLink}><input type="hidden" name="mode" value="RESET" /><button className="btn-link">Get a new link (the old one stops working)</button></form>
              <form action={setCalendarLink}><input type="hidden" name="mode" value="OFF" /><button className="text-ink-mute hover:text-alert">Turn off my calendar link</button></form>
            </div>
          </>
        ) : (
          <form action={setCalendarLink} className="mt-4"><input type="hidden" name="mode" value="ON" /><Submit>Put it on my calendar</Submit></form>
        )}
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
