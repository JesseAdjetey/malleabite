# Phase 1 Testing Guide

## Quick Start Testing

### 1. Conflict Detection (2 minutes)
1. Open calendar in month view
2. Click on a date and create an event (e.g., "Meeting" 2:00 PM - 3:00 PM)
3. Try to create another event at the same time (e.g., "Call" 2:30 PM - 3:30 PM)
4. **Expected:** Orange/red warning appears showing conflict with suggestions
5. **Test:** Click a suggestion → Time should auto-fill

### 2. Analytics Dashboard (2 minutes)
1. Navigate to Analytics page (click BarChart icon in header)
2. **Expected:** Dashboard shows:
   - 4 metric cards (Events, Productive Hours, Focus Time, Meeting Time)
   - Trend indicators (↑ or ↓ with %)
   - Time distribution chart
   - Daily breakdown list
3. **Test:** Click "Weekly" and "Monthly" tabs → Data updates

### 3. Charts Visualization (1 minute)
1. Stay on Analytics page, Overview tab
2. **Expected:** See 3 charts:
   - TimeChart: Stacked area showing Focus/Meetings/Breaks
   - ProductivityHeatmap: Calendar grid with color-coded days
   - WeeklySummary: Bar chart with events/tasks/hours per day
3. **Test:** Hover over charts → Tooltips appear with details

### 4. Focus Time Protection (3 minutes)
1. Go to Settings → Focus Time tab
2. **Expected:** See 2 default focus blocks (Monday 9AM-12PM, 2PM-4PM)
3. **Test:** Add new focus block:
   - Click "Add Focus Block"
   - Change day to Wednesday
   - Set time 10AM-12PM
   - Label: "Deep Work"
4. Try creating event during focus time (Wednesday 10:30 AM)
5. **Expected:** Amber warning appears in event form

### 5. Schedule Optimizer (2 minutes)
1. Click floating AI button (bottom-right)
2. Click "Optimize My Schedule" button
3. **Expected:** Analysis panel shows:
   - Productivity score (0-100%)
   - 4 metric cards
   - AI insights (warnings or successes)
   - Top 3 available time slots
4. **Test:** Type "How's my focus time?" in chat → AI responds with hours + advice

### 6. Complete Workflow Test (5 minutes)
**Scenario:** Schedule a high-priority task optimally

1. Open Mally AI → Click "Optimize My Schedule"
2. Note the "Best Available Time Slots" (top 3)
3. Create new event at one of the recommended times
4. **Expected:** No conflicts, no focus time warnings
5. Go to Analytics → See event reflected in metrics
6. Return to calendar → Verify event appears correctly
7. Go to Settings → Focus Time → Check for conflicts
8. **Expected:** Smooth end-to-end flow with real-time updates

---

## Expected Results Summary

### ✅ Working Features
- [x] Conflict detection prevents double-booking
- [x] Analytics calculates metrics from events
- [x] Charts render time distribution
- [x] Time block analysis finds free slots
- [x] Optimizer scores slots 0-100
- [x] Focus time warns when scheduling over protected hours
- [x] AI integration provides schedule recommendations

### 📊 Performance Expectations
- Analytics load time: <2 seconds
- Conflict detection: Real-time (<500ms)
- Chart rendering: <1 second
- Optimizer analysis: 1-2 seconds

### 🎨 Visual Indicators
- **Red warning:** High conflict (>50% overlap)
- **Orange warning:** Medium conflict (25-50%)
- **Yellow warning:** Low conflict (<25%)
- **Amber warning:** Focus time conflict
- **Green badge:** High quality time slot
- **Blue badge:** Success/info messages

---

## Common Issues & Solutions

### Issue: Analytics shows "No data"
**Solution:** Create at least 1 event in the past 7 days

### Issue: Charts not rendering
**Solution:** Ensure recharts is installed: `npm install recharts --legacy-peer-deps`

### Issue: Focus time warnings not appearing
**Solution:** Check Settings → Focus Time → Ensure blocks are Active (toggle on)

### Issue: Optimizer button doesn't respond
**Solution:** Check browser console for errors, ensure events are loaded

### Issue: Conflict detection not working
**Solution:** Verify event has valid start/end times, refresh page

---

## Automated Testing Commands

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- conflict-detection
npm test -- analytics
npm test -- time-blocks
npm test -- schedule-optimizer

# Run with coverage
npm test -- --coverage
```

---

## Manual Testing Checklist

### Conflict Detection
- [ ] High severity conflict (>50% overlap) → Red warning
- [ ] Medium severity (25-50%) → Orange warning
- [ ] Low severity (<25%) → Yellow warning
- [ ] Suggestions clickable and auto-fill time
- [ ] Real-time updates as time changes

### Analytics
- [ ] Metrics calculate correctly from events
- [ ] Weekly tab shows last 7 days
- [ ] Monthly tab shows last 30 days
- [ ] Trends show positive/negative % changes
- [ ] Empty state displays when no events

### Charts
- [ ] TimeChart renders with 3 areas (Focus/Meetings/Breaks)
- [ ] Hover tooltips show hours
- [ ] ProductivityHeatmap shows color gradient (gray → green)
- [ ] Hover shows date + hours + events + tasks
- [ ] WeeklySummary has 3 bars per day
- [ ] All responsive on mobile (<768px width)

### Focus Time
- [ ] Add focus block → Saves
- [ ] Edit label → Persists
- [ ] Toggle active/inactive → Updates
- [ ] DND mode toggle works
- [ ] Event form shows warning during focus time
- [ ] Conflicts list populates

### Optimizer
- [ ] Button triggers analysis
- [ ] Productivity score displays 0-100%
- [ ] Metrics match Analytics page
- [ ] Insights show (warnings for low focus, successes for free time)
- [ ] Top 3 time slots display with quality badges
- [ ] Chat responses contextual

### Integration
- [ ] All features work together without errors
- [ ] Navigation between pages smooth
- [ ] State persists across page changes
- [ ] Real-time updates across components

---

## Performance Testing

### Load Testing
1. Create 50 events in current month
2. Navigate to Analytics → Should load <2s
3. Open event form → Conflict detection <500ms
4. Run optimizer → Analysis <2s

### Stress Testing
1. Create 100+ events across 3 months
2. Run all features → No crashes
3. Check browser DevTools → No memory leaks
4. Verify charts render with large datasets

---

## Accessibility Testing

### Keyboard Navigation
- [ ] Tab through all interactive elements
- [ ] Enter/Space activates buttons
- [ ] Escape closes modals
- [ ] Arrow keys navigate dropdowns

### Screen Reader
- [ ] All images have alt text
- [ ] Form labels properly associated
- [ ] ARIA labels on icon buttons
- [ ] Dynamic content announces changes

### Color Contrast
- [ ] Warnings meet WCAG AA (4.5:1)
- [ ] Charts readable for colorblind users
- [ ] Focus indicators visible

---

## Browser Testing

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

---

## Next Steps After Testing

1. **Document bugs** in GitHub Issues with:
   - Steps to reproduce
   - Expected vs. actual behavior
   - Screenshots/videos
   - Browser/device info

2. **Prioritize fixes:**
   - P0: Blocking (crashes, data loss)
   - P1: Critical (major features broken)
   - P2: Important (UX issues, minor bugs)
   - P3: Nice to have (polish, edge cases)

3. **Create Phase 1.1** for bug fixes before Phase 2

4. **Celebrate completion!** 🎉

---

*Testing Guide for Phase 1: Intelligence Enhancement*  
*Last Updated: January 2025*
