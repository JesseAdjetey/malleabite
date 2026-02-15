import * as React from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { haptics } from "@/lib/haptics"

interface GroupedListProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

const GroupedList = React.forwardRef<HTMLDivElement, GroupedListProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl bg-card overflow-hidden border border-border/50",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
)
GroupedList.displayName = "GroupedList"

interface GroupedListHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

const GroupedListHeader = React.forwardRef<HTMLDivElement, GroupedListHeaderProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "px-5 pt-6 pb-2 text-footnote uppercase tracking-wider text-muted-foreground font-medium",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
)
GroupedListHeader.displayName = "GroupedListHeader"

interface GroupedListItemProps extends React.HTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode
  iconBg?: string
  label: string
  sublabel?: string
  rightElement?: React.ReactNode
  showChevron?: boolean
  destructive?: boolean
  disabled?: boolean
}

const GroupedListItem = React.forwardRef<HTMLButtonElement, GroupedListItemProps>(
  ({ className, icon, iconBg, label, sublabel, rightElement, showChevron = true, destructive = false, disabled = false, onClick, ...props }, ref) => {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      haptics.light();
      onClick?.(e);
    };

    return (
      <button
        ref={ref}
        disabled={disabled}
        onClick={handleClick}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors active:bg-muted/60 disabled:opacity-50 disabled:pointer-events-none",
          "border-b border-separator/30 last:border-b-0",
          destructive && "text-destructive",
          className
        )}
        {...props}
      >
        {icon && (
          <div className={cn(
            "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
            iconBg || "bg-primary/15"
          )}>
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className={cn(
            "text-subheadline font-normal truncate",
            destructive && "text-destructive"
          )}>
            {label}
          </div>
          {sublabel && (
            <div className="text-caption1 text-muted-foreground truncate mt-0.5">
              {sublabel}
            </div>
          )}
        </div>
        {rightElement && (
          <div className="flex-shrink-0">
            {rightElement}
          </div>
        )}
        {showChevron && !rightElement && (
          <ChevronRight className="flex-shrink-0 h-4 w-4 text-muted-foreground/50" />
        )}
      </button>
    );
  }
)
GroupedListItem.displayName = "GroupedListItem"

interface GroupedListFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

const GroupedListFooter = React.forwardRef<HTMLDivElement, GroupedListFooterProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "px-5 pt-2 pb-1 text-footnote text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
)
GroupedListFooter.displayName = "GroupedListFooter"

export { GroupedList, GroupedListHeader, GroupedListItem, GroupedListFooter }
