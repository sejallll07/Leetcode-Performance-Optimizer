import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export function Cta() {
  return (
    <section className="border-t border-border bg-brand">
      <Container className="flex flex-col items-center gap-6 py-16 text-center text-brand-foreground md:py-20">
        <h2 className="text-3xl font-semibold tracking-tight">
          Find out what your LeetCode history actually says about you.
        </h2>
        <Button href="/signup" variant="secondary" size="lg">
          Create your account
          <ArrowRight className="h-4 w-4" />
        </Button>
      </Container>
    </section>
  );
}
