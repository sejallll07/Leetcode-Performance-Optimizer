import Link from "next/link";
import { Compass } from "lucide-react";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold text-foreground">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-brand-foreground">
        <Compass className="h-4 w-4" />
      </span>
      <span>
        DSA <span className="text-brand">Intelligence</span>
      </span>
    </Link>
  );
}
