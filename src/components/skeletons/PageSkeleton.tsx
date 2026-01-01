import { Skeleton } from "@/components/ui/skeleton";

// Billing Page Skeleton - dark/light mode + mobile optimized
export function BillingSkeleton() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Back button + Title */}
      <div className="container max-w-4xl mx-auto">
        <Skeleton className="h-9 w-20 mb-4" />
        <Skeleton className="h-7 md:h-8 w-40 md:w-48 mb-2" />
        <Skeleton className="h-4 w-56 md:w-64" />
      </div>
      
      {/* Current Plan */}
      <div className="container max-w-4xl mx-auto">
        <div className="p-4 md:p-6 rounded-xl border border-border bg-card space-y-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-8 md:h-10 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      
      {/* Plan Cards */}
      <div className="container max-w-4xl mx-auto grid gap-4 grid-cols-1 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-4 md:p-6 rounded-xl border border-border bg-card space-y-4">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-8 w-24" />
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-4 w-full" />
              ))}
            </div>
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Templates Page Skeleton - dark/light mode + mobile optimized
export function TemplatesSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="p-3 md:p-4 rounded-xl bg-muted/50 dark:bg-white/5 flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2 min-w-0">
            <Skeleton className="h-4 w-28 md:w-32" />
            <Skeleton className="h-3 w-20 md:w-24" />
          </div>
          <Skeleton className="h-8 w-14 md:w-16 rounded shrink-0" />
        </div>
      ))}
    </div>
  );
}

