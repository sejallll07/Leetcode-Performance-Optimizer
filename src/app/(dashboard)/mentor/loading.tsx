import { Skeleton } from "@/components/ui/skeleton";

export default function MentorLoading() {
  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col">
      <div className="mb-4 shrink-0 space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>

      <Skeleton className="flex-1 w-full" />
    </div>
  );
}