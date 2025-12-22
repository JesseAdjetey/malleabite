# 📱 Mobile-First Implementation Guide
**App:** Malleabite  
**Last Updated:** December 20, 2025  
**Philosophy:** Mobile-first, progressively enhanced for desktop

---

## 🎯 MOBILE STRATEGY

### Current Mobile Status: 70% Complete ⚠️

**What Works:**
- ✅ Responsive breakpoints (Tailwind)
- ✅ Touch-friendly tap targets
- ✅ Mobile navigation bar
- ✅ Bottom sheet for Mally AI
- ✅ Mobile detection hook
- ✅ Safe area insets (iOS notches)
- ✅ Touch-optimized components

**What Needs Work:**
- ⚠️ Month view cramped on small screens
- ⚠️ Event creation form not optimized for mobile
- ⚠️ Some modals too large for mobile
- ⚠️ Sidebar experience could be better
- ❌ No pull-to-refresh
- ❌ No swipe gestures
- ❌ No haptic feedback
- ❌ Limited PWA features
- ❌ No offline mode

---

## 📊 MOBILE USAGE EXPECTATIONS

### Target Breakdown
- **Mobile:** 60-70% of users (smartphones)
- **Tablet:** 15-20% of users
- **Desktop:** 15-20% of users

### Critical Mobile Screens
1. **Calendar View** (most used)
   - Month view: Daily planning
   - Day view: Hourly scheduling
   - Week view: Weekly overview

2. **Event Creation** (most frequent action)
   - Quick add
   - Full form
   - Voice input (Mally AI)

3. **Todo Management** (daily use)
   - Quick add
   - Complete/uncomplete
   - Organize

4. **Mally AI** (key differentiator)
   - Bottom sheet interface
   - Voice wake word
   - Natural language

---

## 🎨 MOBILE DESIGN PRINCIPLES

### 1. Touch Targets (WCAG 2.1)
**Minimum:** 44x44 px (iOS) / 48x48 px (Android)

**Current Implementation:**
```tsx
// ✅ GOOD - In most buttons
<button className="min-h-[44px] min-w-[44px] p-3">

// ❌ BAD - Found in some small icons
<button className="p-1">  // Too small!
```

**Files to Audit:**
- `src/components/calendar/*` - Check all clickable elements
- `src/components/modules/*` - Verify button sizes
- `src/components/ui/*` - Base components

### 2. Thumb Zone Optimization
**Hot Zone:** Bottom 1/3 of screen (easy reach)
**Safe Zone:** Middle 1/3 (moderate reach)
**Dead Zone:** Top 1/3 (hard reach)

**Current Implementation:**
✅ Mobile nav bar at bottom (Hot Zone)
✅ Mally AI FAB in bottom right (Hot Zone)
⚠️ Header actions at top (Dead Zone) - should be reconsidered

**Recommendations:**
- Keep primary actions in bottom 50%
- Move settings to bottom nav or menu
- Consider bottom action sheet for event creation

### 3. One-Handed Use
**Design for one-handed operation on phones 6-7" tall**

**Current Issues:**
- Header items too high
- Some modals require two hands to interact
- Sidebar requires reach to top

**Fixes Needed:**
```tsx
// Add bottom action menu for common tasks
<BottomActionMenu>
  <MenuItem>New Event</MenuItem>
  <MenuItem>New Todo</MenuItem>
  <MenuItem>Ask Mally</MenuItem>
</BottomActionMenu>
```

### 4. Visual Hierarchy
**Mobile screen is small - every pixel counts**

**Current Issues:**
- Month view cells too small on phones < 5.5"
- Event text truncates aggressively
- Some padding too generous on mobile

**Optimizations Needed:**
```css
/* Reduce padding on mobile */
@media (max-width: 768px) {
  .event-card {
    padding: 0.5rem; /* was 1rem */
  }
  
  .calendar-cell {
    min-height: 60px; /* was 80px */
  }
}
```

---

