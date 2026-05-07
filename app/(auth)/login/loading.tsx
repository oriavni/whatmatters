import { Skeleton } from "@/components/ui/skeleton";

export default function LoginLoading() {
  return (
    <div className="w-full max-w-sm rounded-xl border bg-card p-6 space-y-6">
      {/* Header */}
      <div className="space-y-1.5">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-4 w-44" />
      </div>

      {/* Google button */}
      <Skeleton className="h-9 w-full rounded-md" />

      {/* Divider */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-px flex-1" />
        <Skeleton className="h-3 w-4" />
        <Skeleton className="h-px flex-1" />
      </div>

      {/* Email + password */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
        <Skeleton className="h-9 w-full rounded-md" />
      </div>

      {/* Footer */}
      <div className="flex justify-center">
        <Skeleton className="h-4 w-40" />
      </div>
    </div>
  );
}
