// Test script to verify Gemini API connection
import https from 'https';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read API key from .env file
let GEMINI_API_KEY = '';
try {
  const envPath = `${__dirname}/../.env`;
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/VITE_GEMINI_API_KEY=(.+)/);
  if (match) {
    GEMINI_API_KEY = match[1].trim();
  }
} catch (error) {
  console.error('❌ Could not read .env file');
}

if (!GEMINI_API_KEY) {
  GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY || '';
}

console.log('🧪 Testing Gemini API Connection...\n');

if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
  console.error('❌ No valid API key found!');
  console.log('💡 Set VITE_GEMINI_API_KEY in your .env file');
  process.exit(1);
}

console.log('📋 API Key:', GEMINI_API_KEY.substring(0, 10) + '...');

const testData = JSON.stringify({
  contents: [{
    parts: [{
      text: 'Say "Hello from Malleabite!" if you can read this.'
    }]
  }]
});

const options = {
  hostname: 'generativelanguage.googleapis.com',
  path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': testData.length
  }
};

console.log('🚀 Sending test request...\n');

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      
      if (response.error) {
        console.error('❌ API Error:', response.error.message);
        console.log('\n💡 Common issues:');
        console.log('   • Invalid API key');
        console.log('   • API key not enabled for Gemini API');
        console.log('   • Quota exceeded (check: https://aistudio.google.com/)');
        process.exit(1);
      }
      
      if (response.candidates && response.candidates[0]) {
        const text = response.candidates[0].content.parts[0].text;
        console.log('✅ API Connection Successful!\n');
        console.log('📝 Response:', text);
        console.log('\n🎉 Mally AI is ready to use!');
        console.log('\n📊 Check your usage at: https://aistudio.google.com/');
        console.log('\n🚀 Deploy to Firebase:');
        console.log('   npm run mally:setup  (set secret)');
        console.log('   npm run mally:deploy (deploy functions)');
      } else {
        console.error('❌ Unexpected response format:', JSON.stringify(response, null, 2));
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Failed to parse response:', error.message);
      console.log('Raw response:', data);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Network Error:', error.message);
  console.log('\n💡 Check your internet connection');
  process.exit(1);
});

req.write(testData);
req.end();
