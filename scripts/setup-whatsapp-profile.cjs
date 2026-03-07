#!/usr/bin/env node
/**
 * WhatsApp Business Profile Setup Script
 * 
 * Configures the bot's profile on WhatsApp (name, about, description).
 * Run: node scripts/setup-whatsapp-profile.js
 * 
 * Requirements:
 *   - WHATSAPP_ACCESS_TOKEN env variable (or pass as argument)
 *   - WHATSAPP_PHONE_NUMBER_ID env variable (or pass as argument)
 */

const https = require('https');

// ─── Configuration ────────────────────────────────────────────────────────────

const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || process.argv[2];
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || process.argv[3];

if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
  console.error('Usage:');
  console.error('  WHATSAPP_ACCESS_TOKEN=xxx WHATSAPP_PHONE_NUMBER_ID=yyy node scripts/setup-whatsapp-profile.js');
  console.error('  OR');
  console.error('  node scripts/setup-whatsapp-profile.js <ACCESS_TOKEN> <PHONE_NUMBER_ID>');
  process.exit(1);
}

// ─── Profile Data ─────────────────────────────────────────────────────────────

const profileData = {
  messaging_product: 'whatsapp',
  about: 'Your AI calendar assistant ✨',  // max 139 chars
  description:
    'Mally by Malleabite — manage your calendar, track todos, and chat with AI, all from WhatsApp. ' +
    'Link your account to get started. Visit malleabite.vercel.app for more.',  // max 512 chars
  websites: ['https://malleabite.vercel.app'],
};

// ─── API Call ─────────────────────────────────────────────────────────────────

const postData = JSON.stringify(profileData);

const options = {
  hostname: 'graph.facebook.com',
  port: 443,
  path: `/v21.0/${PHONE_NUMBER_ID}/whatsapp_business_profile`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
  },
};

console.log('🔧 Updating WhatsApp Business Profile...\n');
console.log('Profile data:');
console.log(`  About: "${profileData.about}"`);
console.log(`  Description: "${profileData.description}"`);
console.log(`  Website: ${profileData.websites[0]}`);
console.log();

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (json.success) {
        console.log('✅ Profile updated successfully!');
        console.log('\nNext steps:');
        console.log('  1. Open Meta Business Suite → WhatsApp Manager');
        console.log('  2. Go to Phone Numbers → your number → Profile');
        console.log('  3. Upload a profile picture (the API requires a resumable upload)');
        console.log('  4. Set the Display Name (requires Meta approval for changes)');
      } else {
        console.error('❌ Failed:', JSON.stringify(json, null, 2));
      }
    } catch {
      console.error('❌ Response:', data);
    }
  });
});

req.on('error', (err) => {
  console.error('❌ Request error:', err.message);
});

req.write(postData);
req.end();
