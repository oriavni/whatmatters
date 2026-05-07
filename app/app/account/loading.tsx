import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

export default function AccountLoading() {
  return (
    <div className="space-y-6 max-w-2xl">
      {/* Page header */}
      <div className="space-y-1.5">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-52" />
      </div>

      <Separator />

      {/* Signed in as */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-48" />
      </div>

      <Separator />

      {/* Current plan */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>

      <Separator />

      {/* Inbound address */}
      <div className="space-y-3">
        <div className="space-y-1">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-64" />
        </div>
        <Skeleton className="h-10 w-full rounded-md" />
      </div>

      <Separator />

      {/* Danger zone */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-80" />
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>
    </div>
  );
}