## 🛠️ CRITICAL MOBILE IMPROVEMENTS

### Priority 1: Calendar Views (Week 6)

#### Month View Mobile Optimization
**File:** `src/components/month-view.tsx`

**Issues:**
1. Cells too small on small screens
2. Event names truncate too much
3. Hard to tap specific events
4. Date numbers too small

**Fixes:**
```tsx
// Add mobile-specific calendar grid
<div className={cn(
  "grid grid-cols-7 gap-1",
  "md:gap-2", // Larger gap on desktop
  isMobile && "gap-0.5" // Tighter on mobile
)}>
  
// Larger date numbers on mobile
<span className={cn(
  "text-sm font-semibold",
  "md:text-base",
  isMobile && "text-base" // Bigger on mobile
)}>
  
// Better event display on mobile
{events.slice(0, isMobile ? 2 : 4).map(event => (
  <div className="text-xs truncate min-h-[24px] flex items-center">
    {event.title}
  </div>
))}

// Add "X more" indicator
{events.length > (isMobile ? 2 : 4) && (
  <button 
    onClick={() => showDayEvents(date)}
    className="text-xs text-primary"
  >
    +{events.length - (isMobile ? 2 : 4)} more
  </button>
)}
```

#### Day View Mobile Optimization
**File:** `src/components/day-view/DayView.tsx`

**Current:** ✅ Already pretty good
**Enhancements:**
- Add swipe to navigate to next/prev day
- Optimize time slot height for mobile
- Make "now" indicator more visible

```tsx
// Add swipe handlers
const swipeHandlers = useSwipeable({
  onSwipedLeft: () => goToNextDay(),
  onSwipedRight: () => goToPreviousDay(),
  trackMouse: false
});

<div {...swipeHandlers}>
  {/* Day view content */}
</div>
```

#### Week View Mobile
**Current Status:** ⚠️ Cramped on mobile

**Options:**
1. Horizontal scroll for days (keep all 7 visible)
2. Show only 3-4 days, swipe for more
3. Switch to vertical list on mobile

**Recommendation:** Horizontal scroll
```tsx
<div className={cn(
  "grid grid-cols-7 gap-2",
  isMobile && "flex overflow-x-auto snap-x snap-mandatory"
)}>
  {days.map(day => (
    <div className={cn(
      "min-w-full md:min-w-0",
      isMobile && "snap-center"
    )}>
      {/* Day content */}
    </div>
  ))}
</div>
```

### Priority 2: Event Creation Flow (Week 6)

#### Current Issues
**File:** `src/components/calendar/EventDetailsModal.tsx`
- Form too long for mobile screens
- Keyboard covers inputs
- Date/time pickers awkward
- Too many fields visible at once

#### Mobile-Optimized Form
**Create:** `src/components/calendar/MobileEventForm.tsx`

```tsx
// Multi-step form for mobile
const MobileEventForm = () => {
  const [step, setStep] = useState(1); // 1: Basic, 2: Details, 3: Advanced
  
  return (
    <BottomSheet>
      {step === 1 && <BasicInfo />}  {/* Title, date, time */}
      {step === 2 && <Details />}     {/* Description, color */}
      {step === 3 && <Advanced />}    {/* Recurring, alarms */}
      
      <StepIndicator current={step} total={3} />
      <NavigationButtons />
    </BottomSheet>
  );
};
```

**Features:**
- Swipe between steps
- Auto-scroll to active input
- Smart keyboard handling
- Quick presets (30min, 1hr, All day)

#### Quick Add Button
**Create:** `src/components/calendar/QuickAddButton.tsx`

```tsx
// Floating action button for quick event
<FAB 
  position="bottom-right"
  onClick={() => setShowQuickAdd(true)}
>
  <Plus />
</FAB>

// Quick add sheet
<BottomSheet>
  <Input 
    placeholder="What do you need to do?"
    autoFocus
  />
  <QuickOptions>
    <Option>Today, 2 PM</Option>
    <Option>Tomorrow, 10 AM</Option>
    <Option>This weekend</Option>
  </QuickOptions>
</BottomSheet>
```

