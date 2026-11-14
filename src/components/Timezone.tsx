"use client";
import { useEffect, useState } from "react";

const browserZone = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return ""; }
};

/** Quietly records the browser's time zone when it differs from the saved one, so reminders arrive at local time. */
export function TimezoneSync({ saved }: { saved: string }) {
  useEffect(() => {
    const tz = browserZone();
    if (!tz || tz === saved) return;
    fetch("/api/timezone", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ timezone: tz }) }).catch(() => {});
  }, [saved]);
  return null;
}

/** A hidden form field carrying the browser's time zone. */
export function TimezoneField() {
  const [tz, setTz] = useState("");
  useEffect(() => setTz(browserZone()), []);
  return <input type="hidden" name="timezone" value={tz} />;
}