// Settings Page Skeleton - dark/light mode + mobile optimized
export function SettingsSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <Skeleton className="h-7 md:h-8 w-32" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="p-3 md:p-4 rounded-xl border border-border bg-card space-y-3">
          <Skeleton className="h-5 w-28" />
          {Array.from({ length: 2 }).map((_, j) => (
            <div key={j} className="flex items-center justify-between py-2">
              <Skeleton className="h-4 w-28 md:w-36" />
              <Skeleton className="h-5 w-10 rounded-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// Auth Loading Skeleton - dark/light mode + mobile optimized
export function AuthLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm p-5 md:p-6 rounded-2xl bg-card border border-border space-y-4">
        <Skeleton className="h-10 w-10 rounded-full mx-auto" />
        <Skeleton className="h-6 w-32 mx-auto" />
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// App Loading Skeleton - dark/light mode + mobile optimized
// Mirrors Mainview.tsx structure with polished styling
export function AppLoadingSkeleton() {
  return (
    <div className="flex flex-col md:flex-row h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Mobile Header - shown only on mobile */}
      <div className="md:hidden flex items-center justify-between p-3 border-b border-border bg-card/80 backdrop-blur-sm">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-6 w-28 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>

      {/* Sidebar - hidden on mobile, shown on md+ */}
      <div className="hidden md:block relative" style={{ width: '350px', minWidth: '300px' }}>
        <div className="h-full bg-card/80 backdrop-blur-sm border-r border-border shadow-xl p-4 space-y-4">
          {/* + New Page button */}
          <Skeleton className="h-11 w-full rounded-xl shadow-md" />
          
          {/* Page selector */}
          <div className="flex items-center justify-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-6 w-16 rounded-md" />
            <Skeleton className="h-5 w-5 rounded" />
          </div>
          
          {/* Add Module / Manage Modules */}
          <Skeleton className="h-10 w-full rounded-lg border-2 border-dashed border-muted-foreground/20" />
          <Skeleton className="h-10 w-full rounded-lg shadow-sm" />
          
          {/* Module skeleton - Reminders style */}
          <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-24 rounded-md" />
              <div className="flex gap-1">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-5 w-5 rounded" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-4 flex-1 rounded" />
              </div>
            </div>
            <Skeleton className="h-10 w-full rounded-lg bg-primary/20 shadow-inner" />
          </div>
          
          {/* Module skeleton - Pomodoro style */}
          <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-20 rounded-md" />
              <div className="flex gap-1">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-5 w-5 rounded" />
              </div>
            </div>
            <div className="flex justify-center py-4">
              <Skeleton className="h-32 w-32 rounded-full shadow-[0_0_30px_rgba(139,92,246,0.3)]" />
            </div>
          </div>
        </div>
      </div>

      {/* Resizer - hidden on mobile */}
      <div className="hidden md:flex items-center justify-center w-6">
        <Skeleton className="h-16 w-4 rounded-md bg-primary/20" />
      </div>

      {/* Main Content */}
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        {/* Header skeleton - desktop only */}
        <div className="hidden md:flex items-center justify-between p-4 border-b border-border bg-card/50 backdrop-blur-sm shadow-sm">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl shadow-md" />
            <Skeleton className="h-9 w-16 rounded-lg shadow-sm" />
            <Skeleton className="h-7 w-7 rounded shadow-sm" />
            <Skeleton className="h-7 w-7 rounded shadow-sm" />
            <Skeleton className="h-5 w-36 rounded-md" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-12 rounded-lg shadow-sm" />
            <Skeleton className="h-9 w-14 rounded-full bg-primary/30 shadow-md" />
            <Skeleton className="h-9 w-16 rounded-full shadow-sm" />
            <Skeleton className="h-9 w-20 rounded-lg shadow-sm" />
            <Skeleton className="h-9 w-16 rounded-lg shadow-sm" />
            <Skeleton className="h-9 w-24 rounded-lg bg-primary/20 shadow-md" />
            <Skeleton className="h-9 w-9 rounded-lg shadow-sm" />
          </div>
        </div>
        
        {/* Mobile view controls */}
        <div className="md:hidden flex items-center justify-between p-2 border-b border-border bg-card/30">
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
          <div className="flex gap-1">
            <Skeleton className="h-7 w-12 rounded-full" />
            <Skeleton className="h-7 w-14 rounded-full bg-primary/30" />
            <Skeleton className="h-7 w-12 rounded-full" />
          </div>
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
        
        {/* Calendar view skeleton - responsive */}
        <div className="overflow-y-auto flex-1 p-2 md:p-3">
          <div className="rounded-xl border border-border bg-card/80 backdrop-blur-sm h-full shadow-2xl overflow-hidden">
            {/* Week header row - responsive */}
            <div className="grid grid-cols-4 md:grid-cols-8 border-b border-border bg-muted/20">
              {/* Time column - hidden on mobile */}
              <div className="hidden md:block p-3 border-r border-border">
                <Skeleton className="h-4 w-10 rounded" />
              </div>
              {/* Mobile: show 3 days */}
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={`mobile-${i}`} className="md:hidden p-2 text-center border-r border-border last:border-r-0">
                  <Skeleton className={`h-9 w-9 rounded-full mx-auto mb-1 shadow-md ${i === 1 ? 'bg-primary/40 shadow-[0_0_15px_rgba(139,92,246,0.4)]' : ''}`} />
                  <Skeleton className="h-2 w-6 mx-auto rounded" />
                </div>
              ))}
              {/* Mobile: scroll indicator */}
              <div className="md:hidden p-2 flex items-center justify-center">
                <Skeleton className="h-6 w-6 rounded" />
              </div>
              {/* Desktop: show 7 days */}
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={`desktop-${i}`} className="hidden md:block p-3 text-center border-r border-border last:border-r-0">
                  <Skeleton className={`h-10 w-10 rounded-full mx-auto mb-1 shadow-md ${i === 3 ? 'bg-primary/40 shadow-[0_0_15px_rgba(139,92,246,0.4)]' : ''}`} />
                  <Skeleton className="h-3 w-8 mx-auto rounded" />
                </div>
              ))}
            </div>
            
            {/* Time rows - responsive */}
            <div className="overflow-hidden">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="grid grid-cols-4 md:grid-cols-8 border-b border-border" style={{ height: '60px' }}>
                  {/* Time label - hidden on mobile */}
                  <div className="hidden md:block p-2 border-r border-border bg-muted/10">
                    <Skeleton className="h-3 w-12 rounded" />
                  </div>
                  {/* Mobile columns */}
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={`mobile-col-${j}`} className="md:hidden border-r border-border last:border-r-0 p-1">
                      {i === 0 && j === 1 && (
                        <Skeleton className="h-12 w-full rounded-lg bg-pink-500/30 shadow-md" />
                      )}
                      {i === 2 && j === 0 && (
                        <Skeleton className="h-10 w-full rounded-lg bg-blue-500/30 shadow-md" />
                      )}
                    </div>
                  ))}
                  {/* Desktop columns */}
                  {Array.from({ length: 7 }).map((_, j) => (
                    <div key={`desktop-col-${j}`} className="hidden md:block border-r border-border last:border-r-0 p-1">
                      {i === 0 && (
                        <Skeleton className="h-14 w-full rounded-lg bg-pink-500/30 shadow-md" />
                      )}
                      {i === 2 && j === 2 && (
                        <Skeleton className="h-10 w-full rounded-lg bg-blue-500/30 shadow-md" />
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
