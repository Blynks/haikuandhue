import { createCheckInAction } from "@/lib/studio";

const feelings = ["calm", "tender", "lonely", "hopeful", "restless", "grateful", "heavy", "curious"];

export function TodayForm({ demoMode }: { demoMode: boolean }) {
  return (
    <form action={createCheckInAction} className="rounded-[2rem] border border-white/70 bg-white/50 p-6 shadow-xl shadow-stone-900/10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-[#9a765f]">Daily check-in</p>
          <h2 className="mt-2 font-[var(--font-cormorant)] text-4xl font-semibold">What color is today?</h2>
        </div>
        {demoMode ? <span className="rounded-full bg-[#fff3c4] px-4 py-2 text-sm font-semibold text-[#765a17]">Demo mode: connect PostgreSQL to save</span> : null}
      </div>
      <fieldset className="mt-6">
        <legend className="font-medium">Feelings</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {feelings.map((feeling) => <label key={feeling} className="cursor-pointer rounded-full border border-[#d6c1aa] bg-white/55 px-4 py-2 has-[:checked]:bg-[#2f2925] has-[:checked]:text-white"><input className="sr-only" type="checkbox" name="feelings" value={feeling} />{feeling}</label>)}
        </div>
      </fieldset>
      <div className="mt-6 grid gap-5 md:grid-cols-3">
        <label className="block font-medium">Intensity <span className="text-[#7a6b60]">1-10</span><input type="range" name="intensity" min="1" max="10" defaultValue="5" className="mt-3 w-full accent-[#c98578]" /></label>
        <label className="block font-medium">Visual style<select name="visualStyle" className="mt-2 w-full rounded-2xl border border-[#d6c1aa] bg-white/80 px-4 py-3"><option value="PAPER_GARDEN">Paper garden</option><option value="DUSK_GRADIENT">Dusk gradient</option><option value="PLAYFUL_SHAPES">Playful shapes</option><option value="QUIET_SEA">Quiet sea</option></select></label>
        <label className="block font-medium">Emotional direction<select name="direction" className="mt-2 w-full rounded-2xl border border-[#d6c1aa] bg-white/80 px-4 py-3"><option value="REFLECT">Reflect my mood</option><option value="LIFT">Gently lift it</option><option value="CONTRAST">Playfully contrast it</option></select></label>
      </div>
      <label className="mt-6 block font-medium">Inspiration text<textarea name="inspiration" rows={5} required placeholder="A walk, a weather change, a line overheard..." className="mt-2 w-full rounded-[1.5rem] border border-[#d6c1aa] bg-white/80 px-4 py-3 outline-none focus:ring-2 focus:ring-[#c98578]" /></label>
      <button className="mt-6 rounded-full bg-[#2f2925] px-6 py-3 font-semibold text-white disabled:opacity-60" disabled={demoMode}>Generate three haikus and hues</button>
    </form>
  );
}
