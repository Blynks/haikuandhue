import { LoginPanel } from "@/components/LoginPanel";
import { isAuthenticated } from "@/lib/auth";
import { getStudioSnapshot } from "@/lib/studio";
import type { DestinationView } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  if (!(await isAuthenticated())) return <LoginPanel />;
  const snapshot = await getStudioSnapshot();
  return (
    <main className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/45 p-6">
        <p className="text-sm uppercase tracking-[0.3em] text-[#9a765f]">Settings</p>
        <h2 className="mt-2 font-[var(--font-cormorant)] text-4xl font-semibold">Capabilities, credentials, and boundaries</h2>
        <p className="mt-2 max-w-3xl text-[#6f6258]">Generation credentials stay server-side. Publishing credentials are separate from generation and are not available to the generation path. Until a platform is connected, manual export is the only active route.</p>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        {snapshot.destinations.map((destination: DestinationView) => <article key={destination.slug} className="rounded-[1.5rem] border border-white/70 bg-white/50 p-5"><p className="text-sm uppercase tracking-[0.2em] text-[#9a765f]">{String(destination.state).toLowerCase().replaceAll("_", " ")}</p><h3 className="mt-2 text-xl font-semibold">{destination.label}</h3><p className="mt-2 text-sm text-[#6f6258]">{destination.note}</p></article>)}
      </div>
      <section className="rounded-[2rem] bg-[#fff8ed]/70 p-6"><h3 className="font-[var(--font-cormorant)] text-3xl font-semibold">Functional status</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-[#6f6258]"><li>Functional: private authentication, mood check-in, demo text generation, procedural backgrounds, editing, approval, scheduling records, archive, manual image export.</li><li>Demo-only: text model generation without credentials uses clearly labeled sample haikus.</li><li>Awaiting integration: social network publishing, external image models, and platform-specific credential vault connections.</li></ul></section>
    </main>
  );
}
