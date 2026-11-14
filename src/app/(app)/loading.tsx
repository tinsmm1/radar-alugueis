import { Skeleton } from "@/components/ui/skeleton";

/** Generic page skeleton (title, summary tiles and a card grid) for every signed-in page. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-4 p-4 lg:px-6" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-8 w-64 rounded-lg" />
      <Skeleton className="h-4 w-96 max-w-full rounded" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-64 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
