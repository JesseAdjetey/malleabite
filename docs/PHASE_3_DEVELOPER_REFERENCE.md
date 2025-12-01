# 🎯 Phase 3 - Developer Quick Reference

**Quick guide to the final 5% features for developers**

---

## 📦 New Components

### 1. AutoScheduleButton
**Path:** `src/components/calendar/AutoScheduleButton.tsx`  
**Lines:** 248  
**Purpose:** AI-powered time slot finder with one-click scheduling

**Props:**
```typescript
interface AutoScheduleButtonProps {
  task: {
    title: string;
    duration: number;
    priority?: 'high' | 'medium' | 'low';
    type?: 'meeting' | 'focus' | 'break' | 'routine';
    deadline?: Date;
    preferredTimeOfDay?: 'morning' | 'afternoon' | 'evening';
  };
  onSchedule?: (startTime: string, endTime: string, date: string) => void;
}
```

**Usage:**
```tsx
import { AutoScheduleButton } from '@/components/calendar/AutoScheduleButton';

<AutoScheduleButton
  task={{
    title: "Team Meeting",
    duration: 60,
    priority: 'high',
    type: 'meeting',
  }}
  onSchedule={(start, end, date) => {
    // Handle scheduling
    console.log(`Schedule from ${start} to ${end} on ${date}`);
  }}
/>
```

**Dependencies:**
- `optimizeSchedule` from `@/lib/algorithms/schedule-optimizer`
- `useCalendarEvents` hook
- `Dialog`, `Card`, `Badge`, `Button` from UI components

**Key Features:**
- Score-based recommendations (0-100)
- Alternative slots (up to 3)
- Detailed reasoning for each slot
- Loading states
- Empty states
- Toast notifications

---

### 2. LearningInsights
**Path:** `src/components/ai/LearningInsights.tsx`  
**Lines:** 349  
**Purpose:** AI pattern detection and personalized recommendations

**Props:**
```typescript
// No props - self-contained component
```

**Usage:**
```tsx
import { LearningInsights } from '@/components/ai/LearningInsights';

<LearningInsights />
```

**Dependencies:**
- `useCalendarEvents` hook
- `dayjs` with `isBetween` plugin
- `Card`, `Badge` from UI components

**Detected Patterns:**
1. **Preferred Time** - Most common scheduling hour
2. **Morning/Evening Person** - Peak productivity detection
3. **Task Duration** - Quick tasks vs deep work
4. **Busiest Day** - Weekly workload distribution
5. **Break Pattern** - Buffer time consciousness
6. **Completion Rate** - Achievement tracking

**Pattern Interface:**
```typescript
interface Pattern {
  type: string;
  description: string;
  confidence: number; // 0-100
  icon: any; // Lucide icon
  color: string; // Tailwind color
  suggestion?: string;
}
```

---

### 3. ProductivityScore
**Path:** `src/components/insights/ProductivityScore.tsx`  
**Lines:** 281  
**Purpose:** Comprehensive productivity scoring with breakdown

**Props:**
```typescript
// No props - self-contained component
```

**Usage:**
```tsx
import { ProductivityScore } from '@/components/insights/ProductivityScore';

<ProductivityScore />
```

**Dependencies:**
- `useAnalyticsStore` hook
- `useCalendarEvents` hook
- `calculateMetrics` from `@/lib/utils/analytics-calculator`
- `Card`, `Badge` from UI components

**Score Factors:**
```typescript
interface ScoreFactor {
  name: string;
  value: number; // Calculated points
  max: number; // Maximum possible
  description: string;
  icon: any; // Lucide icon
  color: string; // Tailwind color
}

// 5 Factors:
// 1. Task Completion (30 points)
// 2. Focus Time (25 points)
// 3. Optimal Duration (20 points)
// 4. Pomodoro Sessions (15 points)
// 5. Total Productive Time (10 points)
```

**Score Calculation:**
```typescript
// Uses calculateProductivityScore from analytics-calculator.ts
const score = calculateProductivityScore({
  completionRate: number,
  focusTime: number,
  meetingTime: number,
  totalTime: number,
  averageEventDuration: number,
  pomodoroSessions: number,
});
// Returns: 0-100
```

---

## 🔧 Integration Points

### Analytics.tsx
**Modified:** Added 2 new tabs

