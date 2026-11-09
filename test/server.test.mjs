// The server lists exactly the two tools and answers without a key with a clear error.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../dist/server.js';
import { setFetch } from '../dist/client.js';

async function connect() {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer().connect(a);
  const client = new Client({ name: 't', version: '0' });
  await client.connect(b);
  return client;
}

test('tools/list', async () => {
  const c = await connect();
  const { tools } = await c.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), ['check_credits', 'generate_gif']);
});

test('generate_gif returns the GIF URL', async () => {
  process.env.AIGIFMAKER_API_KEY = 'sk-test';
  setFetch(async (url) => new Response(JSON.stringify(url.endsWith('/api/ai/generate')
    ? { code: 0, message: 'ok', data: { id: 't1', status: 'pending' } }
    : { code: 0, message: 'ok', data: { id: 't1', status: 'success', images: ['https://cdn/x.gif'] } })));
  const c = await connect();
  const r = await c.callTool({ name: 'generate_gif', arguments: { prompt: 'a cat' } });
  assert.ok(!r.isError);
  assert.match(r.content[0].text, /https:\/\/cdn\/x\.gif/);
});

test('no key -> isError with the key link', async () => {
  delete process.env.AIGIFMAKER_API_KEY;
  const c = await connect();
  const r = await c.callTool({ name: 'check_credits', arguments: {} });
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /settings\/apikeys/);
});
