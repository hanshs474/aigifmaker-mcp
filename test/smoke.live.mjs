// Free live smoke tests against https://aigifmaker.ai. No generation runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { credits, submit } from '../dist/client.js';

test('invalid key -> auth', async () => {
  process.env.AIGIFMAKER_API_KEY = 'sk-invalidtest000';
  await assert.rejects(credits(), (e) => e.kind === 'auth');
});

test('no key -> wall -> auth', async () => {
  delete process.env.AIGIFMAKER_API_KEY;
  await assert.rejects(submit('smoke test: a blinking star'), (e) => e.kind === 'auth');
});
