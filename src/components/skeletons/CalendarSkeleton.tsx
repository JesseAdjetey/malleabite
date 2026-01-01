import { Skeleton } from "@/components/ui/skeleton";

// Week View Skeleton - dark/light mode + mobile optimized
export function WeekViewSkeleton() {
  return (
    <div className="p-2 md:p-4 space-y-3">
      {/* Week header - responsive */}
      <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
        {/* Mobile: 3 days */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={`mobile-${i}`} className="md:hidden text-center">
            <Skeleton className="h-3 w-6 mx-auto mb-1" />
            <Skeleton className={`h-9 w-9 rounded-full mx-auto ${i === 1 ? 'bg-primary/40' : ''}`} />
          </div>
        ))}
        {/* Desktop: 7 days */}
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={`desktop-${i}`} className="hidden md:block text-center">
            <Skeleton className="h-4 w-8 mx-auto mb-1" />
            <Skeleton className={`h-8 w-8 rounded-full mx-auto ${i === 3 ? 'bg-primary/40' : ''}`} />
          </div>
        ))}
      </div>
      
      {/* Time grid - responsive */}
      <div className="space-y-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-2">
            <Skeleton className="h-3 w-8 md:w-10 shrink-0" />
            <div className="flex-1 grid grid-cols-3 md:grid-cols-7 gap-1">
              {/* Mobile columns */}
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton key={`mobile-${j}`} className="md:hidden h-10 md:h-12 rounded" />
              ))}
              {/* Desktop columns */}
              {Array.from({ length: 7 }).map((_, j) => (
                <Skeleton key={`desktop-${j}`} className="hidden md:block h-10 rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Month View Skeleton - dark/light mode + mobile optimized
export function MonthViewSkeleton() {
  return (
    <div className="p-2 md:p-4 space-y-3">
      {/* Month header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 md:h-6 w-24 md:w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-7 md:h-8 w-7 md:w-8 rounded" />
          <Skeleton className="h-7 md:h-8 w-7 md:w-8 rounded" />
        </div>
      </div>
      
      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-3 md:h-4 w-full" />
        ))}
      </div>
      
      {/* Calendar grid - responsive cell heights */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} className="h-12 md:h-20 rounded" />
        ))}
      </div>
    </div>
  );
}

// Day View Skeleton - dark/light mode + mobile optimized
export function DayViewSkeleton() {
  return (
    <div className="p-2 md:p-4 space-y-3">
      <Skeleton className="h-6 md:h-7 w-36 md:w-48" />
      <div className="space-y-1">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex gap-2">
            <Skeleton className="h-3 w-10 md:w-12 shrink-0" />
            <Skeleton className="h-10 md:h-12 flex-1 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Generic Calendar Loading Skeleton - dark/light mode + mobile optimized
export function CalendarLoadingSkeleton() {
  return (
    <div className="flex items-center justify-center h-48 md:h-64">
      <div className="space-y-3 w-full max-w-xs md:max-w-sm px-4">
        <Skeleton className="h-5 md:h-6 w-28 md:w-32 mx-auto" />
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="h-6 md:h-8 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
