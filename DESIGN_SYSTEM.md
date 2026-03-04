# Malleabite Design System & UI Reference

**Last Updated:** March 2, 2026  
**Purpose:** Complete reference for UI/UX design patterns, components, styling, and visual language

---

## 📋 Quick Overview

**Tech Stack:**
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS (styling)
- shadcn/ui (component library)
- Framer Motion (animations)
- Radix UI (accessible components)
- Lucide Icons (iconography)

**Platform Support:**
- Web (React + Vite)
- Mobile (iOS/Android via Capacitor)
- PWA (installable web app)
- Responsive design across all devices

---

## 🎨 Color System

### Primary Colors
**Light Mode (Default):**
```css
--primary: 261 54% 51%;              /* Purple - #8B5CF6 */
--primary-foreground: 0 0% 100%;     /* White */
--secondary: 262 83% 58%;            /* Lighter Purple */
--secondary-foreground: 0 0% 100%;   /* White */
--accent: 261 54% 95%;               /* Light Purple tint */
--accent-foreground: 261 54% 40%;    /* Dark Purple text */
```

**Dark Mode:**
```css
--primary: 261 54% 61%;              /* Purple (lighter for visibility) */
--primary-foreground: 210 40% 98%;   /* Off-white */
--secondary: 262 83% 58%;            /* Lighter Purple */
--secondary-foreground: 210 40% 98%; /* Off-white */
```

### Semantic Colors
- **Destructive:** HSL(0 72% 51%) - Red for delete/danger actions
- **Muted:** HSL(240 5% 96%) Light / Light foreground text
- **Border:** HSL(240 5% 84%) - Subtle divider lines
- **Input:** HSL(240 5% 90%) - Input field backgrounds

