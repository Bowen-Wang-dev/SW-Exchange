import { AppShell } from "./app-shell";
import { PageHero } from "./page-hero";
import { PlaceholderCard } from "./placeholder-card";

type PageTemplateProps = {
  eyebrow: string;
  title: string;
  description: string;
  cards: Array<{
    title: string;
    points: string[];
  }>;
};

export function PageTemplate({ eyebrow, title, description, cards }: PageTemplateProps) {
  return (
    <AppShell>
      <div className="space-y-6">
        <PageHero eyebrow={eyebrow} title={title} description={description} />
        <div className="grid gap-6 xl:grid-cols-2">
          {cards.map((card) => (
            <PlaceholderCard key={card.title} title={card.title} points={card.points} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
