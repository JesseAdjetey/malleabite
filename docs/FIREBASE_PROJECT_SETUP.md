# Firebase Project Setup Guide for Malleabite

## Quick Setup Steps

### 1. Create Firebase Project (Do this first!)

1. **Go to Firebase Console:**
   - Visit [https://console.firebase.google.com](https://console.firebase.google.com)
   - Sign in with your Google account

2. **Create New Project:**
   - Click "Create a project"
   - Project name: `malleabite` (or your choice)
   - Enable Google Analytics (recommended)
   - Click "Create project"

### 2. Enable Required Services

#### Authentication:
- Go to "Authentication" → "Get started"
- Click "Sign-in method" tab
- Enable "Email/Password" provider
- Click "Save"

#### Firestore Database:
- Go to "Firestore Database" → "Create database"
- Choose "Start in test mode" 
- Select region closest to you
- Click "Done"

#### Cloud Functions:
- Go to "Functions" → "Get started"
- Upgrade to Blaze plan (pay-as-you-go) - required for Cloud Functions
- Note: Firebase has generous free tiers

### 3. Get Your App Configuration

1. In Firebase console → Project Settings (gear icon)
2. Scroll to "Your apps" section
3. Click "Add app" → Web app icon (</>)
4. App nickname: `malleabite-web`
5. Click "Register app"
6. **Copy the config object** (looks like this):

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyC...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id", 
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef",
  measurementId: "G-XXXXXXXXX"
};
```

### 4. Configure Your Local Project

Run the setup script and enter your Firebase config values:

```bash
npm run firebase:setup
```

The script will ask for:
- API Key
- Auth Domain  
- Project ID
- Storage Bucket
- Messaging Sender ID
- App ID
- Measurement ID (optional)

### 5. Test Your Setup

Add this to your app temporarily to test:

```tsx
import { FirebaseMigrationTest } from '@/components/debug/FirebaseMigrationTest';

// Add <FirebaseMigrationTest /> to your component
```

### 6. Initialize Firebase CLI (Optional)

```bash
firebase login
firebase init
```

Select:
- Firestore
- Functions  
- Hosting (optional)

## Important Notes

- **Billing:** Cloud Functions require Blaze plan, but has generous free tier
- **Security:** We'll update Firestore rules after setup
- **Migration:** Start with auth and calendar, then enable other features
- **Testing:** Use Firebase emulators for local development

## Troubleshooting

**Error: "Firebase not initialized"**
- Make sure you've updated the config in `src/integrations/firebase/config.ts`

**Error: "Permission denied"**  
- Check Firestore rules, ensure authentication is working

**Functions not working:**
- Verify you're on Blaze plan
- Check Cloud Functions are enabled

## Next Steps After Setup

1. Run `npm run dev` to test
2. Enable Firebase features one by one using migration flags
3. Deploy functions: `npm run firebase:functions:deploy`
4. Complete migration: `npm run firebase:complete`

Ready to start? Create your Firebase project first, then run `npm run firebase:setup`!
