import { Skeleton } from "@/components/ui/skeleton";

// Todo Module Content Skeleton - dark/light mode + mobile optimized
export function TodoModuleSkeleton() {
  return (
    <div className="space-y-2 p-1.5 md:p-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 md:gap-3 p-2 rounded-lg bg-muted/30 dark:bg-white/5">
          <Skeleton className="h-4 w-4 rounded shrink-0" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}

// Eisenhower Matrix Content Skeleton - dark/light mode + mobile optimized
export function EisenhowerModuleSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-1.5 md:gap-2 h-48 md:h-64">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg bg-muted/30 dark:bg-white/5 p-1.5 md:p-2 space-y-1.5 md:space-y-2">
          <Skeleton className="h-3 w-12 md:w-16" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}

// Invites Module Content Skeleton - dark/light mode + mobile optimized
export function InvitesModuleSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 dark:bg-white/5">
          <Skeleton className="h-6 w-6 rounded-full shrink-0" />
          <div className="flex-1 space-y-1 min-w-0">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-2 w-1/2" />
          </div>
          <div className="flex gap-1 shrink-0">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-5 w-5 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Calendar Settings Skeleton - dark/light mode + mobile optimized
export function CalendarSettingsSkeleton() {
  return (
    <div className="space-y-3 md:space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between p-2.5 md:p-3 rounded-lg bg-muted/30 dark:bg-white/5">
          <Skeleton className="h-4 w-24 md:w-32" />
          <Skeleton className="h-5 w-10 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// Analytics Skeleton - dark/light mode + mobile optimized
export function AnalyticsSkeleton() {
  return (
    <div className="space-y-3 md:space-y-4">
      <div className="grid grid-cols-2 gap-2 md:gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-2.5 md:p-3 rounded-lg bg-muted/30 dark:bg-white/5 space-y-2">
            <Skeleton className="h-3 w-14 md:w-16" />
            <Skeleton className="h-5 md:h-6 w-10 md:w-12" />
          </div>
        ))}
      </div>
      <Skeleton className="h-24 md:h-32 w-full rounded-lg" />
    </div>
  );
}
