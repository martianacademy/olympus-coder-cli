import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.env.OLYMPUS_SECRET_STORE = 'file';
const APP = dirname(dirname(fileURLToPath(import.meta.url)));
const { client, methods, PROTOCOL_VERSION } = await import(
  pathToFileURL(join(APP, 'node_modules/@agentclientprotocol/sdk/dist/v1/unstable/acp.js')).href
);
const {
  applyContextPrunePlan,
  CLOUD_CACHE_TTL_MS,
  createOlympusAgentApp,
  decideContextPruneFlush,
  extractFileSymbols,
  isCachedCloudEndpoint,
  planContextPrune,
  setOlympusSharedDir,
} = await import(pathToFileURL(join(APP, 'dist/index.js')).href);

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  PASS  ${name}`);
  } catch (err) {
    results.push({ name, ok: false, err });
    console.error(`  FAIL  ${name}:`, err);
  }
}

const bigBody = (tag, lines = 80) =>
  `1 | export interface ${tag}Config { enabled: boolean; }\n2 | export function run${tag}() { return true; }\n` +
  Array.from({ length: lines }, (_, i) => `${i + 3} | // ${tag} implementation line ${i + 3} with realistic details`).join('\n');

await test('planContextPrune handles explicit read_on_demand, pinned false, auto-superseded edits, aged reads, and bulky run_command', () => {
  const messages = [
    // Turn 1: reads 4 files (1 explicit read_on_demand+note, 1 pinned false, 1 edited later, 1 unreferenced big file) + bulky command
    { role: 'user', content: 'Inspect files and run tests' },
    {
      role: 'assistant',
      content: null,
      tool_calls: [
        { id: 'c1', type: 'function', function: { name: 'read_file', arguments: JSON.stringify({ path: 'src/config.ts', read_on_demand: true, note: 'App config only; no billing logic' }) } },
        { id: 'c2', type: 'function', function: { name: 'read_file', arguments: JSON.stringify({ path: 'src/pinned.ts', read_on_demand: false }) } },
        { id: 'c3', type: 'function', function: { name: 'read_file', arguments: JSON.stringify({ path: 'src/billing.ts' }) } },
        { id: 'c4', type: 'function', function: { name: 'read_file', arguments: JSON.stringify({ path: 'src/router.ts' }) } },
        { id: 'c5', type: 'function', function: { name: 'run_command', arguments: JSON.stringify({ command: 'npm test' }) } },
      ],
    },
    { role: 'tool', tool_call_id: 'c1', name: 'read_file', content: bigBody('Config', 60) },
    { role: 'tool', tool_call_id: 'c2', name: 'read_file', content: bigBody('Pinned', 60) },
    { role: 'tool', tool_call_id: 'c3', name: 'read_file', content: bigBody('Billing', 60) },
    { role: 'tool', tool_call_id: 'c4', name: 'read_file', content: bigBody('Router', 60) },
    { role: 'tool', tool_call_id: 'c5', name: 'run_command', content: Array.from({ length: 80 }, (_, i) => `PASS tests/suite_${i}.unit.mjs — verified assertions and assertions summary #${i}`).join('\n') + '\nexit code: 0\nALL_OK' },
    { role: 'assistant', content: 'The bug is in src/billing.ts. Everything else looks fine.' },
    // Turn 2: edits billing.ts
    { role: 'user', content: 'Fix src/billing.ts' },
    {
      role: 'assistant',
      content: null,
      tool_calls: [
        { id: 'c6', type: 'function', function: { name: 'edit_file', arguments: JSON.stringify({ path: 'src/billing.ts', old_string: 'a', new_string: 'b' }) } },
      ],
    },
    { role: 'tool', tool_call_id: 'c6', name: 'edit_file', content: 'Edited src/billing.ts' },
    { role: 'assistant', content: 'Fixed src/billing.ts.' },
    // Turn 3 starts
    { role: 'user', content: 'Now summarize the change' },
  ];

  const syms = extractFileSymbols(bigBody('Config', 5));
  assert.deepEqual(syms, ['ConfigConfig', 'runConfig']);

  // If the new user prompt explicitly names a read_on_demand file, keep it warm for this turn to avoid a redundant re-read
  const keepMentioned = planContextPrune(messages, 'Please check src/config.ts right now');
  assert.equal(keepMentioned.candidates.some((c) => c.toolCallId === 'c1'), false, 'prompt-mentioned read_on_demand file stays warm');

  const plan = planContextPrune(messages, 'Now summarize the change');
  const byId = new Map(plan.candidates.map((c) => [c.toolCallId, c]));

  assert.equal(byId.get('c1')?.reason, 'read_on_demand');
  assert.match(byId.get('c1').replacement, /\[Read on demand: src\/config\.ts/);
  assert.match(byId.get('c1').replacement, /Note: App config only; no billing logic/);
  assert.match(byId.get('c1').replacement, /symbols: ConfigConfig, runConfig/);

  assert.equal(byId.has('c2'), false, 'read_on_demand: false pins the file in context');
  assert.equal(byId.get('c3')?.reason, 'superseded', 'edited file read is automatically superseded');
  assert.match(byId.get('c3').replacement, /\[Superseded read: src\/billing\.ts/);
  assert.equal(byId.get('c4')?.reason, 'aged_read', 'unreferenced large file collapses automatically');
  assert.equal(byId.get('c5')?.reason, 'aged_tool', 'old bulky run_command collapses to 1-line receipt');
  assert.match(byId.get('c5').replacement, /exit 0/);

  const stats = applyContextPrunePlan(messages, plan, 'local_turn_boundary');
  assert.equal(stats.prunedToolCount, 4);
  assert.ok(stats.savedTokensEstimate > 2500);

  // Idempotency: re-running planContextPrune finds 0 new candidates
  const second = planContextPrune(messages, 'Now summarize the change');
  assert.equal(second.candidates.length, 0);
});

await test('decideContextPruneFlush protects warm cloud KV caches while flushing immediately on local LM Studio / Ollama and at free cloud boundaries', () => {
  assert.equal(isCachedCloudEndpoint('ollama', 'http://127.0.0.1:11434/v1'), false);
  assert.equal(isCachedCloudEndpoint('openai-compatible', 'http://127.0.0.1:1234/v1'), false);
  assert.equal(isCachedCloudEndpoint('anthropic', 'https://api.anthropic.com/v1'), true);
  assert.equal(isCachedCloudEndpoint('openrouter', 'https://openrouter.ai/api/v1'), true);
  assert.equal(isCachedCloudEndpoint('olympus-cloud', 'https://olympus-cloud.olympus-relay.workers.dev/v1'), true);

  const mockPlan = (tokens) => ({
    candidates: [{ messageIndex: 2, toolCallId: 'x', toolName: 'read_file', reason: 'read_on_demand', originalChars: tokens * 4, replacement: '[short]', savedChars: tokens * 3.5 }],
    reclaimableChars: tokens * 3.5,
    reclaimableTokens: tokens,
  });

  const now = 1_000_000;
  // 1. Local LM Studio: flush immediately at turn boundary
  assert.deepEqual(
    decideContextPruneFlush({ flavor: 'openai-compatible', baseUrl: 'http://127.0.0.1:1234/v1', lastLlmCallAt: now - 10_000, nowMs: now, usedTokens: 12_000, contextSize: 32_768, plan: mockPlan(4_000) }),
    { flush: true, reason: 'local_turn_boundary' },
  );

  // 2. Cloud Anthropic warm cache (<5 min, <65% ctx, <15k reclaim): DO NOT BUST CACHE
  assert.deepEqual(
    decideContextPruneFlush({ flavor: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', lastLlmCallAt: now - 30_000, nowMs: now, usedTokens: 60_000, contextSize: 1_000_000, plan: mockPlan(5_000) }),
    { flush: false, reason: 'preserve_warm_cache' },
  );

  // 3. Cloud Anthropic cache TTL expired (>=5 min): 100% FREE FLUSH
  assert.deepEqual(
    decideContextPruneFlush({ flavor: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', lastLlmCallAt: now - CLOUD_CACHE_TTL_MS - 1_000, nowMs: now, usedTokens: 60_000, contextSize: 1_000_000, plan: mockPlan(5_000) }),
    { flush: true, reason: 'cache_ttl_expired' },
  );

  // 4. Cloud OpenRouter >= 65% context watermark: surgical flush before lossy /compact
  assert.deepEqual(
    decideContextPruneFlush({ flavor: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', lastLlmCallAt: now - 10_000, nowMs: now, usedTokens: 140_000, contextSize: 200_000, plan: mockPlan(5_000) }),
    { flush: true, reason: 'context_watermark' },
  );

  // 5. Cloud reclaim break-even (>=15k tokens AND >=35% of prompt)
  assert.deepEqual(
    decideContextPruneFlush({ flavor: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', lastLlmCallAt: now - 10_000, nowMs: now, usedTokens: 40_000, contextSize: 1_000_000, plan: mockPlan(18_000) }),
    { flush: true, reason: 'reclaim_breakeven' },
  );
});

await test('End-to-end ACP multi-turn session on local endpoint prunes stale reads between turns, preserves /status stats, and keeps plan<->code tools cache-stable', async () => {
  const sse = (frames) =>
    new Response(frames.map((f) => (f === '[DONE]' ? 'data: [DONE]\n\n' : `data: ${JSON.stringify(f)}\n\n`)).join(''), {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });

  const capturedBodies = [];
  let callNum = 0;
  const prevFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.endsWith('/models')) {
      return Response.json({ data: [{ id: 'local-qwen', context_length: 32768 }] });
    }
    const body = JSON.parse(String(init.body || '{}'));
    capturedBodies.push(body);
    callNum++;
    if (callNum === 1) {
      return sse([
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  { index: 0, id: 'tc_a', type: 'function', function: { name: 'read_file', arguments: JSON.stringify({ path: 'a.ts', read_on_demand: true, note: 'Unrelated helper' }) } },
                  { index: 1, id: 'tc_b', type: 'function', function: { name: 'read_file', arguments: JSON.stringify({ path: 'b.ts' }) } },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
          usage: { prompt_tokens: 500, completion_tokens: 40, total_tokens: 540 },
        },
        '[DONE]',
      ]);
    }
    if (callNum === 2) {
      return sse([
        { choices: [{ delta: { content: 'Bug is in b.ts.' }, finish_reason: 'stop' }], usage: { prompt_tokens: 4500, completion_tokens: 20, total_tokens: 4520 } },
        '[DONE]',
      ]);
    }
    return sse([
      { choices: [{ delta: { content: 'All done.' }, finish_reason: 'stop' }], usage: { prompt_tokens: 900, completion_tokens: 15, total_tokens: 915 } },
      '[DONE]',
    ]);
  };

  const tmp = mkdtempSync(join(tmpdir(), 'oly-prune-e2e-'));
  try {
    const shared = join(tmp, 'shared');
    const ws = join(tmp, 'ws');
    mkdirSync(ws, { recursive: true });
    writeFileSync(join(ws, 'a.ts'), bigBody('Alpha', 90));
    writeFileSync(join(ws, 'b.ts'), bigBody('Beta', 90));
    setOlympusSharedDir(shared);

    const updates = [];
    const app = createOlympusAgentApp({
      env: { OLYMPUS_SHARED_DIR: shared, OLYMPUS_DISABLE_OLLAMA_PROBE: '1', OLYMPUS_BASE_URL: 'http://127.0.0.1:1234/v1', OLYMPUS_MODEL: 'local-qwen' },
      version: '0.2.0',
    });
    const conn = client({ name: 'prune-e2e' })
      .onNotification(methods.client.session.update, ({ params }) => updates.push(params.update))
      .onNotification(methods.client.auth.statusUpdate, () => {})
      .connect(app);

    await conn.agent.request(methods.agent.initialize, { protocolVersion: PROTOCOL_VERSION, clientCapabilities: {}, clientInfo: { name: 't', version: '0' } });
    const s = await conn.agent.request(methods.agent.session.new, { cwd: ws, mcpServers: [] });

    // Turn 1: reads a.ts (read_on_demand: true) and b.ts
    await conn.agent.request(methods.agent.session.prompt, { sessionId: s.sessionId, prompt: [{ type: 'text', text: 'Check a.ts and b.ts' }] });
    // Toggle mode to plan and run Turn 2: a.ts collapses to 1-line receipt, while tools array stays identical (cache-stable)!
    await conn.agent.request(methods.agent.session.setConfigOption, { sessionId: s.sessionId, configId: 'mode', value: 'plan' });
    await conn.agent.request(methods.agent.session.prompt, { sessionId: s.sessionId, prompt: [{ type: 'text', text: 'Summarize b.ts' }] });

    const turn1Step2Body = capturedBodies[1];
    const turn2Body = capturedBodies[2];
    const aToolTurn1 = turn1Step2Body.messages.find((m) => m.tool_call_id === 'tc_a');
    const aToolTurn2 = turn2Body.messages.find((m) => m.tool_call_id === 'tc_a');
    const bToolTurn2 = turn2Body.messages.find((m) => m.tool_call_id === 'tc_b');

    assert.ok(aToolTurn1.content.length > 4000, 'Turn 1 sees full a.ts body');
    assert.match(aToolTurn2.content, /^\[Read on demand: a\.ts/, 'Turn 2 collapses read_on_demand a.ts');
    assert.match(aToolTurn2.content, /Note: Unrelated helper/);
    assert.ok(bToolTurn2.content.length > 4000, 'b.ts stayed warm because Turn 1 reply & Turn 2 prompt referenced b.ts');
    assert.equal(turn2Body.tools.length, turn1Step2Body.tools.length, 'plan <-> code toggle preserves exact tool list for prompt caching');

    // /status displays Context Pruner stats
    updates.length = 0;
    await conn.agent.request(methods.agent.session.prompt, { sessionId: s.sessionId, prompt: [{ type: 'text', text: '/status' }] });
    const statusMd = updates.filter((u) => u.sessionUpdate === 'agent_message_chunk').map((u) => u.content?.text ?? '').join('');
    assert.match(statusMd, /\*\*Context Pruner\*\*: 1 stale tool outputs collapsed/);
    conn.close();
  } finally {
    globalThis.fetch = prevFetch;
    rmSync(tmp, { recursive: true, force: true });
  }
});

const failed = results.filter((r) => !r.ok);
console.log(`\nContext Pruner suite: ${results.length - failed.length}/${results.length} passed.`);
if (failed.length) process.exit(1);
