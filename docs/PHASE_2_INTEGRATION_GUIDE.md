# Phase 2 Final Integration Guide

## Overview
This guide covers the final 5% integration work needed to complete Phase 2. All components are built and tested individually - we just need to wire them together.

---

## 1. Bulk Mode Integration (30 minutes)

### Step 1.1: Add Bulk State to Calendar Views

**File:** `src/components/month-view.tsx`

```typescript
import { useBulkSelection } from '@/hooks/use-bulk-selection';
import BulkActionToolbar from '@/components/bulk-operations/BulkActionToolbar';
import SelectableCalendarEvent from '@/components/calendar/SelectableCalendarEvent';

// In MonthView component:
const {
  isBulkMode,
  selectedCount,
  isSelected,
  toggleSelection,
  selectAll,
  deselectAll,
  bulkDelete,
  bulkUpdateColor,
  bulkReschedule,
  bulkDuplicate,
} = useBulkSelection();

// Replace CalendarEvent with SelectableCalendarEvent in MonthViewBox
```

**File:** `src/components/week-view.tsx`

```typescript
// Same imports and setup as MonthView
// Pass bulk props to DayColumn component
```

**File:** `src/components/day-view.tsx`

```typescript
// Same imports and setup
// Pass bulk props to TimeSlotsGrid component
```

### Step 1.2: Update Header with Bulk Toggle

**File:** `src/components/header/Header.tsx`

```typescript
import BulkModeToggle from '@/components/calendar/BulkModeToggle';

// Add to header (near TemplatesNav):
<BulkModeToggle
  isBulkMode={isBulkMode}
  onToggle={() => isBulkMode ? disableBulkMode() : enableBulkMode()}
  selectedCount={selectedCount}
/>
```

### Step 1.3: Add Bulk Toolbar to Views

**In each view (month/week/day), add before closing tag:**

```typescript
{isBulkMode && (
  <BulkActionToolbar
    selectedCount={selectedCount}
    onSelectAll={selectAll}
    onDeselectAll={deselectAll}
    onBulkDelete={bulkDelete}
    onBulkEdit={() => {/* TODO: Open batch edit modal */}}
    onBulkReschedule={(days) => bulkReschedule(days)}
    onBulkChangeColor={bulkUpdateColor}
    onBulkDuplicate={bulkDuplicate}
  />
)}
```

---

## 2. Pattern Application (20 minutes)

### Step 2.1: Add Pattern Application Logic

**File:** `src/components/patterns/PatternManager.tsx`

Add this function:

```typescript
const applyPattern = async (pattern: RecurringPattern, startDate: Date, endDate: Date) => {
  const { addEvent } = useCalendarEvents();
  const events: CalendarEventType[] = [];
  
  let currentDate = dayjs(startDate);
  const end = dayjs(endDate);
  
  while (currentDate.isBefore(end) || currentDate.isSame(end, 'day')) {
    let shouldCreate = false;
    
    switch (pattern.type) {
      case 'daily':
        shouldCreate = !pattern.daysOfWeek || pattern.daysOfWeek.includes(currentDate.day());
        break;
      case 'weekly':
        shouldCreate = pattern.daysOfWeek?.includes(currentDate.day()) || false;
        break;
      case 'monthly':
        shouldCreate = currentDate.date() === pattern.dayOfMonth;
        break;
    }
    
    if (shouldCreate) {
      const event: CalendarEventType = {
        id: crypto.randomUUID(),
        title: pattern.name,
        description: pattern.description,
        date: currentDate.format('YYYY-MM-DD'),
        startsAt: currentDate.hour(9).toISOString(), // Default 9 AM
        endsAt: currentDate.hour(10).toISOString(), // Default 1 hour
        color: '#3b82f6',
      };
      events.push(event);
    }
    
    currentDate = currentDate.add(pattern.interval, pattern.type === 'daily' ? 'day' : pattern.type === 'weekly' ? 'week' : 'month');
  }
  
  // Batch create events
  await Promise.all(events.map(e => addEvent(e)));
  toast.success(`Created ${events.length} events from pattern`);
  
  // Update pattern stats
  const updatedPattern = { ...pattern, eventCount: pattern.eventCount + events.length, lastApplied: new Date().toISOString() };
  setPatterns(patterns.map(p => p.id === pattern.id ? updatedPattern : p));
};
```

