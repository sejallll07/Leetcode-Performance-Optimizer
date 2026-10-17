import { Container } from "@/components/ui/container";
import {
  History,
  LineChart,
  UserCheck,
  Target,
  ClipboardList,
  Dumbbell,
  RotateCcw,
  TrendingUp,
} from "lucide-react";

const steps = [
  { icon: History, label: "LeetCode history" },
  { icon: LineChart, label: "Data analysis" },
  { icon: UserCheck, label: "Skill profile" },
  { icon: Target, label: "Strength / weakness diagnosis" },
  { icon: ClipboardList, label: "Personalized recommendations" },
  { icon: Dumbbell, label: "Practice" },
  { icon: RotateCcw, label: "Revision" },
  { icon: TrendingUp, label: "Reassessment" },
];

export function CoreLoop() {
  return (
    <section id="how-it-works" className="py-16 md:py-24">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">
            One loop, running continuously
          </h2>
          <p className="mt-3 text-foreground-muted">
            Every feature feeds back into the same cycle — your profile is never
            static.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div
                key={step.label}
                className="flex flex-col items-center gap-2 rounded-md border border-border bg-surface p-4 text-center"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-subtle text-brand">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="text-sm font-medium text-foreground">{step.label}</p>
                <span className="text-xs text-foreground-muted">Step {i + 1}</span>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
