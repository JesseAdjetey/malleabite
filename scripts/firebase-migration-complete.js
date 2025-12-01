#!/usr/bin/env node

/**
 * Firebase Migration Completion Script
 * This script helps finalize the Firebase migration and clean up Supabase dependencies
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
};

async function completeMigration() {
  console.log('🏁 Firebase Migration Completion Script\n');
  console.log('This script will help you finalize the migration and clean up Supabase.\n');

  // Check if user wants to proceed
  const proceed = await question('Are you ready to complete the migration? (y/n): ');
  
  if (proceed.toLowerCase() !== 'y') {
    console.log('Migration completion cancelled.');
    rl.close();
    return;
  }

  console.log('\n🔍 Checking migration status...\n');

  // Check if all Firebase features are enabled
  const flagsPath = path.join(__dirname, '..', 'src', 'lib', 'migration-flags.ts');
  const flagsContent = fs.readFileSync(flagsPath, 'utf8');
  
  const enabledFeatures = [];
  const disabledFeatures = [];
  
  const flagChecks = [
    'USE_FIREBASE_AUTH',
    'USE_FIREBASE_CALENDAR',
    'USE_FIREBASE_TODOS',
    'USE_FIREBASE_AI_FUNCTIONS'
  ];

  flagChecks.forEach(flag => {
    if (flagsContent.includes(`${flag}: true`)) {
      enabledFeatures.push(flag);
    } else {
      disabledFeatures.push(flag);
    }
  });

  console.log('✅ Enabled Firebase features:', enabledFeatures.join(', '));
  if (disabledFeatures.length > 0) {
    console.log('⚠️  Disabled Firebase features:', disabledFeatures.join(', '));
  }

  if (disabledFeatures.length > 0) {
    const continueAnyway = await question('\nSome features are not enabled. Continue anyway? (y/n): ');
    if (continueAnyway.toLowerCase() !== 'y') {
      console.log('Please enable all Firebase features before completing migration.');
      rl.close();
      return;
    }
  }

  // Update main context files to use Firebase by default
  console.log('\n🔄 Updating default contexts to use Firebase...');

  // Update main AuthContext to use Firebase
  const authContextPath = path.join(__dirname, '..', 'src', 'contexts', 'AuthContext.tsx');
  const firebaseAuthPath = path.join(__dirname, '..', 'src', 'contexts', 'AuthContext.firebase.tsx');
  
  if (fs.existsSync(firebaseAuthPath)) {
    const firebaseAuthContent = fs.readFileSync(firebaseAuthPath, 'utf8');
    fs.writeFileSync(authContextPath, firebaseAuthContent);
    console.log('✅ AuthContext updated to use Firebase');
  }

  // Update main calendar events hook
  const calendarHookPath = path.join(__dirname, '..', 'src', 'hooks', 'use-calendar-events.ts');
  const firebaseCalendarPath = path.join(__dirname, '..', 'src', 'hooks', 'use-calendar-events.firebase.ts');
  
  if (fs.existsSync(firebaseCalendarPath)) {
    const firebaseCalendarContent = fs.readFileSync(firebaseCalendarPath, 'utf8');
    fs.writeFileSync(calendarHookPath, firebaseCalendarContent);
    console.log('✅ Calendar events hook updated to use Firebase');
  }

  // Update package.json to remove Supabase dependency
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  const removeSupabase = await question('\nRemove Supabase dependency from package.json? (y/n): ');
  if (removeSupabase.toLowerCase() === 'y') {
    delete packageJson.dependencies['@supabase/supabase-js'];
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log('✅ Supabase dependency removed from package.json');
  }

  // Create backup of Supabase files
  const backupSupabase = await question('\nCreate backup of Supabase integration files? (y/n): ');
  if (backupSupabase.toLowerCase() === 'y') {
    const backupDir = path.join(__dirname, '..', 'backup-supabase');
    const supabaseDir = path.join(__dirname, '..', 'src', 'integrations', 'supabase');
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Copy Supabase files to backup
    if (fs.existsSync(supabaseDir)) {
      const files = fs.readdirSync(supabaseDir);
      files.forEach(file => {
        const sourcePath = path.join(supabaseDir, file);
        const destPath = path.join(backupDir, file);
        fs.copyFileSync(sourcePath, destPath);
      });
      console.log('✅ Supabase files backed up to backup-supabase/');
    }
  }

  // Final migration flags update
  console.log('\n🚀 Finalizing migration flags...');
  
  let finalFlagsContent = flagsContent
    .replace('USE_FIREBASE_AUTH: false', 'USE_FIREBASE_AUTH: true')
    .replace('USE_FIREBASE_CALENDAR: false', 'USE_FIREBASE_CALENDAR: true')
    .replace('USE_FIREBASE_TODOS: false', 'USE_FIREBASE_TODOS: true')
    .replace('USE_FIREBASE_AI_FUNCTIONS: false', 'USE_FIREBASE_AI_FUNCTIONS: true');

  fs.writeFileSync(flagsPath, finalFlagsContent);
  console.log('✅ All Firebase features enabled in migration flags');

  // Create completion marker
  const completionMarker = {
    migrationCompleted: true,
    completedAt: new Date().toISOString(),
    features: enabledFeatures,
    version: '1.0.0'
  };

  fs.writeFileSync(
    path.join(__dirname, '..', '.firebase-migration-complete'),
    JSON.stringify(completionMarker, null, 2)
  );

  console.log('\n🎉 Firebase Migration Completed Successfully!');
  console.log('\nSummary:');
  console.log(`✅ ${enabledFeatures.length} Firebase features enabled`);
  console.log('✅ Default contexts updated');
  console.log('✅ Migration flags finalized');
  console.log('✅ Completion marker created');
  
  console.log('\nNext steps:');
  console.log('1. Run `npm run dev` to test the fully migrated application');
  console.log('2. Deploy Firebase Functions: `npm run firebase:functions:deploy`');
  console.log('3. Test all functionality thoroughly');
  console.log('4. Update environment variables for production');
  console.log('5. Remove Supabase project if no longer needed');

  console.log('\n🔥 Welcome to Firebase! Your migration is complete.');

  rl.close();
}

completeMigration().catch(console.error);
