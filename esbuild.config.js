/* eslint-env node */

import 'dotenv/config';
import esbuild from 'esbuild';
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';

const mode = process.argv[2] || 'development';
const isProduction = mode === 'production';
const isWatch = mode === 'watch';

const envReplacements = {
  'process.env.NODE_ENV': JSON.stringify(mode),
  'process.env.AFFILIATE_AMAZON_TAG': JSON.stringify(process.env.AFFILIATE_AMAZON_TAG ?? ''),
  'process.env.AFFILIATE_EBAY_ID': JSON.stringify(process.env.AFFILIATE_EBAY_ID ?? ''),
  'process.env.AFFILIATE_ADMITAD_ID': JSON.stringify(process.env.AFFILIATE_ADMITAD_ID ?? ''),
  // Firebase configuration
  'process.env.FIREBASE_API_KEY': JSON.stringify(process.env.FIREBASE_API_KEY ?? ''),
  'process.env.FIREBASE_AUTH_DOMAIN': JSON.stringify(process.env.FIREBASE_AUTH_DOMAIN ?? ''),
  'process.env.FIREBASE_PROJECT_ID': JSON.stringify(process.env.FIREBASE_PROJECT_ID ?? ''),
  'process.env.FIREBASE_STORAGE_BUCKET': JSON.stringify(process.env.FIREBASE_STORAGE_BUCKET ?? ''),
  'process.env.FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(process.env.FIREBASE_MESSAGING_SENDER_ID ?? ''),
  'process.env.FIREBASE_APP_ID': JSON.stringify(process.env.FIREBASE_APP_ID ?? ''),
};

const buildOptions = {
  entryPoints: [
    'src/service-worker.ts',
    'src/content-script.ts',
    'src/popup/popup.ts',
  ],
  bundle: true,
  outdir: 'dist',
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: isProduction,
  sourcemap: !isProduction,
  logLevel: 'info',
  define: envReplacements,
};

// Copy static files
function copyStatic() {
  const staticFiles = [
    { from: 'src/manifest.json', to: 'dist/manifest.json' },
    { from: 'src/popup/popup.html', to: 'dist/popup/popup.html' },
    { from: 'src/popup/styles.css', to: 'dist/popup/styles.css' },
  ];

  staticFiles.forEach(({ from, to }) => {
    const toDir = dirname(to);
    if (!existsSync(toDir)) {
      mkdirSync(toDir, { recursive: true });
    }
    if (existsSync(from)) {
      copyFileSync(from, to);
      console.log(`✓ Copied ${from} → ${to}`);
    }
  });

  // Copy icons if they exist
  const iconsDir = 'src/popup/icons';
  if (existsSync(iconsDir)) {
    const distIconsDir = 'dist/popup/icons';
    if (!existsSync(distIconsDir)) {
      mkdirSync(distIconsDir, { recursive: true });
    }
    const icons = readdirSync(iconsDir);
    icons.forEach(icon => {
      const iconPath = join(iconsDir, icon);
      if (statSync(iconPath).isFile() && !icon.startsWith('.')) {
        copyFileSync(iconPath, join(distIconsDir, icon));
        console.log(`✓ Copied ${iconPath} → ${join(distIconsDir, icon)}`);
      }
    });
  }
}

async function build() {
  try {
    if (isWatch) {
      const ctx = await esbuild.context(buildOptions);
      await ctx.watch();
      console.log('👀 Watching for changes...');
      copyStatic();
    } else {
      await esbuild.build(buildOptions);
      copyStatic();
      console.log(`✅ Build complete (${mode})`);
    }
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();
