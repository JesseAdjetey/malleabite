// List available Gemini models
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

console.log('🔍 Listing available Gemini models...\n');
console.log('📋 API Key:', GEMINI_API_KEY.substring(0, 10) + '...\n');

const options = {
  hostname: 'generativelanguage.googleapis.com',
  path: `/v1beta/models?key=${GEMINI_API_KEY}`,
  method: 'GET',
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      
      if (response.error) {
        console.error('❌ Error:', response.error.message);
        process.exit(1);
      }
      
      if (response.models) {
        console.log('✅ Available models:\n');
        response.models.forEach(model => {
          const supportsMethods = model.supportedGenerationMethods || [];
          if (supportsMethods.includes('generateContent')) {
            console.log(`  ✓ ${model.name}`);
            console.log(`    Display: ${model.displayName}`);
            console.log(`    Input limit: ${model.inputTokenLimit || 'N/A'} tokens`);
            console.log(`    Output limit: ${model.outputTokenLimit || 'N/A'} tokens\n`);
          }
        });
      }
    } catch (error) {
      console.error('❌ Parse error:', error.message);
      console.log('Raw:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Network error:', error.message);
});

req.end();
