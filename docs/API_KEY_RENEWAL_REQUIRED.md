# 🔑 API Key Renewal Required

## ⚠️ Your Gemini API Key Has Expired

The current API key in your `.env` file has expired. You need to generate a new one.

---

## 🚀 Quick Fix (2 Minutes)

### Step 1: Get New API Key

1. Visit: **https://makersuite.google.com/app/apikey**
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Select your Google Cloud project (or create new one)
5. Copy the new key (starts with `AIza...`)

### Step 2: Update `.env` File

Open `.env` in your project root and replace the expired key:

```dotenv
# Replace this line:
VITE_GEMINI_API_KEY=AIzaSyB0li17INvpTWUBVhvwjmVssiKAG_ZTavs

# With your new key:
VITE_GEMINI_API_KEY=AIza_YOUR_NEW_KEY_HERE
```

### Step 3: Test the New Key

```bash
npm run mally:test
```

You should see:
```
✅ API Connection Successful!
📝 Response: Hello from Malleabite!
🎉 Mally AI is ready to use!
```

### Step 4: Update Firebase Functions

```bash
# Set the new key as a Firebase secret
npm run mally:setup
# Paste your new API key when prompted

# Deploy the functions
npm run mally:deploy
```

### Step 5: Restart Dev Server

```bash
npm run dev
```

---

## 🎯 After Setup

Test Mally AI with:
- "Schedule a meeting tomorrow at 2pm"
- "Add buy groceries to my todos"
- "Set an alarm for 8am every weekday"

---

## 💡 Why Did It Expire?

Gemini API keys can expire for several reasons:
- ⏰ **Time-based expiration** - Keys may have expiration dates
- 🔒 **Security rotation** - Google may rotate keys for security
- 📊 **Project changes** - Changes to your Google Cloud project

**Solution:** Always keep a backup key in Google AI Studio!

---

## 📊 Free Tier Reminder

Your new key will have:
- ✅ **60 requests/minute**
- ✅ **1,500 requests/day**
- ✅ **100% FREE forever**
- ✅ Perfect for personal use

Monitor usage: **https://aistudio.google.com/**

---

## ✅ Verification Checklist

After getting new key:

- [ ] New key added to `.env`
- [ ] Test script passes: `npm run mally:test`
- [ ] Firebase secret updated: `npm run mally:setup`
- [ ] Functions deployed: `npm run mally:deploy`
- [ ] Dev server restarted: `npm run dev`
- [ ] Mally AI responds intelligently (not fallback)
- [ ] No errors in browser console

---

## 🆘 Troubleshooting

### Issue: "API key expired" persists

**Solutions:**
1. Make sure you copied the FULL key (including all characters)
2. Remove any quotes or spaces around the key
3. Verify the key in AI Studio: https://aistudio.google.com/

### Issue: "Permission denied" on API

**Solutions:**
1. Enable the "Generative Language API" in Google Cloud Console
2. Go to: https://console.cloud.google.com/apis/library
3. Search for "Generative Language API"
4. Click "Enable"

### Issue: Still getting fallback responses

**Check:**
```bash
# View Firebase function logs
npm run mally:logs

# Look for "GEMINI_API_KEY is missing" or errors
```

---

**Status:** 🔴 **ACTION REQUIRED**  
**Time to Fix:** ~2 minutes  
**Impact:** Mally AI currently using basic fallback (no full intelligence)

🎯 **Get your new key now:** https://makersuite.google.com/app/apikey
