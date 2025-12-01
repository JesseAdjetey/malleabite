#!/usr/bin/env node

/**
 * Firebase Migration Setup Script for Malleabite
 * This script helps set up Firebase configuration and migration flags
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import readline from 'readline';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(new URL(import.meta.url).pathname);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
};

async function setupFirebaseMigration() {
  console.log('🔥 Firebase Migration Setup for Malleabite\n');
  console.log('This script will help you configure Firebase for your migration.\n');

  // Check if user has Firebase project ready
  const hasFirebaseProject = await question('Do you have a Firebase project set up? (y/n): ');
  
  if (hasFirebaseProject.toLowerCase() !== 'y') {
    console.log('\n📋 Please complete these steps first:');
    console.log('1. Go to https://console.firebase.google.com');
    console.log('2. Create a new Firebase project');
    console.log('3. Enable Authentication (Email/Password)');
    console.log('4. Enable Firestore Database');
    console.log('5. Enable Cloud Functions');
    console.log('6. Get your Firebase config from Project Settings > General > Your apps\n');
    console.log('Run this script again when ready!');
    rl.close();
    return;
  }

  console.log('\n🔧 Firebase Configuration Setup\n');

  // Get Firebase config details
  const apiKey = await question('Firebase API Key: ');
  const authDomain = await question('Auth Domain (e.g., your-project.firebaseapp.com): ');
  const projectId = await question('Project ID: ');
  const storageBucket = await question('Storage Bucket (e.g., your-project.appspot.com): ');
  const messagingSenderId = await question('Messaging Sender ID: ');
  const appId = await question('App ID: ');
  const measurementId = await question('Measurement ID (optional, press enter to skip): ');

  // Update Firebase config file
  const configPath = path.join(__dirname, '..', 'src', 'integrations', 'firebase', 'config.ts');
  let configContent = fs.readFileSync(configPath, 'utf8');

  configContent = configContent
    .replace('YOUR_API_KEY', apiKey)
    .replace('YOUR_PROJECT_ID.firebaseapp.com', authDomain)
    .replace(/YOUR_PROJECT_ID/g, projectId)
    .replace('YOUR_PROJECT_ID.appspot.com', storageBucket)
    .replace('YOUR_MESSAGING_SENDER_ID', messagingSenderId)
    .replace('YOUR_APP_ID', appId);

  if (measurementId) {
    configContent = configContent.replace('YOUR_MEASUREMENT_ID', measurementId);
  }

  fs.writeFileSync(configPath, configContent);
  console.log('✅ Firebase config updated successfully!');

  // Create .env.local file
  const envContent = `# Firebase Configuration
VITE_FIREBASE_API_KEY=${apiKey}
VITE_FIREBASE_AUTH_DOMAIN=${authDomain}
VITE_FIREBASE_PROJECT_ID=${projectId}
VITE_FIREBASE_STORAGE_BUCKET=${storageBucket}
VITE_FIREBASE_MESSAGING_SENDER_ID=${messagingSenderId}
VITE_FIREBASE_APP_ID=${appId}
${measurementId ? `VITE_FIREBASE_MEASUREMENT_ID=${measurementId}` : ''}

# Anthropic Claude API (for AI features)
VITE_ANTHROPIC_API_KEY=your_anthropic_key_here
`;

  const envPath = path.join(__dirname, '..', '.env.local');
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Environment file created!');

  // Ask about migration flags
  console.log('\n🔄 Migration Flags Configuration\n');
  console.log('You can gradually enable Firebase features for testing:');

  const enableAuth = await question('Enable Firebase Authentication? (y/n): ');
  const enableCalendar = await question('Enable Firebase Calendar Events? (y/n): ');

  // Update migration flags
  const flagsPath = path.join(__dirname, '..', 'src', 'lib', 'migration-flags.ts');
  let flagsContent = fs.readFileSync(flagsPath, 'utf8');

  if (enableAuth.toLowerCase() === 'y') {
    flagsContent = flagsContent.replace('USE_FIREBASE_AUTH: false', 'USE_FIREBASE_AUTH: true');
  }

  if (enableCalendar.toLowerCase() === 'y') {
    flagsContent = flagsContent.replace('USE_FIREBASE_CALENDAR: false', 'USE_FIREBASE_CALENDAR: true');
  }

  fs.writeFileSync(flagsPath, flagsContent);
  console.log('✅ Migration flags updated!');

  console.log('\n🎉 Firebase migration setup complete!');
  console.log('\nNext steps:');
  console.log('1. Update your Anthropic API key in .env.local');
  console.log('2. Run `npm run dev` to test the application');
  console.log('3. Check the console for migration logs');
  console.log('4. Gradually enable more Firebase features using migration flags');
  console.log('\nSee docs/FIREBASE_MIGRATION_GUIDE.md for detailed migration steps.');

  rl.close();
}

setupFirebaseMigration().catch(console.error);