```tsx
import { LearningInsights } from '@/components/ai/LearningInsights';
import { ProductivityScore } from '@/components/insights/ProductivityScore';

<TabsList>
  <TabsTrigger value="overview">Overview</TabsTrigger>
  <TabsTrigger value="productivity">Productivity Score</TabsTrigger>
  <TabsTrigger value="insights">AI Insights</TabsTrigger>
  <TabsTrigger value="weekly">Weekly</TabsTrigger>
  <TabsTrigger value="monthly">Monthly</TabsTrigger>
</TabsList>

<TabsContent value="productivity">
  <ProductivityScore />
</TabsContent>

<TabsContent value="insights">
  <LearningInsights />
</TabsContent>
```

### QuickSchedule.tsx
**Modified:** Added AutoScheduleButton to event cards

```tsx
import { AutoScheduleButton } from '@/components/calendar/AutoScheduleButton';

// Inside event card
<AutoScheduleButton
  task={{
    title: event.title,
    duration: event.duration,
    priority: 'medium',
    type: event.category === 'work' ? 'focus' : 'routine',
  }}
  onSchedule={(startTime, endTime, date) => {
    updateEventTime(event.id, new Date(startTime));
    toast.success('Auto-scheduled!');
  }}
/>
```

---

## 🧮 Algorithms Used

### 1. Schedule Optimizer
**File:** `src/lib/algorithms/schedule-optimizer.ts`  
**Function:** `optimizeSchedule(tasks, events, preferences)`

**How it works:**
1. Finds free time blocks in calendar
2. Scores each slot (0-100) based on:
   - Task priority
   - Time of day quality
   - Duration fit
   - Deadline urgency
   - User preferences
3. Sorts by score
4. Returns best + alternatives

**Usage in AutoScheduleButton:**
```typescript
const result = optimizeSchedule(
  [taskToSchedule],
  events,
  { /* preferences */ }
);

const suggestion = result.suggestions[0];
// suggestion.suggestedSlot.start
// suggestion.suggestedSlot.score
// suggestion.suggestedSlot.reasoning
// suggestion.alternativeSlots
```

### 2. Analytics Calculator
**File:** `src/lib/utils/analytics-calculator.ts`  
**Function:** `calculateMetrics(events)`

**Returns:**
```typescript
{
  totalEvents: number,
  completedEvents: number,
  totalTime: number,
  eventsByCategory: Record<string, number>,
  completionRate: number,
  averageEventDuration: number,
  pomodoroSessions: number,
  focusTime: number,
  meetingTime: number,
  productivityScore: number,
}
```

**Used by:** ProductivityScore component

### 3. Pattern Detection
**Location:** Inside LearningInsights component  
**Method:** Statistical analysis with useMemo

**Patterns Detected:**
- Hour frequency analysis → Preferred Time
- Morning vs evening ratio → Peak productivity
- Average duration → Task type preference
- Day-of-week distribution → Busiest day
- Gap analysis → Break consciousness
- Completion tracking → Achievement rate

---

## 🎨 Styling Guide

### Color Scheme
```typescript
// Component-specific colors
const COLORS = {
  work: '#3b82f6',      // blue-500
  personal: '#8b5cf6',  // purple-500
  health: '#10b981',    // green-500
  learning: '#f59e0b',  // amber-500
  social: '#ec4899',    // pink-500
  entertainment: '#6366f1', // indigo-500
  other: '#6b7280',     // gray-500
};
```

### Theme Classes
- **Primary:** `bg-purple-500` / `text-purple-600`
- **Cards:** `border-2 border-purple-500 bg-purple-50 dark:bg-purple-950/20`
- **Badges:** `bg-purple-500` / `variant="secondary"`
- **Gradients:** `from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20`

---

## 📊 Data Flow

### AutoScheduleButton Flow
```
User clicks button
  ↓
Component calls optimizeSchedule()
  ↓
Algorithm finds free time blocks
  ↓
Scores each block (0-100)
  ↓
Returns best + alternatives
  ↓
Dialog displays results
  ↓
User selects time
  ↓
onSchedule callback fires
  ↓
Parent updates event
```

### LearningInsights Flow
```
Component mounts
  ↓
useCalendarEvents() loads events
  ↓
useMemo calculates patterns
  ↓
Statistical analysis runs
  ↓
Patterns detected
  ↓
Confidence calculated
  ↓
UI renders pattern cards
```

