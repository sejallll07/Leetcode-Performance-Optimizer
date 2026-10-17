import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function Hero() {
  return (
    <section className="border-b border-border bg-surface">
      <Container className="grid gap-12 py-16 md:grid-cols-2 md:items-center md:py-24">
        <div>
          <Badge variant="brand" className="mb-4">
            <Sparkles className="mr-1 h-3 w-3" />
            Built from your real LeetCode history
          </Badge>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Your personal DSA coach, not another stats dashboard.
          </h1>
          <p className="mt-5 text-lg text-foreground-muted">
            DSA Intelligence reads your actual solving history and tells you what
            you&apos;re good at, what you&apos;re weak at, what fundamentals you&apos;re missing,
            and exactly what to practice next — for internships, placements, and
            interviews.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button href="/signup" size="lg">
              Get started free
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button href="#how-it-works" variant="secondary" size="lg">
              See how it works
            </Button>
          </div>
        </div>

        <Card className="border-border">
          <CardContent className="space-y-4">
            <p className="text-sm font-medium text-foreground-muted">
              Sample topic diagnosis
            </p>
            {[
              { topic: "Binary Search", status: "Strong", variant: "success" as const, detail: "Easy & Medium solid — limited Hard exposure" },
              { topic: "Dynamic Programming", status: "Weak", variant: "warning" as const, detail: "Inconsistent performance, low confidence" },
              { topic: "Segment Tree", status: "Unknown", variant: "neutral" as const, detail: "Not enough evidence yet" },
            ].map((row) => (
              <div
                key={row.topic}
                className="flex items-center justify-between rounded-md border border-border p-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{row.topic}</p>
                  <p className="text-xs text-foreground-muted">{row.detail}</p>
                </div>
                <Badge variant={row.variant}>{row.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </Container>
    </section>
  );
}
