#!/usr/bin/env node
/**
 * Downloads the Porcupine acoustic model (porcupine_params.pv) to public/
 * so the browser can load it at runtime without bundling a 2 MB binary.
 *
 * Usage:  npm run setup:porcupine
 *
 * The file is cached — re-running is a no-op if the file already exists.
 */
'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const DEST = path.join(__dirname, '..', 'public', 'porcupine-params.pv');

// Official Picovoice repository — same file that @picovoice/porcupine-web
// uses internally, served from GitHub raw content.
const MODEL_URL =
  'https://raw.githubusercontent.com/Picovoice/porcupine/master/lib/common/porcupine_params.pv';

if (fs.existsSync(DEST)) {
  const kb = (fs.statSync(DEST).size / 1024).toFixed(0);
  console.log(`[setup:porcupine] Already present: public/porcupine-params.pv (${kb} KB) — skipping.`);
  process.exit(0);
}

console.log('[setup:porcupine] Downloading Porcupine acoustic model…');
console.log(`  Source : ${MODEL_URL}`);
console.log(`  Dest   : ${DEST}`);

fs.mkdirSync(path.dirname(DEST), { recursive: true });

const file = fs.createWriteStream(DEST);

function download(url, redirects = 0) {
  if (redirects > 5) {
    console.error('[setup:porcupine] Too many redirects.');
    process.exit(1);
  }
  https.get(url, (res) => {
    if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
      return download(res.headers.location, redirects + 1);
    }
    if (res.statusCode !== 200) {
      console.error(`[setup:porcupine] HTTP ${res.statusCode} — download failed.`);
      fs.unlinkSync(DEST);
      process.exit(1);
    }
    res.pipe(file);
    file.on('finish', () => {
      file.close();
      const kb = (fs.statSync(DEST).size / 1024).toFixed(0);
      console.log(`[setup:porcupine] Done — public/porcupine-params.pv (${kb} KB)`);
      console.log('');
      console.log('Next steps:');
      console.log('  1. Copy .env.local.example → .env.local');
      console.log('  2. Set VITE_PICOVOICE_ACCESS_KEY (free from https://console.picovoice.ai)');
      console.log('  3. Train "Hey Mally" at https://console.picovoice.ai → Wake Word');
      console.log('  4. Download the .ppn file, base64-encode it, set VITE_PICOVOICE_KEYWORD_B64');
    });
  }).on('error', (err) => {
    fs.unlinkSync(DEST);
    console.error('[setup:porcupine] Network error:', err.message);
    process.exit(1);
  });
}

download(MODEL_URL);
