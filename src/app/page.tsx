import Link from "next/link";
import { ArtworkPreview } from "@/components/ArtworkPreview";
import { LoginPanel } from "@/components/LoginPanel";
import { TodayForm } from "@/components/TodayForm";
import { isAuthenticated } from "@/lib/auth";
import { createMixedRevisionAction, getStudioSnapshot } from "@/lib/studio";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  if (!(await isAuthenticated())) return <LoginPanel />;
  const snapshot = await getStudioSnapshot();
  const today = snapshot.today;
  return (
    <main className="space-y-8">
      {snapshot.reminder ? <section className="rounded-[2rem] border border-[#f0d8a9] bg-[#fff7df] p-5 text-[#6d551b]">No mood input has been recorded today. Haiku & Hue will remind you rather than reuse yesterday's feelings.</section> : null}
      <TodayForm demoMode={snapshot.demoMode} />
      {snapshot.demoMode ? <section className="rounded-[2rem] border border-[#e3cab0] bg-white/45 p-5 text-[#6f6258]">Demo mode is active because the app has no reachable PostgreSQL database or text-model credentials. Sample poems and procedural backgrounds are labeled as demo content.</section> : null}
      {today ? (
        <section className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-[#9a765f]">Recommended pairings</p>
              <h2 className="font-[var(--font-cormorant)] text-4xl font-semibold">Today&apos;s studio table</h2>
            </div>
            <Link href="/review" className="rounded-full bg-white/65 px-5 py-3 font-semibold">Review approvals</Link>
          </div>
          <div className="grid gap-5 md:grid-cols-3">{today.revisions.map((revision: any) => <ArtworkPreview key={revision.id} revision={revision} />)}</div>
          <div className="rounded-[2rem] border border-white/70 bg-white/45 p-5">
            <h3 className="font-[var(--font-cormorant)] text-3xl font-semibold">Mix all nine combinations</h3>
            <p className="mt-1 text-[#6f6258]">Keep a poem, swap a background, or create a new draft revision without changing the original recommendation.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {today.poems.flatMap((poem: any) => today.backgrounds.map((background: any) => (
                <form key={`${poem.id}-${background.id}`} action={createMixedRevisionAction} className="rounded-2xl bg-white/55 p-4">
                  <input type="hidden" name="checkInId" value={today.id} /><input type="hidden" name="poemId" value={poem.id} /><input type="hidden" name="backgroundId" value={background.id} />
                  <p className="font-[var(--font-cormorant)] text-xl">{poem.lines[0]}</p><p className="text-sm text-[#6f6258]">with {background.name}</p>
                  <button className="mt-3 rounded-full border border-[#c7ae96] px-3 py-2 text-sm" disabled={snapshot.demoMode}>Create draft</button>
                </form>
              )))}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