### ProductivityScore Flow
```
Component mounts
  ↓
useAnalyticsStore() loads metrics
  ↓
useCalendarEvents() loads events
  ↓
calculateMetrics() runs
  ↓
calculateProductivityScore() calculates
  ↓
useMemo breaks down factors
  ↓
UI renders score + breakdown
```

---

## 🐛 Common Issues & Solutions

### Issue: AutoSchedule returns no slots
**Cause:** No free time blocks found  
**Solution:** Check calendar has gaps, adjust preferences

### Issue: LearningInsights shows empty state with events
**Cause:** Not enough events (< 5)  
**Solution:** Add more test events or adjust threshold

### Issue: ProductivityScore shows 0
**Cause:** Missing metrics data  
**Solution:** Ensure events have duration and category

### Issue: TypeScript errors with imports
**Cause:** Wrong import path  
**Solution:** Use `@/` alias for absolute imports

### Issue: Dark mode colors broken
**Cause:** Missing `dark:` prefix  
**Solution:** Add `dark:bg-*` and `dark:text-*` classes

---

## 🧪 Testing Tips

### Unit Testing
```typescript
// Mock useCalendarEvents
jest.mock('@/hooks/use-calendar-events', () => ({
  useCalendarEvents: () => ({
    events: mockEvents,
    loading: false,
  }),
}));

// Test AutoScheduleButton
test('opens dialog on click', () => {
  render(<AutoScheduleButton task={mockTask} />);
  fireEvent.click(screen.getByText('Auto-Schedule'));
  expect(screen.getByText('AI-Powered Scheduling')).toBeInTheDocument();
});
```

### Integration Testing
```typescript
// Test full flow in Analytics
test('displays productivity score tab', async () => {
  render(<Analytics />);
  fireEvent.click(screen.getByText('Productivity Score'));
  await waitFor(() => {
    expect(screen.getByText('out of 100')).toBeInTheDocument();
  });
});
```

---

## 📦 Dependencies

### New Dependencies
None! All features use existing dependencies:
- `lucide-react` (icons)
- `dayjs` (dates)
- `sonner` (toasts)
- `@/components/ui/*` (shadcn/ui)

### Existing Hooks Used
- `useCalendarEvents` - Event data
- `useAnalyticsStore` - Analytics metrics
- `useNavigate` - Navigation

---

## 🚀 Performance Optimization

### Memoization
```typescript
// LearningInsights
const patterns = useMemo(() => {
  // Heavy computation
}, [events]);

// ProductivityScore
const factors = useMemo(() => {
  // Score breakdown
}, [currentMetrics]);
```

### Lazy Loading
```typescript
// Only calculate when dialog opens
const suggestion = open ? getSuggestions() : null;
```

### Efficient Rendering
- Use `useMemo` for expensive calculations
- Minimize re-renders with proper dependency arrays
- Conditional rendering for heavy components

---

## 📝 Code Style

### Component Structure
```typescript
// 1. Imports
import { useState } from 'react';
import { Component } from '@/components/ui/component';

// 2. Types/Interfaces
interface Props { ... }

// 3. Component
export function Component({ prop }: Props) {
  // 3a. Hooks
  const [state, setState] = useState();
  
  // 3b. Memoized values
  const computed = useMemo(() => ..., [deps]);
  
  // 3c. Event handlers
  const handleClick = () => { ... };
  
  // 3d. Render
  return <div>...</div>;
}

// 4. Helper functions
function helper() { ... }
```

### Naming Conventions
- Components: `PascalCase`
- Hooks: `useCamelCase`
- Functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Props: Descriptive, e.g., `onSchedule` not `onClick`

---

## ✅ Checklist for Adding New Features

- [ ] Create component in appropriate folder
- [ ] Add proper TypeScript types
- [ ] Use existing UI components
- [ ] Follow color scheme (purple/blue theme)
- [ ] Add dark mode support
- [ ] Make responsive (mobile-first)
- [ ] Use proper hooks (useMemo, useCallback)
- [ ] Add loading states
- [ ] Add empty states
- [ ] Test in both light and dark mode
- [ ] Check console for errors
- [ ] Update documentation

---

*Developer Reference created: October 24, 2025*  
*Version: 1.0.0*  
*Phase 3 Final 5% Complete*
