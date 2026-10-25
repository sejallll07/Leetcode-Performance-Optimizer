import type { Metadata } from "next";
import { Lightbulb, MessageCircle, Target, TrendingUp } from "lucide-react";
import { getCurrentSession } from "@/lib/session";
import { getMentorConversation } from "@/services/mentor/mentor-service";
import { loadProblemCatalog } from "@/repositories/problem-catalog-repository";
import { MentorWidget } from "@/components/mentor/mentor-widget";
import { Card, CardContent } from "@/components/ui/card";
import { HINT_LEVELS } from "@/lib/mentor/config";
import type { MentorCatalogProblem } from "@/lib/mentor/mentor-view";

export const metadata: Metadata = {
  title: "AI Mentor \u2014 DSA Intelligence",
};

const HIGHLIGHTS = [
  {
    icon: Lightbulb,
    title: "Hints, one step at a time",
    description: `${HINT_LEVELS.length} steps, from a gentle nudge to a full walkthrough. The solution appears only when you ask for it.`,
  },
  {
    icon: TrendingUp,
    title: "Why your scores move",
    description: "Ask what to practice today or why a score dropped. Answers draw on your own solve history.",
  },
  {
    icon: Target,
    title: "Problems worth practicing",
    description: "Pick a problem from the catalog, or ask for one by topic, such as Binary Search.",
  },
];

export default async function MentorPage() {
  const session = await getCurrentSession();

  const [messages, fullCatalog] = session?.user
    ? await Promise.all([getMentorConversation(session.user.id), loadProblemCatalog()])
    : [[], []];

  // Only these four fields ever reach the browser.
  const catalog: MentorCatalogProblem[] = fullCatalog.map((p) => ({
    slug: p.slug,
    title: p.title,
    difficulty: p.difficulty,
    topicSlugs: p.topicSlugs,
  }));

  const hasConversation = messages.length > 0;

  return (
    <>
      <div className="mx-auto max-w-3xl space-y-6 pb-20">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">AI Mentor</h1>
          <p className="text-sm text-foreground-muted">Your coach for practice, hints and why your scores move.</p>
        </header>

        <Card>
          <CardContent>
            <ul className="space-y-4">
              {HIGHLIGHTS.map(({ icon: Icon, title, description }) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-brand">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{title}</p>
                    <p className="text-sm text-foreground-muted">{description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <p className="flex items-center gap-2 text-sm text-foreground-muted">
          <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {hasConversation
            ? "Your conversation is saved. Open AI Mentor in the bottom-right corner to continue."
            : "Open AI Mentor in the bottom-right corner to start."}
        </p>
      </div>

      <MentorWidget
        catalog={catalog}
        initialMessages={messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          hintLevel: m.hintLevel,
          problemSlug: m.problemSlug,
        }))}
      />
    </>
  );
}