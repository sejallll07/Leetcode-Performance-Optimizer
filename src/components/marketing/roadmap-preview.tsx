import { Container } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";

const sections = [
  { label: "Dashboard", live: true },
  { label: "Detailed Analytics", live: false },
  { label: "Topic Mastery", live: false },
  { label: "Practice Recommendations", live: false },
  { label: "Revision Center", live: false },
  { label: "Personalized Roadmap", live: false },
  { label: "Weekly & Monthly Reports", live: false },
  { label: "AI DSA Mentor", live: false },
];

export function RoadmapPreview() {
  return (
    <section id="roadmap" className="py-16 md:py-24">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">
            Built in phases, on purpose
          </h2>
          <p className="mt-3 text-foreground-muted">
            The foundation ships first. Analytics, recommendations, and the AI
            mentor are built next, in that order, so each layer is solid before
            the next one leans on it.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          {sections.map((s) => (
            <Badge key={s.label} variant={s.live ? "brand" : "neutral"} className="px-4 py-2">
              {s.label}
              {!s.live && <span className="ml-2 text-[10px] uppercase opacity-70">soon</span>}
            </Badge>
          ))}
        </div>
      </Container>
    </section>
  );
}