### Step 2.2: Add Apply Button to Each Pattern

In the pattern card, add:

```typescript
<Button variant="default" size="sm" onClick={() => {
  // Open date range picker dialog
  const startDate = new Date();
  const endDate = dayjs().add(3, 'months').toDate();
  applyPattern(pattern, startDate, endDate);
}}>
  <Calendar className="h-4 w-4 mr-2" />
  Apply Pattern
</Button>
```

---

## 3. Connect Pattern Detection Stats (10 minutes)

**File:** `src/components/patterns/PatternManager.tsx`

Replace mock stats with:

```typescript
import { usePatternDetection } from '@/hooks/use-pattern-detection';

// In component:
const { patterns: detectedPatterns, stats } = usePatternDetection();

// Use real stats:
const patternStats = {
  totalPatterns: patterns.length + (stats?.totalPatterns || 0),
  weeklyPatterns: patterns.filter(p => p.type === 'weekly').length + (stats?.weeklyPatterns || 0),
  monthlyPatterns: patterns.filter(p => p.type === 'monthly').length + (stats?.monthlyPatterns || 0),
};
```

**File:** `src/hooks/use-pattern-detection.ts` (if not exists)

Create hook that wraps pattern-detection.ts:

```typescript
import { useCalendarEvents } from './use-calendar-events';
import { detectPatterns } from '@/lib/algorithms/pattern-detection';

export function usePatternDetection() {
  const { events } = useCalendarEvents();
  const patterns = React.useMemo(() => detectPatterns(events), [events]);
  
  return {
    patterns,
    stats: {
      totalPatterns: patterns.length,
      weeklyPatterns: patterns.filter(p => p.type === 'weekly').length,
      monthlyPatterns: patterns.filter(p => p.type === 'monthly').length,
    },
  };
}
```

---

## 4. MonthView Bulk Integration Example

**Full integration example for `src/components/month-view-box.tsx`:**

```typescript
import SelectableCalendarEvent from '@/components/calendar/SelectableCalendarEvent';

interface MonthViewBoxProps {
  day: dayjs.Dayjs | null;
  rowIndex: number;
  events?: CalendarEventType[];
  onEventClick?: (event: CalendarEventType) => void;
  onDayClick?: (day: dayjs.Dayjs) => void;
  onEventDrop?: (event: any, date: string) => void;
  addEvent?: (event: CalendarEventType) => void;
  openEventForm?: (todoData: any, day: dayjs.Dayjs) => void;
  
  // Bulk mode props
  isBulkMode?: boolean;
  isSelected?: (eventId: string) => boolean;
  onToggleSelection?: (eventId: string) => void;
}

// In render, replace CalendarEvent:
{visibleEvents.map(event => (
  <div key={event.id} className="mb-1 gradient-border calendar-event-wrapper">
    <SelectableCalendarEvent
      event={event}
      color={event.color}
      isLocked={event.isLocked}
      hasAlarm={event.hasAlarm}
      hasReminder={event.hasReminder}
      hasTodo={event.isTodo}
      participants={event.participants}
      onClick={() => onEventClick && onEventClick(event)}
      onLockToggle={(isLocked) => {/* handle lock */}}
      isBulkMode={isBulkMode}
      isSelected={isSelected?.(event.id)}
      onToggleSelection={onToggleSelection}
    />
  </div>
))}
```

---

## 5. Testing Checklist

After integration, test these scenarios:

### Bulk Operations
- [ ] Enable bulk mode from header
- [ ] Click events to select them (checkboxes appear)
- [ ] Selected events show purple ring highlight
- [ ] Select All button selects all visible events
- [ ] Clear button deselects all
- [ ] Bulk delete removes all selected events
- [ ] Bulk color change updates all selected
- [ ] Bulk reschedule moves events by N days
- [ ] Bulk duplicate creates copies
- [ ] Exit bulk mode clears selection

