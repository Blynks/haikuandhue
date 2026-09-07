import { ArtworkPreview } from "@/components/ArtworkPreview";
import { LoginPanel } from "@/components/LoginPanel";
import { isAuthenticated } from "@/lib/auth";
import { approveRevisionAction, getStudioSnapshot, rejectRevisionAction, updateRevisionAction } from "@/lib/studio";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  if (!(await isAuthenticated())) return <LoginPanel />;
  const snapshot = await getStudioSnapshot();
  const revisions = snapshot.revisions;
  return (
    <main className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/45 p-6">
        <p className="text-sm uppercase tracking-[0.3em] text-[#9a765f]">Human approval required</p>
        <h2 className="mt-2 font-[var(--font-cormorant)] text-4xl font-semibold">Nothing publishes without your final yes.</h2>
        <p className="mt-2 max-w-3xl text-[#6f6258]">Approving stores an immutable revision: exact poem, background, typography, caption, alt text, destinations, visibility, and schedule. Any edit returns the revision to draft and cancels queued delivery attempts.</p>
      </section>
      {revisions.length === 0 ? <p className="rounded-[2rem] bg-white/45 p-6">No drafts yet. Complete today&apos;s check-in first.</p> : null}
      <div className="grid gap-6 lg:grid-cols-2">
        {revisions.map((revision: any) => (
          <section key={revision.id} className="grid gap-4 rounded-[2rem] border border-white/70 bg-white/40 p-4">
            <ArtworkPreview revision={revision} />
            <form action={updateRevisionAction} className="grid gap-3 rounded-[1.5rem] bg-white/55 p-4">
              <input type="hidden" name="revisionId" value={revision.id} />
              {revision.poem.lines.map((line: string, index: number) => <label key={index} className="text-sm font-medium">Line {index + 1}<input name={`line${index + 1}`} defaultValue={line} className="mt-1 w-full rounded-xl border border-[#d6c1aa] px-3 py-2" /></label>)}
              <label className="text-sm font-medium">Caption<textarea name="caption" defaultValue={revision.caption} rows={3} className="mt-1 w-full rounded-xl border border-[#d6c1aa] px-3 py-2" /></label>
              <label className="text-sm font-medium">Alt text<textarea name="altText" defaultValue={revision.altText} rows={2} className="mt-1 w-full rounded-xl border border-[#d6c1aa] px-3 py-2" /></label>
              <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">Typeface<input name="family" defaultValue="Georgia, serif" className="mt-1 w-full rounded-xl border px-3 py-2" /></label><label className="text-sm">Ink<input name="ink" type="color" defaultValue="#2f2925" className="mt-1 h-10 w-full" /></label><label className="text-sm">Scale<input name="scale" type="number" step="0.1" min="0.7" max="1.4" defaultValue="1" className="mt-1 w-full rounded-xl border px-3 py-2" /></label></div>
              <input type="hidden" name="align" value="center" />
              <button className="rounded-full border border-[#b99f86] px-4 py-2" disabled={snapshot.demoMode}>Save edit / invalidate approval</button>
            </form>
            <form action={approveRevisionAction} className="grid gap-3 rounded-[1.5rem] bg-[#fff8ed]/75 p-4">
              <input type="hidden" name="revisionId" value={revision.id} />
              <label className="text-sm font-medium">Publishing time<input name="scheduledFor" type="datetime-local" className="mt-1 w-full rounded-xl border border-[#d6c1aa] px-3 py-2" /></label>
              <fieldset><legend className="text-sm font-medium">Destination accounts</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{snapshot.destinations.map((destination: any) => <label key={destination.slug} className="rounded-xl bg-white/65 px-3 py-2 text-sm"><input type="checkbox" name="destinations" value={destination.slug} defaultChecked={destination.slug === "manual-export"} className="mr-2" />{destination.label}<span className="ml-1 text-[#826f62]">({String(destination.state).toLowerCase().replaceAll("_", " ")})</span></label>)}</div></fieldset>
              <button className="rounded-full bg-[#2f2925] px-4 py-3 font-semibold text-white" disabled={snapshot.demoMode}>Approve and schedule immutable revision</button>
            </form>
            <form action={rejectRevisionAction}><input type="hidden" name="revisionId" value={revision.id} /><button className="rounded-full px-4 py-2 text-[#8d4036]" disabled={snapshot.demoMode}>Reject draft</button></form>
          </section>
        ))}
      </div>
    </main>
  );
}
