# 🚀 Production Setup Guide - CRITICAL ACTIONS REQUIRED

## ⚠️ URGENT: Security Issues Fixed

Your Firebase credentials were **exposed in the codebase**. I've implemented fixes, but you must take immediate action.

---

## 🔴 IMMEDIATE ACTIONS (Do This NOW)

### 1. Rotate Firebase API Keys (CRITICAL - 15 minutes)

Your old keys are compromised. Follow these steps:

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. Select your project: `malleabite-97d35`
3. Click the gear icon ⚙️ → **Project Settings**
4. Scroll to "Your apps" section
5. Click on your web app
6. **Delete the old web app** (this invalidates the exposed keys)
7. Click "Add app" → Select "Web" (</>) 
8. Register a new web app with name "Malleabite Web"
9. **Copy the new configuration values**

### 2. Configure Environment Variables (5 minutes)

1. **Open the `.env` file** in the project root (I created it for you)

2. **Fill in your NEW Firebase credentials:**
```env
VITE_FIREBASE_API_KEY=<your_new_api_key_here>
VITE_FIREBASE_AUTH_DOMAIN=malleabite-97d35.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=malleabite-97d35
VITE_FIREBASE_STORAGE_BUCKET=malleabite-97d35.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=<your_new_sender_id>
VITE_FIREBASE_APP_ID=<your_new_app_id>
VITE_FIREBASE_MEASUREMENT_ID=G-FY8VC4Y2WX
```

3. **Get Gemini API Key** (for Mally AI to work):
   - Go to: https://makersuite.google.com/app/apikey
   - Create API key
   - Add to `.env`:
   ```env
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **Configure Firebase Functions** (for backend AI):
```bash
firebase functions:config:set gemini.api_key="YOUR_GEMINI_API_KEY"
```

### 3. Verify `.env` is NOT in Git (30 seconds)

```bash
# Check if .env is in gitignore
git check-ignore .env

# Should output: .env (if it's properly ignored)

# If .env is already tracked, remove it:
git rm --cached .env
git commit -m "Remove .env from tracking"
```

### 4. Deploy Updated Security Rules (5 minutes)

```bash
# Deploy the enhanced Firestore rules
firebase deploy --only firestore:rules

# Verify deployment was successful
```

---

## ✅ What I've Implemented

### 1. Security Fixes ✅
- ✅ Moved Firebase credentials to environment variables
- ✅ Created `.env.example` template
- ✅ Updated `.gitignore` to exclude `.env` files
- ✅ Enhanced Firestore security rules with:
  - Field validation
  - Rate limiting
  - Input length checks
  - Permission verification

### 2. Error Handling ✅
- ✅ Created `ErrorBoundary` component
- ✅ Implemented centralized error handler (`src/lib/error-handler.ts`)
- ✅ Created logger utility (`src/lib/logger.ts`)
- ✅ Integrated error boundaries into App.tsx

### 3. Input Validation ✅
- ✅ Created validation utilities using Zod (`src/lib/validation.ts`)
- ✅ Added schemas for:
  - Calendar events
  - Todos
  - User profiles
  - Authentication
  - Templates
- ✅ Implemented sanitization functions
- ✅ Added rate limiting helpers

### 4. Performance Optimization ✅
- ✅ Implemented lazy loading for all routes
- ✅ Added loading fallback UI
- ✅ Configured code splitting in Vite
- ✅ Optimized production build settings
- ✅ Set up terser to remove console.logs in production
- ✅ Created vendor chunk splitting

### 5. Configuration ✅
- ✅ Environment variable validation
- ✅ Clear error messages if env vars are missing
- ✅ Production vs development build configurations

---

## 🧪 Testing Your Changes

### 1. Test Development Build

```bash
# Install dependencies (if needed)
npm install

# Start dev server
npm run dev

# Should see error if .env not configured correctly
```

### 2. Test Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview

# Verify:
# - No console.logs in browser console
# - Fast load times
# - No errors
```

### 3. Test Error Handling

Try these scenarios to verify error handling:
1. Disconnect internet → Try to load events (should show error toast)
2. Enter invalid email in auth form (should show validation error)
3. Try to create event without title (should show validation error)

---

## 📦 New Files Created

