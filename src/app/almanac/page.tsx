import { ArtworkPreview } from "@/components/ArtworkPreview";
import { LoginPanel } from "@/components/LoginPanel";
import { isAuthenticated } from "@/lib/auth";
import { cancelRevisionAction, getStudioSnapshot } from "@/lib/studio";
import type { DeliveryView, RevisionView } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AlmanacPage() {
  if (!(await isAuthenticated())) return <LoginPanel />;
  const snapshot = await getStudioSnapshot();
  return (
    <main className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/45 p-6">
        <p className="text-sm uppercase tracking-[0.3em] text-[#9a765f]">Private almanac</p>
        <h2 className="mt-2 font-[var(--font-cormorant)] text-4xl font-semibold">Calendar and archive</h2>
        <p className="mt-2 text-[#6f6258]">Mood check-ins remain private here. Public captions and manual downloads live on immutable revisions only.</p>
      </section>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {snapshot.revisions.map((revision: RevisionView) => (
          <section key={revision.id} className="space-y-3 rounded-[2rem] bg-white/40 p-4">
            <ArtworkPreview revision={revision} compact />
            <dl className="text-sm text-[#6f6258]"><dt className="font-semibold text-[#2f2925]">Schedule</dt><dd>{revision.scheduledFor ? new Date(revision.scheduledFor).toLocaleString() : "Not scheduled"}</dd><dt className="mt-2 font-semibold text-[#2f2925]">Delivery tracking</dt><dd>{revision.deliveries?.length ? revision.deliveries.map((delivery: DeliveryView) => `${delivery.destination.label}: ${delivery.status}`).join(" · ") : "No destination selected"}</dd></dl>
            <div className="flex flex-wrap gap-2"><a className="rounded-full bg-white/70 px-3 py-2 text-sm" href={`/api/render/${revision.id}?size=square`}>Download square</a><a className="rounded-full bg-white/70 px-3 py-2 text-sm" href={`/api/render/${revision.id}?size=portrait`}>Download portrait</a></div>
            <form action={cancelRevisionAction}><input type="hidden" name="revisionId" value={revision.id} /><button className="rounded-full px-3 py-2 text-sm text-[#8d4036]" disabled={snapshot.demoMode}>Cancel schedule</button></form>
          </section>
        ))}
      </div>
    </main>
  );
}
