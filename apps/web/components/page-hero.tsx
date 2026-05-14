type PageHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function PageHero({ eyebrow, title, description }: PageHeroProps) {
  return (
    <div className="glass-card rounded-[28px] px-6 py-7 sm:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--accent-strong)]">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)] sm:text-base">
        {description}
      </p>
    </div>
  );
}
