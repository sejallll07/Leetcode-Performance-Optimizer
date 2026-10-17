import { Logo } from "@/components/layout/logo";
import { Container } from "@/components/ui/container";

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <Container className="flex flex-col items-center justify-between gap-4 py-8 text-sm text-foreground-muted sm:flex-row">
        <Logo />
        <p>&copy; {new Date().getFullYear()} DSA Intelligence. Built for students, by a student.</p>
      </Container>
    </footer>
  );
}
