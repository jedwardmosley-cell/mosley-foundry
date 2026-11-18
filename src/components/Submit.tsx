"use client";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function Submit({ children, className = "btn-primary", name, value, formAction }: { children: ReactNode; className?: string; name?: string; value?: string; formAction?: (fd: FormData) => void | Promise<void> }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} name={name} value={value} formAction={formAction}>
      {pending ? "Saving..." : children}
    </button>
  );
}
