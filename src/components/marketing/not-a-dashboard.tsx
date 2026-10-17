import { Check, X } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Card, CardContent } from "@/components/ui/card";

const notThis = [
  "Total problems solved",
  "Easy / medium / hard counts",
  "Streaks and rankings",
  "Raw submission statistics",
];

const thisInstead = [
  "What am I actually good at?",
  "What am I weak at, and why?",
  "What fundamentals am I missing?",
  "What should I practice next?",
];

export function NotADashboard() {
  return (
    <section className="border-y border-border bg-surface-muted py-16 md:py-24">
      <Container className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardContent>
            <p className="mb-4 text-sm font-semibold text-foreground-muted">
              Not another dashboard that shows you
            </p>
            <ul className="space-y-3">
              {notThis.map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-foreground-muted">
                  <X className="h-4 w-4 shrink-0 text-danger" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-brand">
          <CardContent>
            <p className="mb-4 text-sm font-semibold text-brand">
              A coach that answers
            </p>
            <ul className="space-y-3">
              {thisInstead.map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-foreground">
                  <Check className="h-4 w-4 shrink-0 text-success" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </Container>
    </section>
  );
}
