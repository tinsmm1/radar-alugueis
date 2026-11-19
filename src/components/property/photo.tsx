import { Home } from "lucide-react";
import { cn } from "@/lib/utils";

export function Photo({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  if (!src) {
    return (
      <div className={cn("flex items-center justify-center bg-gradient-to-br from-accent to-muted text-primary/40", className)} aria-hidden>
        <Home className="size-10" />
      </div>
    );
  }
  // Listing photos come from the advertisers' own hosts (any domain), so next/image is not used.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" className={cn("object-cover", className)} />;
}
