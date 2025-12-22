# Mobile & PWA Quick Reference

## 🎯 What We Built

### Mobile Components
1. **MobileEventForm** - Bottom sheet form with 44px+ touch targets
2. **MobileMonthView** - Swipeable calendar grid with FAB
3. **MobileDayView** - Hourly timeline with swipe navigation

### PWA Features
1. **Service Worker** - Offline caching (static + API)
2. **Install Prompt** - Android (native) + iOS (instructions)
3. **Offline Sync** - IndexedDB queue for offline events
4. **Manifest** - Updated with shortcuts and SW config

## 📱 How to Use

### Testing Mobile Views
```bash
# Start dev server
npm run dev

# Open Chrome DevTools
# Press F12 → Toggle device toolbar (Ctrl+Shift+M)
# Select iPhone or Android device
# Test swipe gestures with mouse drag
```

### Testing PWA Installation
```bash
# Chrome (Android/Desktop):
# 1. Open app in browser
# 2. Wait 3 seconds for install prompt
# 3. Click "Install" button
# 4. App appears on home screen/desktop

# Safari (iOS):
# 1. Open app in Safari
# 2. Tap Share button
# 3. Scroll down → "Add to Home Screen"
# 4. Name it and tap "Add"
```

### Testing Offline Mode
```bash
# Chrome DevTools:
# 1. Open Application tab
# 2. Check "Service Workers"
# 3. Enable "Offline" checkbox
# 4. Reload page → should still work
# 5. Create event → queues in IndexedDB
# 6. Disable offline → event syncs automatically
```

## 🔧 Configuration

### Service Worker Cache Version
**File:** `public/sw.js`
```javascript
const CACHE_VERSION = 'v1.0.0'; // Update to bust cache
```

### Install Prompt Delay
**File:** `src/components/pwa/InstallPrompt.tsx`
```typescript
setTimeout(() => {
  setShowPrompt(true);
}, 3000); // 3 seconds (Android)

setTimeout(() => {
  setShowPrompt(true);
}, 5000); // 5 seconds (iOS)
```

### Manifest Theme Colors
**File:** `public/manifest.json`
```json
{
  "theme_color": "#8b5cf6",    // Purple (address bar)
  "background_color": "#0a0a0a" // Dark (splash screen)
}
```

## 🚨 Common Issues

### Service Worker Not Registering
**Problem:** Console error "Service worker registration failed"
**Solution:**
1. Check `public/sw.js` exists
2. Ensure HTTPS (localhost is OK)
3. Clear browser cache (Ctrl+Shift+Delete)
4. Hard reload (Ctrl+Shift+R)

### Install Prompt Not Showing
**Problem:** Prompt never appears on Android
**Solution:**
1. App must be HTTPS (localhost is OK)
2. Must have valid manifest.json
3. Service worker must be registered
4. User hasn't dismissed it before (check localStorage)
5. Clear site data: DevTools → Application → Clear storage

### Swipe Gestures Not Working
**Problem:** Swipe doesn't change month/day
**Solution:**
1. Verify `react-swipeable` is installed: `npm list react-swipeable`
2. Check touch events aren't blocked by parent
3. Ensure `preventScrollOnSwipe: true` is set
4. Test on real mobile device (mouse drag in DevTools can be unreliable)

### Offline Events Not Syncing
**Problem:** Events created offline don't appear when back online
**Solution:**
1. Check IndexedDB: DevTools → Application → IndexedDB → MalleabiteOffline
2. Verify `pendingEvents` store has unsynced events
3. Ensure background sync is registered: DevTools → Application → Service Workers
4. Check network tab for failed sync requests
5. Manually trigger sync: `await registration.sync.register('sync-events')`

## 📊 Browser Support

### Full PWA Support
- ✅ Chrome (Android/Desktop/iOS)
- ✅ Edge (Desktop/Android)
- ✅ Samsung Internet
- ✅ Opera (Android/Desktop)

### Partial PWA Support
- ⚠️ Safari (iOS) - No beforeinstallprompt, manual install only
- ⚠️ Firefox (Android) - Limited PWA features

### No PWA Support
- ❌ Internet Explorer
- ❌ Firefox (Desktop) - No install prompt

## 🎨 Customization

### Mobile Touch Targets
Minimum sizes defined in Tailwind:
- Buttons: `h-12 w-12` (48px) or `h-10 w-10` (40px minimum)
- Form inputs: `h-12` (48px height)
- Event cards: `min-h-[52px]` (52px minimum)
- FAB: `h-14 w-14` (56px)

### Swipe Gesture Sensitivity
**File:** `src/components/calendar/mobile/MobileMonthView.tsx`
```typescript
const handlers = useSwipeable({
  onSwipedLeft: () => handleNextMonth(),
  onSwipedRight: () => handlePrevMonth(),
  preventScrollOnSwipe: true,
  trackMouse: false, // Set to true to test with mouse
  delta: 10, // Min distance (default: 10px)
});
```

## 🔗 Related Files

### Mobile Components
- `src/components/calendar/mobile/MobileEventForm.tsx`
- `src/components/calendar/mobile/MobileMonthView.tsx`
- `src/components/calendar/mobile/MobileDayView.tsx`

### PWA Core
- `public/sw.js` - Service worker
- `src/lib/sw-registration.ts` - Registration logic
- `src/lib/offline-sync.ts` - IndexedDB sync
- `src/components/pwa/InstallPrompt.tsx` - Install UI

### Configuration
- `public/manifest.json` - PWA manifest
- `src/main.tsx` - SW registration entry point
- `src/App.tsx` - InstallPrompt integration

## 📚 Resources
- [MDN: Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Google PWA Checklist](https://web.dev/pwa-checklist/)
- [react-swipeable Docs](https://github.com/FormidableLabs/react-swipeable)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
