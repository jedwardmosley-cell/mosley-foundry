"use client";
import { useEffect } from "react";

/**
 * The self-assessment, one rule at a time on the same page: picking a level closes that rule,
 * shows the pick in its heading and opens the next rule still to rate. Before saving, any rule
 * left unrated opens so nothing is missed. Without JavaScript, every rule can still be opened by tapping it.
 */
export function RuleAccordion({ formId }: { formId: string }) {
  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const rules = () => Array.from(form.querySelectorAll<HTMLDetailsElement>("details[data-rule]"));
    const rated = (d: HTMLDetailsElement) => !!d.querySelector("input[type=radio]:checked");
    const onChange = (e: Event) => {
      const input = e.target as HTMLInputElement;
      if (input.type !== "radio") return;
      const here = input.closest<HTMLDetailsElement>("details[data-rule]");
      if (!here) return;
      const pick = here.querySelector<HTMLElement>("[data-pick]");
      if (pick) pick.textContent = `${input.value}: ${input.dataset.level ?? ""}`;
      window.setTimeout(() => {
        here.open = false;
        const next = rules().find((d) => !rated(d));
        if (next) { next.open = true; next.scrollIntoView({ behavior: "smooth", block: "start" }); }
        else here.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 350);
    };
    const openMissing = () => rules().forEach((d) => { if (!rated(d)) d.open = true; });
    const onInvalid = (e: Event) => { const d = (e.target as HTMLElement).closest<HTMLDetailsElement>("details[data-rule]"); if (d) d.open = true; };
    const submit = form.querySelector("button[type=submit]");
    form.addEventListener("change", onChange);
    form.addEventListener("invalid", onInvalid, true);
    submit?.addEventListener("click", openMissing, true);
    return () => {
      form.removeEventListener("change", onChange);
      form.removeEventListener("invalid", onInvalid, true);
      submit?.removeEventListener("click", openMissing, true);
    };
  }, [formId]);
  return null;
}
