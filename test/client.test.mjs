// Unit tests against the real response shapes of aigifmaker.ai (mocked transport; no network).
import test from 'node:test';
import assert from 'node:assert/strict';
import { submit, getStatus, credits, waitFor, setFetch, AigifmakerError } from '../dist/client.js';

process.env.AIGIFMAKER_API_KEY = 'sk-test';
const json = (body) => new Response(JSON.stringify(body), { status: 200 });
const reply = (body) => async () => json(body);
const ok = (data) => ({ code: 0, message: 'ok', data });

test('submit sends the fixed body and returns data.id', async () => {
  let seen;
  setFetch(async (url, init) => {
    seen = { url, body: JSON.parse(init.body), auth: init.headers.authorization };
    return json(ok({ id: 't1', status: 'pending', taskId: 'up-1' }));
  });
  assert.equal(await submit('a dancing cat'), 't1');
  assert.equal(seen.url, 'https://aigifmaker.ai/api/ai/generate');
  assert.deepEqual(seen.body, { provider: 'openlux', mediaType: 'image', model: 'gif-maker-v1', scene: 'text-to-image', prompt: 'a dancing cat', options: { output_format: 'gif' } });
  assert.equal(seen.auth, 'Bearer sk-test');
});

test('success: waitFor polls until images[0]', async () => {
  let n = 0;
  setFetch(async (url, init) => {
    assert.deepEqual(JSON.parse(init.body), { taskId: 't1' });
    return json(ok(++n < 3 ? { id: 't1', status: 'processing' } : { id: 't1', status: 'success', images: ['https://cdn/x.gif'], watermarked: [false] }));
  });
  assert.equal(await waitFor('t1', { intervalMs: 1 }), 'https://cdn/x.gif');
  assert.equal(n, 3);
});

test('queued: keeps polling while queued', async () => {
  const seq = [
    { id: 't1', status: 'processing', queued: true, queueEta: 40 },
    { id: 't1', status: 'processing', queued: true, queueEta: 3 },
    { id: 't1', status: 'success', images: ['https://cdn/q.gif'], watermarked: [true] },
  ];
  setFetch(async () => json(ok(seq.shift())));
  assert.equal(await waitFor('t1', { intervalMs: 1 }), 'https://cdn/q.gif');
});

test('failed carries errorMessage; moderation is rejected', async () => {
  setFetch(reply(ok({ id: 't1', status: 'failed', errorMessage: 'upstream error', refundNote: 'refunded' })));
  await assert.rejects(waitFor('t1', { intervalMs: 1 }), (e) => e.kind === 'failed' && e.message === 'upstream error');
  setFetch(reply(ok({ id: 't1', status: 'failed', errorMessage: 'blocked', failureKind: 'moderation' })));
  await assert.rejects(waitFor('t1', { intervalMs: 1 }), (e) => e.kind === 'rejected');
});

for (const [name, body, kind] of [
  ['invalid key', { code: -1, message: 'invalid API key — create one at https://aigifmaker.ai/settings/apikeys' }, 'auth'],
  ['wall', ok({ wall: true, reason: 'anon_credits', cost: 1, remaining: 0, grant: 0 }), 'auth'],
  ['insufficient credits', { code: -1, message: 'insufficient credits' }, 'quota'],
  ['cooldown', { code: -2, message: 'slow down' }, 'rejected'],
  ['other refusal', { code: -1, message: 'prompt too long' }, 'other'],
]) {
  test(`submit ${name} -> ${kind}`, async () => {
    setFetch(reply(body));
    await assert.rejects(submit('x'), (e) => e instanceof AigifmakerError && e.kind === kind);
  });
}

test('getStatus returns the task', async () => {
  setFetch(reply(ok({ id: 't1', status: 'pending' })));
  assert.equal((await getStatus('t1')).status, 'pending');
});

test('credits ok and code -1 refusal', async () => {
  setFetch(reply(ok({ remainingCredits: 42, made: 3 })));
  assert.equal(await credits(), 42);
  setFetch(reply({ code: -1, message: 'no auth, please sign in' }));
  await assert.rejects(credits(), (e) => e.kind === 'auth');
});
