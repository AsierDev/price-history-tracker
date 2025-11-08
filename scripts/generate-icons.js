/**
 * Generate placeholder icons for the extension
 * Run: node scripts/generate-icons.js
 * 
 * Note: This creates simple colored squares as placeholders.
 * Replace with proper icons before production.
 */

import { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sizes = [16, 48, 128];
const outputDir = join(__dirname, '../src/popup/icons');

// Ensure output directory exists
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#667eea');
  gradient.addColorStop(1, '#764ba2');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Add emoji/text
  ctx.fillStyle = 'white';
  ctx.font = `bold ${size * 0.6}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('💰', size / 2, size / 2);

  // Save
  const buffer = canvas.toBuffer('image/png');
  const filename = join(outputDir, `icon${size}.png`);
  writeFileSync(filename, buffer);
  console.log(`✓ Generated ${filename}`);
}

// Generate all sizes
sizes.forEach(generateIcon);

console.log('\n✅ All icons generated successfully!');
console.log('📝 Note: These are placeholder icons. Replace with proper designs before production.');
