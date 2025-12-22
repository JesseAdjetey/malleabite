# ⚡ Quick Start - Do This First!

## 🚨 3 Critical Steps (15 minutes)

### Step 1: Fill in Environment Variables (5 min)
```bash
# Open .env file and fill in these values:
VITE_FIREBASE_API_KEY=          # Get from Firebase Console
VITE_FIREBASE_APP_ID=           # Get from Firebase Console
VITE_GEMINI_API_KEY=            # Get from Google AI Studio
```

**Where to get them:**
- Firebase: https://console.firebase.google.com/ → Project Settings → Your apps
- Gemini: https://makersuite.google.com/app/apikey

---

### Step 2: Rotate Firebase Keys (10 min)

⚠️ **Your old keys were exposed!** You MUST rotate them:

1. Go to: https://console.firebase.google.com/
2. Select project: `malleabite-97d35`
3. Settings ⚙️ → Project Settings → Your apps
4. **Delete old web app** (invalidates exposed keys)
5. Add new web app → Copy new credentials
6. Paste into `.env` file

---

### Step 3: Test It Works (30 seconds)

```bash
npm install
npm run dev
```

Visit: http://localhost:8080

✅ Should load without errors  
✅ Should be able to sign in  
✅ Mally AI should respond

---

## 🐛 Quick Fixes

**Error: "Missing required environment variables"**
→ You didn't fill in `.env`. Do Step 1 above.

**Error: "Firebase: Error (auth/invalid-api-key)"**
→ Wrong API key. Double-check Firebase Console.

**Mally AI says "I'm almost ready!"**
→ Missing Gemini API key. Add `VITE_GEMINI_API_KEY` to `.env`

---

## 📚 Full Documentation

- **Setup Guide:** `SETUP_INSTRUCTIONS.md`
- **What Changed:** `PHASE_1_IMPLEMENTATION_COMPLETE.md`
- **Production Roadmap:** `PRODUCTION_READINESS_REPORT.md`

---

## ✅ Checklist

- [ ] Filled in `.env` file
- [ ] Rotated Firebase keys
- [ ] Configured Gemini API
- [ ] App runs (`npm run dev`)
- [ ] Can sign in/sign up
- [ ] Mally AI responds
- [ ] No errors in console

**Done? Great! Now read `PRODUCTION_READINESS_REPORT.md` for next steps.**
