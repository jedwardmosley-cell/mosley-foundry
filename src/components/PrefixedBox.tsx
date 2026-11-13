import { afterPrefix } from "@/content/forgeLines";

/**
 * A text box that starts with fixed words ("I am", "I notice"). The client finishes the sentence.
 * An older answer that does not start with those words is shown whole, without the fixed start, so nothing is lost.
 */
export function PrefixedBox({ name, prefix, saved, placeholder, maxLength = 1500, id }: {
  name: string; prefix: string; saved: string; placeholder?: string; maxLength?: number; id?: string;
}) {
  const rest = afterPrefix(prefix, saved);
  const fixed = !!prefix && rest !== null;
  const shown = fixed ? rest : saved;
  const rows = Math.min(6, Math.max(2, Math.ceil((shown?.length ?? 0) / 34)));
  return (
    <div className="flex items-start inputbox">
      {fixed && <span className="pl-4 pr-1.5 py-3 font-serif text-[17px] leading-6 text-heading select-none whitespace-nowrap">{prefix}</span>}
      {fixed && <input type="hidden" name={`${name}__p`} value="1" />}
      <textarea id={id ?? name} name={name} rows={rows} maxLength={maxLength} defaultValue={shown} placeholder={placeholder}
        className={`flex-1 min-w-0 resize-none bg-transparent py-3 pr-4 text-[15px] leading-6 focus:outline-none ${fixed ? "" : "pl-3.5"}`} />
    </div>
  );
}
