#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';

function readValue(prompt, { hidden = false } = {}) {
  return new Promise((resolve, reject) => {
    process.stdout.write(prompt);
    let value = '';
    const input = process.stdin;
    const rawCapable = Boolean(input.isTTY && typeof input.setRawMode === 'function');

    if (!rawCapable || !hidden) {
      input.setEncoding('utf8');
      input.resume();
      const onData = (chunk) => {
        const newline = chunk.search(/[\r\n]/);
        if (newline === -1) {
          value += chunk;
          return;
        }
        value += chunk.slice(0, newline);
        input.off('data', onData);
        input.pause();
        resolve(value.trim());
      };
      input.on('data', onData);
      return;
    }

    input.setRawMode(true);
    input.setEncoding('utf8');
    input.resume();
    const finish = () => {
      input.off('data', onKey);
      input.setRawMode(false);
      input.pause();
      process.stdout.write('\n');
      resolve(value);
    };
    const onKey = (key) => {
      if (key === '\u0003') {
        input.setRawMode(false);
        process.stdout.write('\n');
        reject(new Error('Setup cancelled.'));
      } else if (key === '\r' || key === '\n') {
        finish();
      } else if (key === '\u007f' || key === '\b') {
        if (value.length) {
          value = value.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else if (key >= ' ') {
        value += key;
        process.stdout.write('•');
      }
    };
    input.on('data', onKey);
  });
}

try {
  console.log('\nSecure Adzuna setup');
  console.log('The key stays in this local project and will not be printed.\n');
  const appId = await readValue('Adzuna Application ID: ');
  const appKey = await readValue('Adzuna Application Key (dots appear as you type; press Enter when done): ', { hidden: true });
  if (!/^[A-Za-z0-9_-]+$/.test(appId) || !/^[A-Za-z0-9_-]+$/.test(appKey)) {
    throw new Error('The ID or key contains unexpected characters. Nothing was saved.');
  }
  await writeFile('.env', `ADZUNA_APP_ID=${appId}\nADZUNA_APP_KEY=${appKey}\n`, { mode: 0o600 });
  console.log('✓ Adzuna is configured locally.');
  console.log('✓ .env is excluded from Git.');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
