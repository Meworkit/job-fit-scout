#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';

function readHidden(prompt) {
  return new Promise((resolve, reject) => {
    process.stdout.write(prompt);
    const input = process.stdin;
    let value = '';
    const rawCapable = Boolean(input.isTTY && typeof input.setRawMode === 'function');
    input.setEncoding('utf8');
    input.resume();

    const finish = () => {
      input.off('data', onKey);
      if (rawCapable) input.setRawMode(false);
      input.pause();
      process.stdout.write('\n');
      resolve(value.trim());
    };
    const onKey = (key) => {
      if (key === '\u0003') {
        if (rawCapable) input.setRawMode(false);
        reject(new Error('Setup cancelled.'));
      } else if (key.includes('\r') || key.includes('\n')) {
        value += key.split(/[\r\n]/)[0];
        finish();
      } else if (key === '\u007f' || key === '\b') {
        if (value.length) {
          value = value.slice(0, -1);
          if (rawCapable) process.stdout.write('\b \b');
        }
      } else {
        value += key;
        if (rawCapable) process.stdout.write('•'.repeat([...key].length));
      }
    };
    if (rawCapable) input.setRawMode(true);
    input.on('data', onKey);
  });
}

try {
  console.log('\nSecure Jooble setup');
  console.log('The API key stays in this local project and will not be printed.\n');
  const apiKey = await readHidden('Jooble API Key (dots appear; press Enter when done): ');
  if (!/^[A-Za-z0-9_-]+$/.test(apiKey)) throw new Error('The key contains unexpected characters. Nothing was saved.');
  let existing = '';
  try {
    existing = await readFile('.env', 'utf8');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const lines = existing.split(/\r?\n/).filter((line) => line && !line.startsWith('JOOBLE_API_KEY='));
  lines.push(`JOOBLE_API_KEY=${apiKey}`);
  await writeFile('.env', `${lines.join('\n')}\n`, { mode: 0o600 });
  console.log('✓ Jooble is configured locally.');
  console.log('✓ .env is excluded from Git.');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