### Priority 3: Sidebar/Module Experience (Week 7)

#### Current Issues
- Sidebar takes full screen on mobile
- Hard to access while viewing calendar
- Module switching cumbersome

#### Recommendations

**Option A: Bottom Drawer**
```tsx
<MobileModuleDrawer>
  <Tabs>
    <Tab>Todos</Tab>
    <Tab>Pomodoro</Tab>
    <Tab>Alarms</Tab>
  </Tabs>
  <DrawerContent>
    {activeModule}
  </DrawerContent>
</MobileModuleDrawer>
```

**Option B: Floating Widgets**
```tsx
// Draggable, minimizable module cards
<FloatingModule
  title="Todos"
  minimized={minimized}
  position={{ x: 20, y: 100 }}
>
  <TodoList />
</FloatingModule>
```

**Recommendation:** Hybrid approach
- Bottom tabs for quick access
- Tap to expand to full screen
- Swipe down to minimize

### Priority 4: Gestures & Interactions (Week 7)

#### Swipe Gestures
**File to Create:** `src/hooks/use-swipe-gestures.ts`

```typescript
export function useSwipeGestures() {
  const onSwipeLeft = () => {}; // Navigate forward
  const onSwipeRight = () => {}; // Navigate back
  const onSwipeUp = () => {}; // Show more details
  const onSwipeDown = () => {}; // Dismiss/minimize
}
```

**Implementations:**
1. **Calendar Navigation**
   - Swipe left/right: Next/prev day/week/month
   - Swipe up on event: Open details
   - Swipe down on modal: Dismiss

2. **Todo Management**
   - Swipe right on todo: Mark complete
   - Swipe left on todo: Delete
   - Long press: Reorder

3. **Event Management**
   - Swipe on event: Quick edit
   - Long press: Drag to reschedule

#### Pull to Refresh
**File to Create:** `src/components/mobile/PullToRefresh.tsx`

```tsx
export function PullToRefresh({ onRefresh, children }) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Implement pull gesture
  // Show loading indicator
  // Call onRefresh
  // Update data
  
  return (
    <div className="pull-to-refresh-container">
      {refreshing && <LoadingSpinner />}
      {children}
    </div>
  );
}
```

**Add to:**
- Calendar views
- Todo lists
- Analytics page

#### Haptic Feedback
**File to Create:** `src/lib/haptics.ts`

```typescript
export const haptics = {
  light: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  },
  medium: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(20);
    }
  },
  heavy: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([30, 10, 30]);
    }
  },
  success: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([10, 50, 10]);
    }
  },
  error: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 30, 50, 30, 50]);
    }
  }
};
```

**Use Cases:**
- Event created: `haptics.success()`
- Event deleted: `haptics.medium()`
- Limit reached: `haptics.error()`
- Button tap: `haptics.light()`
- Drag start: `haptics.medium()`

---

## 🎨 PWA ENHANCEMENTS (Week 7-8)

### Current PWA Status
**File:** `public/manifest.json` ✅ EXISTS
**Service Worker:** ❌ NOT IMPLEMENTED

### Phase 1: Enhanced Manifest
**File:** `public/manifest.json`

