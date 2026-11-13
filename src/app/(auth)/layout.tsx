import { BrandMark } from "@/components/BrandMark";
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 grid md:grid-cols-2">
        <section className="hidden md:flex flex-col justify-between bg-navy-deep text-white p-12">
          <p className="flex items-center gap-3 text-[11px] tracking-[0.18em] uppercase text-white/60"><BrandMark size={34} className="text-white" /> Mosley Foundry</p>
          <div>
            <h1 className="font-serif text-5xl leading-[1.1]">Both Hands<br />on the Wheel</h1>
            <p className="mt-6 text-lg text-white/80 max-w-sm">Lead yourself. Develop others. Build a life by design.</p>
          </div>
          <p className="text-sm text-white/50">Created by Jason Mosley</p>
        </section>
        <section className="flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-sm">
            <div className="md:hidden mb-10">
              <BrandMark size={40} className="text-heading mb-3" />
              <p className="font-serif text-3xl text-heading">Both Hands on the Wheel</p>
              <p className="mt-2 muted">Lead yourself. Develop others. Build a life by design.</p>
            </div>
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}
