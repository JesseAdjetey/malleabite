# Phase 1 Quick Testing Checklist (15 minutes)

**Date:** October 23, 2025  
**Status:** Ready for testing  
**Goal:** Verify all 7 Phase 1 features are operational before Phase 2

---

## ✅ Test 1: Server Running (30 seconds)

- [ ] Open http://localhost:5173 (or your dev server)
- [ ] Page loads without errors
- [ ] Check browser console (F12) - no red errors
- [ ] Calendar displays correctly

**Result:** ✅ Pass / ❌ Fail  
**Notes:** ___________________________________________

---

## ✅ Test 2: Conflict Detection (2 minutes)

**Steps:**
1. Click on today's date in calendar
2. Create event: "Team Meeting" 
   - Time: 2:00 PM - 3:00 PM
   - Click Save
3. Try to create another event: "Client Call"
   - Time: 2:30 PM - 3:30 PM
   - **Expected:** Orange/red warning appears
4. Check if 3 alternative suggestions appear
5. Click one suggestion
   - **Expected:** Time auto-fills

**Checklist:**
- [ ] Warning appears when creating overlapping event
- [ ] Warning color-coded (red/orange/yellow based on overlap)
- [ ] Shows 3 alternative time suggestions
- [ ] Clicking suggestion auto-fills time
- [ ] Can create event successfully

**Result:** ✅ Pass / ❌ Fail  
**Screenshot:** (if failed, take screenshot)  
**Notes:** ___________________________________________

---

## ✅ Test 3: Analytics Dashboard (2 minutes)

**Steps:**
1. Look for BarChart icon in header (top navigation)
2. Click the BarChart icon OR navigate to `/analytics`
3. **Expected:** Dashboard page loads with metrics

**Checklist:**
- [ ] BarChart icon visible in header
- [ ] Clicking opens Analytics page
- [ ] 4 metric cards display (Events, Hours, Focus Time, Meetings)
- [ ] Trend indicators show (↑ or ↓ with %)
- [ ] Weekly/Monthly tabs work
- [ ] At least one chart renders (even if empty)

**Result:** ✅ Pass / ❌ Fail  
**Notes:** ___________________________________________

---

## ✅ Test 4: Charts Rendering (2 minutes)

**On Analytics page, scroll down:**

**Checklist:**
- [ ] TimeChart renders (area/line chart)
- [ ] ProductivityHeatmap renders (calendar grid)
- [ ] WeeklySummary renders (bar chart)
- [ ] Hovering over charts shows tooltips
- [ ] Charts update when switching Weekly/Monthly tabs

**Result:** ✅ Pass / ❌ Fail  
**Notes:** ___________________________________________

---

## ✅ Test 5: Focus Time Protection (3 minutes)

**Steps:**
1. Click Settings icon (or navigate to `/settings`)
2. Click "Focus Time" tab
3. **Expected:** See 2 default focus blocks (Monday 9AM-12PM, 2PM-4PM)
4. Click "Add Focus Block"
5. Set: Wednesday, 10:00 AM - 12:00 PM, label "Deep Work"
6. Go back to Calendar
7. Try to create event on Wednesday at 10:30 AM
   - **Expected:** Amber/yellow warning appears mentioning "Deep Work"

**Checklist:**
- [ ] Focus Time tab exists in Settings
- [ ] Default focus blocks display
- [ ] Can add new focus block
- [ ] Focus block saves (refresh page, still there)
- [ ] Creating event during focus time shows warning
- [ ] Warning mentions focus block name
- [ ] Do Not Disturb toggle works

**Result:** ✅ Pass / ❌ Fail  
**Notes:** ___________________________________________

---

## ✅ Test 6: Mally AI Integration (3 minutes)

**Steps:**
1. Look for floating AI button (bottom-right, purple gradient)
2. Click the AI button
3. **Expected:** Modal opens with Mally AI
4. Click "Optimize My Schedule" button
5. **Expected:** Analysis panel appears with:
   - Productivity score (0-100%)
   - 4 metric cards
   - AI insights/recommendations
   - Top 3 time slots

**Checklist:**
- [ ] AI button visible and clickable
- [ ] Modal opens smoothly
- [ ] "Optimize My Schedule" button visible
- [ ] Clicking button shows analysis
- [ ] Productivity score displays
- [ ] Metrics match Analytics page
- [ ] Insights appear (warnings or successes)
- [ ] Time slots listed with quality badges

**Chat Test:**
- [ ] Type "How's my focus time?" in chat
- [ ] AI responds with relevant info
- [ ] Type "optimize" - AI suggests using optimizer

**Result:** ✅ Pass / ❌ Fail  
**Notes:** ___________________________________________

---

## ✅ Test 7: End-to-End Workflow (3 minutes)

**Complete workflow test:**

**Steps:**
1. Open Mally AI
2. Click "Optimize My Schedule"
3. Note one of the "Best Available Time Slots"
4. Close AI, create new event at that recommended time
5. **Expected:** No conflicts, no focus time warnings
6. Save event
7. Go to Analytics → See event in metrics
8. Go to Settings → Focus Time → No conflicts listed

**Checklist:**
- [ ] Can get recommendations from AI
- [ ] Recommended slots are actually free
- [ ] Creating event at recommended time succeeds
- [ ] Event appears in calendar
- [ ] Analytics updates with new event
- [ ] No system errors or crashes

**Result:** ✅ Pass / ❌ Fail  
**Notes:** ___________________________________________

---

## 📊 Test Summary

**Tests Passed:** ___ / 7  
**Tests Failed:** ___ / 7

**Overall Result:** 
- ✅ PASS (6-7 tests passed) → **Ready for Phase 2!**
- ⚠️ PARTIAL (4-5 tests passed) → Fix critical bugs first
- ❌ FAIL (<4 tests passed) → Investigation needed

---

## 🐛 Bugs Found

| Priority | Feature | Description | Screenshot |
|----------|---------|-------------|------------|
| P0 | | | |
| P1 | | | |
| P2 | | | |

**P0 = Blocking (crashes, data loss)**  
**P1 = Critical (major features broken)**  
**P2 = Important (UX issues, minor bugs)**

---

## ✅ Sign-Off

**Tester:** ___________________________________________  
**Date:** ___________________________________________  
**Status:** ✅ Approved for Phase 2 / ⚠️ Needs fixes / ❌ Major issues  

**Notes:** ___________________________________________

---

## 🚀 Next Steps

If testing passes:
1. ✅ Mark "Phase 1 Testing & Validation" as complete
2. ✅ Document any minor bugs for Phase 1.1
3. 🎯 Begin Phase 2: Event Templates System
4. 🎉 Celebrate Phase 1 completion!

---

*Quick Test Guide - Complete in 15 minutes*  
*For comprehensive testing, see PHASE_1_TESTING_GUIDE.md*