```json
{
  "name": "Malleabite - AI Productivity Platform",
  "short_name": "Malleabite",
  "description": "Master your time with AI-powered scheduling",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#8b5cf6",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/mobile-calendar.png",
      "sizes": "540x720",
      "type": "image/png",
      "form_factor": "narrow"
    },
    {
      "src": "/screenshots/mobile-mally.png",
      "sizes": "540x720",
      "type": "image/png",
      "form_factor": "narrow"
    },
    {
      "src": "/screenshots/desktop-calendar.png",
      "sizes": "1280x720",
      "type": "image/png",
      "form_factor": "wide"
    }
  ],
  "categories": ["productivity", "utilities", "lifestyle"],
  "shortcuts": [
    {
      "name": "New Event",
      "short_name": "New Event",
      "description": "Create a new calendar event",
      "url": "/?action=new-event",
      "icons": [{ "src": "/icons/event.png", "sizes": "96x96" }]
    },
    {
      "name": "Open Mally AI",
      "short_name": "Mally",
      "description": "Talk to your AI assistant",
      "url": "/?action=open-mally",
      "icons": [{ "src": "/icons/mally.png", "sizes": "96x96" }]
    },
    {
      "name": "View Today",
      "short_name": "Today",
      "description": "View today's schedule",
      "url": "/?action=view-today",
      "icons": [{ "src": "/icons/today.png", "sizes": "96x96" }]
    }
  ]
}
```

### Phase 2: Service Worker
**File to Create:** `public/sw.js`

```javascript
const CACHE_NAME = 'malleabite-v1';
const STATIC_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  // Add critical CSS/JS after build
];

// Install service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_CACHE);
    })
  );
});

// Fetch with network-first strategy for API
// Cache-first for static assets
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/') || 
      event.request.url.includes('firebaseio.com')) {
    // Network first for API calls
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(event.request))
    );
  } else {
    // Cache first for static assets
    event.respondWith(
      caches.match(event.request)
        .then(response => response || fetch(event.request))
    );
  }
});
```

**Register in:** `src/main.tsx`
```typescript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(reg => console.log('SW registered', reg))
    .catch(err => console.log('SW registration failed', err));
}
```

### Phase 3: Install Prompt
**File to Create:** `src/components/mobile/InstallPrompt.tsx`

```tsx
export function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  
  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    });
  }, []);
  
  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      haptics.success();
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };
  
  if (!showPrompt) return null;
  
  return (
    <div className="fixed bottom-20 left-4 right-4 p-4 bg-primary rounded-lg shadow-xl">
      <h3 className="font-semibold mb-2">Install Malleabite</h3>
      <p className="text-sm mb-4">
        Add to your home screen for quick access and offline use
      </p>
      <div className="flex gap-2">
        <button onClick={handleInstall} className="flex-1 btn-primary">
          Install
        </button>
        <button onClick={() => setShowPrompt(false)} className="btn-ghost">
          Not now
        </button>
      </div>
    </div>
  );
}
```

### Phase 4: Offline Mode
**Integrate:** `src/hooks/use-offline-mode.ts` (already exists!)

**Add UI Indicator:**
```tsx
// In Header component
const { isOffline } = useOfflineMode();

{isOffline && (
  <div className="bg-yellow-500 text-black px-3 py-1 rounded-full text-xs">
    Offline - Changes will sync when online
  </div>
)}
```

**Queue Management:**
```typescript
// Store pending actions while offline
interface OfflineAction {
  type: 'create' | 'update' | 'delete';
  collection: string;
  data: any;
  timestamp: number;
}

// Sync when coming back online
window.addEventListener('online', async () => {
  const queue = await getOfflineQueue();
  for (const action of queue) {
    await syncAction(action);
  }
  clearOfflineQueue();
});
```

---

## 📊 MOBILE PERFORMANCE OPTIMIZATION

### Current Performance
**Lighthouse Mobile Score:** Not measured yet

**Targets:**
- Performance: 90+
- Accessibility: 100
- Best Practices: 95+
- SEO: 100
- PWA: 100

### Optimizations

#### 1. Image Optimization
```typescript
// Use WebP with fallback
<picture>
  <source srcSet="image.webp" type="image/webp" />
  <source srcSet="image.png" type="image/png" />
  <img src="image.png" alt="..." loading="lazy" />
</picture>

// Responsive images
<img 
  srcSet="
    image-320w.jpg 320w,
    image-640w.jpg 640w,
    image-1280w.jpg 1280w
  "
  sizes="(max-width: 640px) 100vw, 50vw"
  src="image-640w.jpg"
  alt="..."
/>
```

