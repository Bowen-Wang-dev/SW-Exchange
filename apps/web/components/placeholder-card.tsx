type PlaceholderCardProps = {
  title: string;
  points: string[];
};

export function PlaceholderCard({ title, points }: PlaceholderCardProps) {
  return (
    <section className="glass-card rounded-[28px] p-6">
      <h3 className="text-lg font-semibold">{title}</h3>
      <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--muted)]">
        {points.map((point) => (
          <li
            key={point}
            className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-3"
          >
            {point}
          </li>
        ))}
      </ul>
    </section>
  );
}
