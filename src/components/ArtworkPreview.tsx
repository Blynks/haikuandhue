type RevisionLike = {
  id: string;
  status?: string;
  poem: { lines: string[]; syllableCounts?: number[]; syllableUncertain?: boolean };
  background: { name: string; svgTemplate: string };
  caption: string;
  altText: string;
};

export function ArtworkPreview({ revision, compact = false }: { revision: RevisionLike; compact?: boolean }) {
  return (
    <article className="art-card overflow-hidden rounded-[2rem] border border-white/70">
      <div className="relative aspect-square" aria-label={revision.altText}>
        <div className="absolute inset-0" dangerouslySetInnerHTML={{ __html: revision.background.svgTemplate }} />
        <div className="absolute inset-x-[11%] top-[31%] rounded-[2rem] bg-[#fff8ed]/60 p-7 text-center backdrop-blur-[1px]">
          {revision.poem.lines.map((line) => <p key={line} className={`${compact ? "text-xl" : "text-2xl sm:text-3xl"} font-[var(--font-cormorant)] font-semibold text-[#2f2925]`}>{line}</p>)}
        </div>
      </div>
      <div className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#846e5e]">
          <span>{revision.background.name}</span>
          {revision.status ? <span className="rounded-full bg-white/70 px-2 py-1">{revision.status}</span> : null}
        </div>
        {revision.poem.syllableCounts ? <p className="text-sm text-[#6f6258]">Estimated syllables: {revision.poem.syllableCounts.join("-")} {revision.poem.syllableUncertain ? "· flagged for review" : ""}</p> : null}
        {!compact ? <p className="text-sm text-[#6f6258]">{revision.caption}</p> : null}
      </div>
    </article>
  );
}