#### 2. Code Splitting
**Already implemented** via lazy loading in `App.tsx` ✅

**Add route-based splitting:**
```tsx
// Split analytics charts
const AnalyticsCharts = lazy(() => import('./components/analytics/Charts'));

// Split heavy modules
const EisenhowerMatrix = lazy(() => import('./components/modules/Eisenhower'));
```

#### 3. Virtual Scrolling
**For long lists** (>100 items)

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

function EventList({ events }) {
  const parentRef = useRef();
  
  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
  });
  
  return (
    <div ref={parentRef} className="h-[400px] overflow-auto">
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map(item => (
          <div 
            key={item.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${item.size}px`,
              transform: `translateY(${item.start}px)`,
            }}
          >
            <EventCard event={events[item.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### 4. Reduce Bundle Size
```bash
# Analyze bundle
npm run build
npx vite-bundle-visualizer

# Remove unused dependencies
npm prune

# Use dynamic imports for large libraries
const dayjs = () => import('dayjs');
```

#### 5. Optimize Firebase
```typescript
// Enable persistence
enableIndexedDbPersistence(db);

// Use query limits
const q = query(
  collection(db, 'events'),
  where('userId', '==', userId),
  orderBy('startsAt', 'desc'),
  limit(50) // Don't load everything!
);

// Pagination
const nextPage = query(
  collection(db, 'events'),
  startAfter(lastDoc),
  limit(20)
);
```

---

## 📱 MOBILE TESTING MATRIX

### Devices to Test
**iOS:**
- iPhone SE (small screen: 4.7")
- iPhone 13/14 (standard: 6.1")
- iPhone 14 Pro Max (large: 6.7")
- iPad Mini (tablet: 8.3")
- iPad Pro (large tablet: 12.9")

**Android:**
- Samsung Galaxy S22 (standard: 6.1")
- Google Pixel 6 (standard: 6.4")
- Samsung Galaxy S22 Ultra (large: 6.8")
- Samsung Galaxy Tab (tablet)
- Various budget Android (5.5-6.5")

### Testing Checklist
- [ ] Touch targets minimum 44x44px
- [ ] All features accessible with one hand
- [ ] Text readable without zoom
- [ ] Forms work with mobile keyboards
- [ ] Gestures feel natural
- [ ] Haptic feedback works
- [ ] PWA installs successfully
- [ ] Offline mode works
- [ ] Performance: < 3s load time
- [ ] No horizontal scroll
- [ ] Safe area insets respected
- [ ] Landscape mode works
- [ ] Pull-to-refresh works
- [ ] Bottom sheets function correctly
- [ ] No click delays (300ms tap delay removed)

---

## 🎯 MOBILE-FIRST DEVELOPMENT WORKFLOW

### Build Process
1. **Design mobile first**
   - Sketch on 375px width (iPhone)
   - Add tablet styles (768px+)
   - Enhance for desktop (1024px+)

2. **Test mobile first**
   - Use Chrome DevTools mobile emulation
   - Test on real devices weekly
   - Use BrowserStack for broad coverage

3. **Optimize mobile first**
   - Bundle size critical on mobile
   - Performance critical on mobile
   - Touch interactions critical on mobile

### CSS Approach
```css
/* Mobile first (default) */
.component {
  padding: 0.5rem;
  font-size: 0.875rem;
}

/* Tablet */
@media (min-width: 768px) {
  .component {
    padding: 1rem;
    font-size: 1rem;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .component {
    padding: 1.5rem;
    font-size: 1.125rem;
  }
}
```

### Component Pattern
```tsx
export function ResponsiveComponent() {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet(); // Create this hook
  
  if (isMobile) {
    return <MobileView />;
  }
  
  if (isTablet) {
    return <TabletView />;
  }
  
  return <DesktopView />;
}
```

---

**Last Updated:** December 20, 2025  
**Next Review:** After Week 7 Implementation  
**Target:** 95% mobile-optimized by Week 8
