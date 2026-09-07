import { signInAction } from "@/lib/studio";

export function LoginPanel({ error }: { error?: boolean }) {
  return (
    <main className="mx-auto max-w-lg rounded-[2rem] border border-white/70 bg-white/50 p-8 shadow-2xl shadow-stone-900/10">
      <p className="text-sm uppercase tracking-[0.3em] text-[#9a765f]">Private studio</p>
      <h2 className="mt-3 font-[var(--font-cormorant)] text-4xl font-semibold">Open your journal</h2>
      <p className="mt-3 text-[#6f6258]">Authentication keeps mood entries separate from public captions. In demo mode, use the password <strong>demo</strong>.</p>
      <form action={signInAction} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">Password
          <input name="password" type="password" required className="mt-2 w-full rounded-2xl border border-[#d9c5ad] bg-white/80 px-4 py-3 outline-none focus:ring-2 focus:ring-[#c98578]" />
        </label>
        {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">That password did not open the studio.</p> : null}
        <button className="w-full rounded-full bg-[#2f2925] px-5 py-3 font-semibold text-white">Enter Haiku & Hue</button>
      </form>
    </main>
  );
}