1. **`.env.example`** - Template for environment variables
2. **`.env`** - Your actual environment variables (FILL THIS IN!)
3. **`src/components/ErrorBoundary.tsx`** - Error boundary component
4. **`src/lib/error-handler.ts`** - Centralized error handling
5. **`src/lib/logger.ts`** - Centralized logging utility
6. **`src/lib/validation.ts`** - Input validation and sanitization

## 📝 Files Modified

1. **`.gitignore`** - Added .env exclusions
2. **`src/integrations/firebase/config.ts`** - Uses environment variables
3. **`src/App.tsx`** - Added ErrorBoundary and lazy loading
4. **`vite.config.ts`** - Production build optimizations
5. **`tsconfig.json`** - Added TODOs for stricter typing
6. **`firestore.rules`** - Enhanced security rules

---

## 🔄 Next Steps (After Basic Setup)

### Phase 2: Replace Console Statements (High Priority)
I found 147+ console.log/error statements. Replace them:

```typescript
// Old way (❌)
console.log('Event added:', event);
console.error('Failed:', error);

// New way (✅)
import { logger } from '@/lib/logger';
logger.info('Events', 'Event added', event);
logger.error('Events', 'Failed to add event', error);

// Or use the error handler
import { errorHandler } from '@/lib/error-handler';
errorHandler.handleFirestoreError(error, 'add event');
```

### Phase 3: Add Form Validation
Use the validation utilities I created:

```typescript
import { validateEvent, sanitizeInput } from '@/lib/validation';

// In your form submit handler:
const result = validateEvent(formData);
if (!result.success) {
  // Show validation errors
  console.error(result.error);
  return;
}

// Sanitize inputs
const cleanTitle = sanitizeInput(formData.title);
```

### Phase 4: Testing (Next Week)
```bash
# Install test dependencies
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom

# Create test files
# See PRODUCTION_READINESS_REPORT.md for examples
```

---

## 🆘 Troubleshooting

### Error: "Missing required environment variables"
**Solution:** You haven't filled in the `.env` file. Copy `.env.example` to `.env` and fill in all values.

### Error: "Firebase: Error (auth/invalid-api-key)"
**Solution:** Your API key is wrong. Double-check you copied it correctly from Firebase Console.

### Mally AI says "I'm almost ready!"
**Solution:** Gemini API key not configured. Follow step 2.3 above.

### Build fails with "Cannot find module"
**Solution:** Run `npm install` to install all dependencies.

### Changes not showing up
**Solution:** Restart dev server (`Ctrl+C`, then `npm run dev`)

---

## 📊 Progress Status

### Completed ✅
- [x] Environment variable setup
- [x] Firebase credential protection
- [x] Error boundary implementation
- [x] Centralized error handling
- [x] Centralized logging
- [x] Input validation utilities
- [x] Lazy loading for routes
- [x] Production build optimization
- [x] Enhanced security rules
- [x] Rate limiting (basic)

### TODO ⏳
- [ ] Fill in `.env` file (YOU MUST DO THIS)
- [ ] Rotate Firebase keys (YOU MUST DO THIS)
- [ ] Configure Gemini API key (YOU MUST DO THIS)
- [ ] Replace console.log statements
- [ ] Add form validation to all forms
- [ ] Set up error tracking (Sentry)
- [ ] Add unit tests
- [ ] Enable strict TypeScript mode
- [ ] Performance monitoring
- [ ] SEO optimization

---

## 🎯 Success Checklist

Before you continue development, verify:

- [ ] I've filled in the `.env` file with valid credentials
- [ ] I've rotated the exposed Firebase API keys
- [ ] I've configured the Gemini API key
- [ ] Dev server starts without errors (`npm run dev`)
- [ ] I can sign in/sign up successfully
- [ ] Mally AI responds (not showing "I'm almost ready")
- [ ] Events can be created and saved
- [ ] No errors in browser console
- [ ] `.env` is NOT committed to git

---

## 📞 Questions?

If you encounter issues:
1. Check the browser console for errors
2. Check the terminal for build errors
3. Verify all environment variables are set
4. Ensure Firebase rules are deployed
5. Clear browser cache and reload

---

**REMEMBER: Do NOT commit your `.env` file to Git. It contains sensitive credentials!**

Good luck! 🚀
