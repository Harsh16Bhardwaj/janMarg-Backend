// scripts/create-netlify-function.js - Build script for Netlify deployment
import fs from 'fs';

console.log('🔧 Building for Netlify deployment...');

// Ensure netlify/functions directory exists
const functionsDir = 'netlify/functions';
if (!fs.existsSync(functionsDir)) {
  fs.mkdirSync(functionsDir, { recursive: true });
  console.log('📁 Created netlify/functions directory');
}

// Check if api.js exists
if (fs.existsSync('netlify/functions/api.js')) {
  console.log('✅ Netlify function already exists at netlify/functions/api.js');
} else {
  console.log('❌ Netlify function missing at netlify/functions/api.js');
  process.exit(1);
}

console.log('✨ Build completed successfully!');