# Vercel Deployment Guide

## Prerequisites
- Vercel account (free tier works)
- Git repository connected to Vercel

## Step-by-Step Deployment

### 1. Configure Environment Variables in Vercel

Go to your Vercel project → Settings → Environment Variables and add:

```
VITE_FIREBASE_API_KEY=AIzaSyBJN1TZnchrGUNzgkyo6p1QEqaH3ceflVE
VITE_FIREBASE_AUTH_DOMAIN=malleabite-97d35.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=malleabite-97d35
VITE_FIREBASE_STORAGE_BUCKET=malleabite-97d35.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=879274801325
VITE_FIREBASE_APP_ID=1:879274801325:web:6769e3259a07cee30fae24
VITE_FIREBASE_MEASUREMENT_ID=G-RNVWYMH3KK
VITE_GEMINI_API_KEY=AIzaSyB0li17INvpTWUBVhvwjmVssiKAG_ZTavs
VITE_ENABLE_ANALYTICS=true
```

**Important:** Set these for all environments (Production, Preview, Development)

### 2. Build Settings

Vercel should auto-detect Vite, but verify these settings:

- **Framework Preset:** Vite
- **Build Command:** `npm run build` or `yarn build`
- **Output Directory:** `dist`
- **Install Command:** `npm install` or `yarn install`
- **Node Version:** 18.x or higher

### 3. Firebase Configuration

Ensure your Firebase project has these domains authorized:

1. Go to Firebase Console → Authentication → Settings → Authorized domains
2. Add your Vercel domain (e.g., `malleabite.vercel.app`)
3. Add any custom domains you're using

### 4. Deploy

```bash
# Option 1: Push to Git (auto-deploys)
git add .
git commit -m "Configure Vercel deployment"
git push

# Option 2: Deploy via Vercel CLI
npm i -g vercel
vercel --prod
```

## Troubleshooting

### Blank Page on Vercel

**Symptoms:** Page loads locally but shows blank on Vercel

**Solutions:**

1. **Check Environment Variables**
   - All `VITE_` prefixed variables must be in Vercel
   - Redeploy after adding variables

2. **Check Browser Console**
   - Open DevTools → Console
   - Look for Firebase initialization errors
   - Check Network tab for failed requests

3. **Check Build Logs**
   - Go to Vercel project → Deployments → Click deployment → Build Logs
   - Look for any errors or warnings

4. **Verify Routes**
   - Check `vercel.json` has correct SPA routing
   - All routes should redirect to `/index.html`

5. **Check Firebase Rules**
   - Ensure Firestore rules allow read/write for authenticated users
   - Test rules in Firebase Console

### Common Errors

#### "Missing required environment variables"
- Add all `VITE_` variables to Vercel
- Redeploy after adding

#### "Firebase: Error (auth/unauthorized-domain)"
- Add Vercel domain to Firebase authorized domains
- Wait a few minutes for changes to propagate

#### "Failed to load resource: net::ERR_BLOCKED_BY_CLIENT"
- Check browser extensions (ad blockers)
- Try in incognito mode

#### Build fails with "Cannot find module"
- Clear Vercel build cache: Deployments → ⋯ → Redeploy → Clear cache
- Check package.json has all dependencies

## Testing Production Build Locally

Before deploying, test the production build:

```bash
# Build
npm run build

# Preview
npm run preview
```

Visit `http://localhost:4173` to test the production build.

## Performance Optimization

The project is already configured with:
- ✅ Code splitting
- ✅ Lazy loading
- ✅ Asset optimization
- ✅ PWA support
- ✅ Gzip compression (Vercel automatic)

## Support

If issues persist:
1. Check Vercel deployment logs
2. Check browser console errors
3. Verify Firebase configuration
4. Test locally with production build