### Pattern Manager
- [ ] Create daily pattern (every N days)
- [ ] Create weekly pattern (select Mon/Wed/Fri)
- [ ] Create monthly pattern (15th of each month)
- [ ] Apply pattern creates recurring events
- [ ] Pattern stats show correct counts
- [ ] Edit pattern updates correctly
- [ ] Delete pattern removes from list

### Auto-categorization
- [ ] Type "team meeting" → suggests Work category
- [ ] Type "gym session" → suggests Health category
- [ ] Type "grocery shopping" → suggests Shopping category
- [ ] Click suggestion applies category and color
- [ ] Manual change triggers learning
- [ ] Future similar events use learned category

### Integration Points
- [ ] All features work together without conflicts
- [ ] Bulk operations respect locked events
- [ ] Pattern events can be bulk edited
- [ ] Auto-categorized events can be templated
- [ ] Templates work with quick schedule
- [ ] Smart suggestions incorporate all features

---

## 6. Quick Wins & Polish

### Add Keyboard Shortcuts
```typescript
// In bulk mode:
Ctrl/Cmd + A: Select all
Escape: Exit bulk mode
Delete: Bulk delete selected
```

### Add Loading States
```typescript
// Show spinner during bulk operations
const [isProcessing, setIsProcessing] = useState(false);

const handleBulkDelete = async () => {
  setIsProcessing(true);
  await bulkDelete();
  setIsProcessing(false);
};
```

### Add Undo Support
```typescript
// Store previous state before bulk operations
const [history, setHistory] = useState<CalendarEventType[][]>([]);

const handleBulkDelete = async () => {
  setHistory([...history, selectedEvents]);
  await bulkDelete();
  toast.success('Deleted', { action: { label: 'Undo', onClick: handleUndo } });
};
```

---

## 7. Performance Optimizations

### Memoize Expensive Computations
```typescript
const selectedEvents = useMemo(() => 
  events.filter(e => selectedIds.has(e.id)), 
  [events, selectedIds]
);
```

### Debounce Pattern Detection
```typescript
const debouncedDetectPatterns = useMemo(
  () => debounce(detectPatterns, 500),
  []
);
```

### Virtual Scrolling for Large Lists
```typescript
// Use react-window for pattern list if > 100 patterns
import { FixedSizeList } from 'react-window';
```

---

## 8. Documentation

### Update README.md
Add Phase 2 features section:

```markdown
### 🧠 Smart Features (Phase 2)

- **Templates:** Pre-built and custom event templates
- **Quick Schedule:** Batch event creation with smart suggestions
- **Smart Suggestions:** AI-detected patterns and recommendations
- **Auto-categorization:** Intelligent event categorization with learning
- **Bulk Operations:** Multi-select and batch edit events
- **Pattern Manager:** Create and manage recurring patterns
```

### Create User Guide
Add tooltips and help text:

```typescript
<Tooltip>
  <TooltipContent>
    <p>Bulk mode lets you select multiple events for batch operations</p>
  </TooltipContent>
</Tooltip>
```

---

## 9. Deployment Checklist

- [ ] All TypeScript errors resolved
- [ ] All features tested locally
- [ ] Firebase rules updated for new data structures
- [ ] Environment variables configured
- [ ] Build succeeds without warnings
- [ ] Bundle size checked (should be < 1MB)
- [ ] Lighthouse score > 90
- [ ] Mobile responsive on all views
- [ ] Cross-browser tested (Chrome, Firefox, Safari)
- [ ] User documentation complete

---

## Estimated Time Breakdown

| Task | Time | Priority |
|------|------|----------|
| Bulk mode integration | 30 min | High |
| Pattern application | 20 min | High |
| Pattern detection connection | 10 min | Medium |
| Testing all features | 60 min | High |
| Polish & keyboard shortcuts | 20 min | Low |
| Documentation | 20 min | Medium |
| **Total** | **2h 40min** | - |

---

## Ready to Deploy!

Once these integration steps are complete, Phase 2 will be 100% functional and ready for production use. The foundation is solid, and these final connections will bring everything together into a cohesive, intelligent calendar system.

🚀 **Let's complete Phase 2!**