### Background Colors
**Light Mode:**
- **Background:** Pure white (#FFFFFF)
- **Card:** Pure white (#FFFFFF)
- **Grouped-bg:** Off-white (#F9F9F9) - slightly elevated feeling
- **Gradient Start:** #f8f7ff - Faint purple tint

**Dark Mode:**
- **Background:** HSL(240 21% 11%) - Very dark blue-gray
- **Card:** HSL(240 21% 14%) - Slightly lighter than bg
- **Foreground text:** HSL(213 31% 91%) - Light gray

### Event Colors (Calendar Events)
```css
--event-red: 354 76% 55%;
--event-green: 142 69% 45%;
--event-blue: 221 83% 55%;
--event-purple: 261 54% 55%;
--event-teal: 174 59% 45%;
--event-orange: 24 89% 55%;
--event-pink: 330 84% 65%;
```

---

## 📱 Typography System

### Font Sizes (iOS-Inspired)
All sizes use CSS variables from `base.css`:

| Style | Size | Weight | Line Height | Use Case |
|-------|------|--------|------------|----------|
| `text-large-title` | 2.125rem | 700 | 1.2 | Page titles, hero sections |
| `text-title1` | 1.75rem | 700 | 1.25 | Section headlines |
| `text-title2` | 1.375rem | 700 | 1.3 | Card titles |
| `text-title3` | 1.25rem | 600 | 1.35 | Subsection headers |
| `text-headline` | 1.0625rem | 600 | 1.4 | Bold body text, labels |
| `text-ios-body` | 1.0625rem | 400 | 1.5 | Main body text |
| `text-callout` | 1rem | 400 | 1.45 | Button text, annotations |
| `text-subheadline` | 0.9375rem | 400 | 1.4 | Secondary text |
| `text-footnote` | 0.8125rem | 400 | 1.35 | Captions, help text |
| `text-caption1` | 0.75rem | 400 | 1.3 | Small labels |
| `text-caption2` | 0.6875rem | 400 | 1.2 | Meta information |

### Font Stacks
- Default: System font stack (SF Pro Display, Segoe UI, etc.)
- iOS native feel with consistent letterforms

---

## 🎭 Component Library (shadcn/ui)

### Available UI Components

**Forms & Input:**
- `Button` - Primary actions, variants: default, secondary, ghost, outline
- `Input` - Text fields with glass effect styling
- `Textarea` - Multi-line text input
- `Select` - Dropdown selections
- `Checkbox` - Boolean selections
- `Radio Group` - Single choice from multiple
- `Switch` - Toggle on/off
- `Slider` - Range selection
- `Label` - Form field labels

**Layout & Organization:**
- `Card` - Main content container (rounded-2xl, border, shadow)
- `Sheet` - Slide-out drawer/sidebar
- `Dialog` - Modal windows
- `Drawer` - Bottom drawer (mobile-friendly)
- `Tabs` - Tab navigation
- `Accordion` - Expandable sections
- `Collapsible` - Hide/show content
- `Grouped-list` - iOS-style grouped lists

**Navigation:**
- `Navigation Menu` - Top navigation
- `Breadcrumb` - Hierarchical navigation
- `Context Menu` - Right-click menus
- `Dropdown Menu` - Action menus
- `Menubar` - Desktop menubars

**Display:**
- `Badge` - Labels and tags
- `Avatar` - User profile pictures
- `Tooltip` - Hover information
- `Alert` - Important messages
- `Alert Dialog` - Confirmation dialogs
- `Progress` - Loading/progress indicators
- `Table` - Data tables
- `Carousel` - Image/content carousel
- `Chart` - Data visualization (Recharts)

**Utilities:**
- `Skeleton` - Loading placeholders
- `Pagination` - Page navigation
- `Scroll Area` - Custom scrollbars
- `Separator` - Visual dividers
- `RippleBorder` - Custom ripple effect border
- `GridBackground` - Animated grid background

---

## 🎨 Glass Morphism Effects

**Glass Cards** (Light Mode):
```css
.glass-card {
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(139, 92, 246, 0.15);
  backdrop-filter: blur(10px);
  border-radius: 10px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.08);
}
```

**Glass Cards** (Dark Mode):
```css
.dark .glass-card {
  background: rgba(26, 22, 37, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.3);
}
```

**Glass Inputs:**
- Focus state: Purple border with subtle shadow
- Smooth 0.2s transitions
- Transparent backgrounds for layered effect

---

## 🎬 Animation System

### Animation Philosophy
**Intentional, Meaningful, Subtle & Tactile**

Your animations follow a **realistic physics-based approach** that feels natural and tactile:
- Animations enhance rather than distract
- Every motion has purpose and meaning
- Physics-inspired (springs, refraction, momentum)
- Subtle gradients and layering effects
- No gratuitous motion—every animation earns its place

### Spring Configs (from `src/lib/animations`)
```typescript
export const springs = {
  page: { type: 'spring', damping: 60, stiffness: 100 },
  gentle: { type: 'spring', damping: 80, stiffness: 100 },
  bouncy: { type: 'spring', damping: 60, stiffness: 200 },
}
```

### Common Animation Patterns

**Realistic Physics Animations:**
- **Page transitions:** Fade + slide (30px) with spring damping
- **Element reveals:** Smooth opacity/scale transitions (not jerky)
- **Ripple effects:** Custom border ripple animations (tactile feedback)
- **Hover states:** Subtle color/shadow changes with smooth easing
- **Loading states:** Spinning icons and skeleton loaders with momentum

### Advanced Animation Concepts

**Refraction Effect (Phase Field):**
When elements move between contexts (e.g., dragging from module to calendar):
```
Visual Effect:
- Element subtly changes color/opacity as it enters new "medium"
- Slight blur/focus shift at boundary transition
- Shadow depth increases as it enters calendar context
- Similar to object moving from air into water

Implementation:
- Use opacity transitions: 0.7 → 1.0
- Apply blur filter on entry: blur(2px) → blur(0px)
- Shadow depth shift: 0 8px 12px → 0 12px 20px
- Duration: 200-300ms for smooth, tactile feel
```

**Gradient Subtlety:**
- Subtle gradient overlays (max 5-10% opacity changes)
- Never jarring transitions between colors
- Gradients layer for depth: light → medium → slightly darker
- Used on cards, backgrounds, hover states
- Direction follows user's visual flow (top → bottom, left → right)

**Momentum & Weight:**
- Elements feel like they have physical mass
- Spring animations with natural damping (not too bouncy)
- Deceleration on drag-release (easing out)
- Slight overshoot on spring completion

### CSS Animations
- `accordion-down` - Accordion open animation
- Custom ripple effects in `ripple-effect.css`
- AI-specific animations in `ai-animations.css`
- Glassmorphism blur transitions (backdrop-filter animations)

### When NOT to Animate
- No animation for every micro-interaction (reserved for meaningful moments)
- No spinning/rotating for simple loading (use subtle pulse or shimmer)
- No transitions longer than 400ms (feels sluggish)
- No conflicting animations (e.g., fade + zoom simultaneously unless intentional)

---

## 📐 Spacing & Layout

### Spacing Scale
```css
--spacing-xs: 4px;   /* Minimal gaps */
--spacing-sm: 8px;   /* Small spacing */
--spacing-md: 16px;  /* Standard spacing */
--spacing-lg: 24px;  /* Large spacing */
--spacing-xl: 32px;  /* Extra large spacing */
```

### Border Radius
```css
--radius: 0.875rem;      /* Standard: 14px */
--radius-xl: 1.25rem;    /* Large: 20px */
/* Component-specific */
card: rounded-2xl (1.5rem)
input: rounded-2xl
button: rounded-lg (0.875rem)
```

### Safe Area Insets (Mobile)
```css
--safe-area-inset-top: env(safe-area-inset-top)
--safe-area-inset-bottom: env(safe-area-inset-bottom)
--safe-area-inset-left: env(safe-area-inset-left)
--safe-area-inset-right: env(safe-area-inset-right)
```

---

## 🏗️ Layout Structure

### Main App Layout
```
App (Router)
├── ThemeProvider (handles dark mode)
├── AuthProvider (user authentication)
├── EventDataProvider (calendar data)
├── Pages (lazy loaded)
│   ├── Calendar (main view)
│   ├── Settings
│   ├── Analytics
│   ├── Templates
│   ├── Patterns
│   ├── Quick Schedule
│   └── etc.
└── Global Components
    ├── Header (top navigation)
    ├── MobileNavigation (bottom nav on mobile)
    ├── BottomMallyAI (AI assistant)
    └── Toaster (notifications)
```

### Calendar Page Layout
```
Mainview
├── Header
│   ├── Navigation
│   └── View Selector (Day/Week/Month)
├── Flexbox Container
│   ├── Sidebar (resizable, 280px-500px)
│   │   ├── ModuleGrid
│   │   │   ├── Date Picker Module
│   │   │   ├── Quick Actions
│   │   │   ├── Today's Schedule
│   │   │   └── Custom Modules
│   │   └── Resize Handle (drag to resize)
│   └── Main Content
│       ├── MonthView / WeekView / DayView
│       └── Events Display
└── RippleBorder (visual effect)
```

### Card/Component Structure
```
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Subtitle</CardDescription>
  </CardHeader>
  <CardContent>
    {content}
  </CardContent>
  <CardFooter>
    {actions}
  </CardFooter>
</Card>
```

---

## 🎯 Design Principles

### 1. **Beautiful & Functional**
- Glassmorphism with subtle blur effects
- Clean, modern aesthetic without distraction
- Responsive across all devices
- Dark mode support for all contexts

### 2. **Fast & Responsive**
- Sub-second interactions
- Instant UI feedback (optimistic updates)
- Real-time animations (Framer Motion)
- No layout shifts

### 3. **iOS-Inspired Internal UI**
- iOS Dynamic Type scale for typography
- iOS color semantics (purple primary, gray accents)
- Grouped list styling (inset style)
- Safe area awareness for notches/home indicators
- Smooth spring animations

### 4. **Accessibility First**
- ARIA labels on all interactive elements
- Keyboard navigation support
- Semantic HTML structure
- High contrast in both light/dark modes
- Touch-friendly targets (48px+ on mobile)

---

## 🎪 Current Features & Components

### Calendar Module
- **Day View:** Hourly breakdown with events
- **Week View:** 7-day layout with grid
- **Month View:** Calendar grid with event indicators
- **Quick Schedule:** Fast event creation modal
- **Event Forms:** Enhanced creation/editing forms

### AI Integration (Mally)
- **BottomMallyAI:** Chat-like interface at bottom
- **Natural language:** "Schedule meeting tomorrow at 2pm"
- **Event parsing:** Automatic time/date extraction
- **AI animations:** Special CSS for bubble effects

### Templates & Patterns
- **Event Templates:** Save recurring event patterns
- **Pattern Detection:** Analyze your scheduling patterns
- **Smart Suggestions:** AI-driven event recommendations
- **Bulk Operations:** Multi-select and batch actions

### Analytics
- **Basic Dashboard:** Overview of events
- **Advanced Analytics:** Deep insights into time usage
- **Charts:** Recharts integration for visualizations
- **Pattern Stats:** Weekly/monthly recurrence analysis

### Settings & Customization
- **Theme Toggle:** Light/dark mode
- **Calendar Integration:** Google Calendar sync
- **Notification Settings:** Alarms and reminders
- **Profile Management:** User preferences

### Mobile-First Features
- **Bottom Navigation:** Mobile nav bar
- **Touch-optimized Forms:** Easy input on devices
- **Sheet Drawers:** Modal drawers instead of dialogs
- **Responsive Sidebar:** Collapses on mobile
- **Safe Area Insets:** Notch/home bar awareness

---

## 📦 Key Files & Structure

### Styles
```
src/styles/
├── base.css              # Tailwind imports, CSS variables
├── themes.css            # Color definitions, glass effects
├── components.css        # Component-specific styles
├── animations.css        # Global animations
├── ai-animations.css     # AI-specific animations
├── utilities.css         # Helper classes
└── ripple-effect.css     # Ripple border effect
```

### Components Organization
```
src/components/
├── ui/                   # shadcn/ui components
├── header/               # Header & navigation
├── sidebar/              # Sidebar components
├── calendar/             # Calendar views & events
├── ai/                   # AI/Mally components
├── analytics/            # Analytics & charts
├── patterns/             # Pattern manager
├── templates/            # Template components
├── settings/             # Settings pages
├── auth/                 # Auth components
├── subscription/         # Subscription UI
└── [other modules]
```

### Key Theme Files
```
src/components/ThemeProvider.tsx    # Global theme management
src/styles/themes.css               # CSS variable definitions
src/styles/base.css                 # Base CSS + variables
tailwind.config.ts                  # Extended Tailwind config
```

---

## 🎯 Modern UI Characteristics

### What Makes It "Modern Internal UI"

1. **Glassmorphism:** Translucent cards with blur backgrounds
2. **Purple Accent:** Using purple (#8B5CF6) as primary brand color
3. **iOS Aesthetic:** Typography scale, spacing, and interactions
4. **Dark Mode First:** Beautiful dark mode experience
5. **Micro-interactions:** Smooth transitions and feedback
6. **Grid Backgrounds:** Subtle animated backgrounds
7. **Ripple Effects:** Visual feedback on interactions
8. **Modular Design:** Reusable component system
9. **Responsive:** Seamless across devices
10. **Accessible:** WCAG compliant with proper semantics

---

## 🚀 Creating New UI Components

### When Building New Components:

**Follow These Patterns:**
1. Use shadcn/ui base components when possible
2. Apply Tailwind classes for styling
3. Use CSS variables for colors (not hardcoded)
4. Include animations via Framer Motion or CSS
5. Ensure mobile responsiveness with breakpoints
6. Add dark mode support (`.dark` class)
7. Use `cn()` utility for className merging

**Example Component:**
```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { springs } from '@/lib/animations';

const MyComponent = ({ className }: { className?: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={springs.gentle}
  >
    <Card className={cn('glass-card', className)}>
      <CardHeader>
        <CardTitle className="text-title2">
          My Component
        </CardTitle>
      </CardHeader>
      <CardContent>
        Content here
      </CardContent>
    </Card>
  </motion.div>
);
```

---

## 📱 Mobile Considerations

- **Viewport meta:** Safe area insets for notches
- **Touch targets:** Minimum 48px x 48px
- **Sheet drawers:** Use Sheet instead of Dialog on mobile
- **Sidebar collapse:** Hides on screens < 768px
- **Responsive grid:** 1 column mobile, 2+ column desktop
- **Font scaling:** Uses system font for readability
- **Spacing:** Increased padding on mobile (16px+ gaps)

---

## 🎨 Color Usage Guidelines

| Element | Use | Color |
|---------|-----|-------|
| Buttons (Primary) | Main CTAs | Primary (Purple) |
| Links | Navigation | Primary (Purple) |
| Borders | Dividers | Border (Light Gray) |
| Backgrounds | Cards | Card (White/Dark Gray) |
| Text Primary | Main content | Foreground (Black/Light Gray) |
| Text Secondary | Helper text | Muted Foreground |
| Hover states | Interactive feedback | Accent (Light Purple) |
| Danger zones | Delete/destructive | Destructive (Red) |
| Disabled | Inactive elements | Muted |
| Event colors | Calendar events | Event palette (8 colors) |

---

## ✅ Design Checklist for New Features

When building new UI:
- [ ] Follows color system (no hardcoded hex)
- [ ] Uses Tailwind classes, not inline styles
- [ ] Responsive on mobile/tablet/desktop
- [ ] Dark mode compatible
- [ ] Accessible (ARIA labels, keyboard nav)
- [ ] Smooth animations with Framer Motion
- [ ] Proper spacing using spacing scale
- [ ] Uses typography scale correctly
- [ ] Touch-friendly on mobile (48px targets)
- [ ] Follows component patterns in codebase
- [ ] Tested on multiple devices
- [ ] No console warnings or errors
- [ ] Uses CSS variables for colors
- [ ] Includes loading/skeleton states
- [ ] Proper error handling UI

---

## 📚 Resources & References

**Files to Reference:**
- [tailwind.config.ts](tailwind.config.ts) - Extended Tailwind config
- [src/styles/themes.css](src/styles/themes.css) - Color definitions
- [src/styles/base.css](src/styles/base.css) - Typography & spacing
- [src/components/ui/](src/components/ui/) - All UI components
- [src/lib/animations.ts](src/lib/animations.ts) - Animation configs
- [src/values/constants.ts](src/lib/stores/types.ts) - Type definitions

**Key Hooks:**
- `useIsMobile()` - Check if on mobile device
- `useViewStore()` - Get current view (day/week/month)
- `useSidebarLayout()` - Responsive sidebar logic
- `useTheme()` - Access theme context

---

**This design system is the foundation for all UI development. Reference this document when creating new components or modifying existing ones.**
