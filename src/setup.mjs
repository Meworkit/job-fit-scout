#!/usr/bin/env node
import { access, copyFile, mkdir } from 'node:fs/promises';

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

await mkdir('config', { recursive: true });
await mkdir('private', { recursive: true });
if (!(await exists('config/user.json'))) {
  await copyFile('config/user.example.json', 'config/user.json');
  console.log('✓ Created private configuration: config/user.json');
} else {
  console.log('✓ Private configuration already exists');
}

if (!(await exists('private/cv.md'))) {
  console.log('○ Add your CV as private/cv.md before searching');
} else {
  console.log('✓ Private CV found');
}

console.log('✓ Private files are excluded from Git');

