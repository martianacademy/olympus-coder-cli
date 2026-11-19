import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.env.OLYMPUS_SECRET_STORE = 'file';
const APP = dirname(dirname(fileURLToPath(import.meta.url)));

const { client, methods, PROTOCOL_VERSION } = await import(
  pathToFileURL(join(APP, 'node_modules', '@agentclientprotocol', 'sdk', 'dist', 'v1', 'unstable', 'acp.js')).href
);
const {
  ANTHROPIC_DIRECT_MODELS,
  CURATED_MODELS,
  contextSizeForModel,
  createOlympusAgentApp,
  defaultModelForFlavor,
  estimateCostUsd,
  isClaude5AdaptiveModel,
  knownModelPricing,
  setOlympusSharedDir,
  streamChatCompletion,
  upsertProvider,
} = await import(pathToFileURL(join(APP, 'dist', 'index.js')).href);
const { renderCostRows } = await import(pathToFileURL(join(APP, 'dist', 'tui', 'overlays.js')).href);
const { stripAnsi } = await import(pathToFileURL(join(APP, 'dist', 'tui', 'text.js')).href);

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

const approxEqual = (actual, expected, eps = 1e-12) => {
  assert.equal(typeof actual, 'number', `expected number, got ${actual}`);
  assert.ok(Math.abs(actual - expected) <= eps, `expected ${expected}, got ${actual} (diff ${Math.abs(actual - expected)})`);
};

function sseFrames(frames) {
  const text = frames.map((f) => (f === '[DONE]' ? 'data: [DONE]\n\n' : `data: ${JSON.stringify(f)}\n\n`)).join('');
  return new Response(text, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

function countCacheControls(payload) {
  let count = 0;
  for (const s of payload.system ?? []) if (s?.cache_control) count++;
  for (const m of payload.messages ?? []) for (const b of m.content ?? []) if (b?.cache_control) count++;
  return count;
}

await test('Model catalogs, defaults, and contextSizeForModel reflect Claude 5.5 (1M) & Fable 5.2', () => {
  assert.equal(defaultModelForFlavor('anthropic'), 'claude-sonnet-5-5');
  assert.equal(defaultModelForFlavor('anthropic', undefined, 'anthropic/claude-sonnet-4.5'), 'claude-sonnet-5-5');
  assert.equal(defaultModelForFlavor('openrouter'), 'anthropic/claude-sonnet-5.5');
  assert.equal(defaultModelForFlavor('ai-gateway'), 'anthropic/claude-sonnet-5.5');

  assert.deepEqual(ANTHROPIC_DIRECT_MODELS.slice(0, 4).map((m) => m.id), ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5', 'claude-fable-5-2']);
  assert.deepEqual(ANTHROPIC_DIRECT_MODELS.slice(4, 7).map((m) => m.id), ['claude-sonnet-4-5', 'claude-opus-4-5', 'claude-haiku-4-5']);
  for (const id of ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5']) {
    const entry = ANTHROPIC_DIRECT_MODELS.find((m) => m.id === id);
    assert.equal(entry.contextSize, 1_000_000);
    assert.equal(typeof entry.cacheReadPricePerToken, 'number');
  }
  assert.equal(ANTHROPIC_DIRECT_MODELS.find((m) => m.id === 'claude-fable-5-2').contextSize, 200_000);

  assert.deepEqual(CURATED_MODELS.slice(0, 3).map((m) => m.id), ['anthropic/claude-sonnet-5.5', 'anthropic/claude-opus-5.5', 'anthropic/claude-haiku-5.5']);
  for (const m of CURATED_MODELS.slice(0, 3)) assert.equal(m.contextSize, 1_000_000);

  assert.equal(contextSizeForModel('claude-opus-5-5', []), 1_000_000);
  assert.equal(contextSizeForModel('claude-sonnet-5-5', []), 1_000_000);
  assert.equal(contextSizeForModel('claude-haiku-5-5', []), 1_000_000);
  assert.equal(contextSizeForModel('anthropic/claude-opus-5.5', []), 1_000_000);
  assert.equal(contextSizeForModel('claude-opus-5-5-20261101', []), 1_000_000);
  assert.equal(contextSizeForModel('claude-fable-5-2', []), 200_000);
  assert.equal(contextSizeForModel('claude-sonnet-4-5', []), 200_000);
});

await test('Multi-step Anthropic prompt caching across 3 turns: moving breakpoint, <=2 markers, immutable blocks, separate cache usage', async () => {
  const prevFetch = globalThis.fetch;
  const payloads = [];
  let step = 0;

  globalThis.fetch = async (_input, init = {}) => {
    step++;
    const body = JSON.parse(String(init.body || '{}'));
    payloads.push(body);
    if (step === 1) {
      return sseFrames([
        { type: 'message_start', message: { model: body.model, usage: { input_tokens: 15, cache_creation_input_tokens: 1200, cache_read_input_tokens: 0 } } },
        { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'Step 1 thinking.' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 'sig_step_1' } },
        { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'toolu_1', name: 'read_file' } },
        { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"path":"a.ts"}' } },
        { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 45 } },
        '[DONE]',
      ]);
    }
    if (step === 2) {
      return sseFrames([
        { type: 'message_start', message: { model: body.model, usage: { input_tokens: 10, cache_creation_input_tokens: 350, cache_read_input_tokens: 1200 } } },
        { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'Step 2 thinking.' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 'sig_step_2' } },
        { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'toolu_2', name: 'read_file' } },
        { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"path":"b.ts"}' } },
        { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 50 } },
        '[DONE]',
      ]);
    }
    return sseFrames([
      { type: 'message_start', message: { model: body.model, usage: { input_tokens: 1, cache_creation_input_tokens: 1, cache_read_input_tokens: 1 } } },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'All files inspected.' } },
      { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { input_tokens: 8, cache_creation_input_tokens: 220, cache_read_input_tokens: 1550, output_tokens: 30 } },
      '[DONE]',
    ]);
  };

  try {
    const history = [
      { role: 'system', content: 'You are Olympus.' },
      { role: 'user', content: 'Inspect a.ts and b.ts' },
    ];
    const tools = [{ type: 'function', function: { name: 'read_file', description: 'Read file', parameters: { type: 'object' } } }];
    const baseOpts = { baseUrl: 'https://api.anthropic.com/v1', headers: { 'x-api-key': 'sk-ant-test' }, model: 'claude-sonnet-5-5', providerFlavor: 'anthropic', tools };

    const r1 = await streamChatCompletion({ ...baseOpts, messages: history });
    assert.equal(countCacheControls(payloads[0]), 2);
    assert.deepEqual(payloads[0].system[0].cache_control, { type: 'ephemeral' });
    assert.deepEqual(payloads[0].messages[0].content[0].cache_control, { type: 'ephemeral' });
    assert.equal(r1.usage.inputTokens, 15);
    assert.equal(r1.usage.cachedWriteTokens, 1200);
    assert.equal(r1.usage.cachedReadTokens, 0);
    assert.equal(r1.usage.totalTokens, 1260);

    const step1Blocks = r1.anthropicBlocks.map((b) => ({ ...b }));
    const snapshotStep1 = JSON.stringify(step1Blocks);
    history.push({ role: 'assistant', content: null, tool_calls: r1.toolCalls, anthropicBlocks: step1Blocks });
    history.push({ role: 'tool', tool_call_id: 'toolu_1', name: 'read_file', content: 'export const A = 1;' });

    const r2 = await streamChatCompletion({ ...baseOpts, messages: history });
    assert.equal(countCacheControls(payloads[1]), 2, 'exactly 2 cache_control markers on step 2');
    assert.equal(payloads[1].messages[0].content[0].cache_control, undefined);
    for (const blk of payloads[1].messages[1].content) assert.equal(blk.cache_control, undefined);
    assert.deepEqual(payloads[1].messages[2].content.at(-1).cache_control, { type: 'ephemeral' });
    assert.equal(JSON.stringify(step1Blocks), snapshotStep1, 'm.anthropicBlocks must NEVER be mutated');
    assert.equal(r2.usage.inputTokens, 10);
    assert.equal(r2.usage.cachedWriteTokens, 350);
    assert.equal(r2.usage.cachedReadTokens, 1200);
    assert.equal(r2.usage.totalTokens, 1610);

    // Inject simulated stale cache_control on step2Blocks to verify cloning strips stale markers
    const step2Blocks = r2.anthropicBlocks.map((b, i) => (i === 1 ? { ...b, cache_control: { type: 'ephemeral' } } : { ...b }));
    const snapshotStep2 = JSON.stringify(step2Blocks);
    history.push({ role: 'assistant', content: null, tool_calls: r2.toolCalls, anthropicBlocks: step2Blocks });
    history.push({ role: 'tool', tool_call_id: 'toolu_2', name: 'read_file', content: 'export const B = 2;' });

    const r3 = await streamChatCompletion({ ...baseOpts, messages: history });
    assert.equal(countCacheControls(payloads[2]), 2, 'stale cache_control stripped; total stays === 2 on step 3');
    assert.deepEqual(payloads[2].system[0].cache_control, { type: 'ephemeral' });
    assert.deepEqual(payloads[2].messages.at(-1).content.at(-1).cache_control, { type: 'ephemeral' });
    for (const msg of payloads[2].messages.slice(0, -1)) for (const blk of msg.content) assert.equal(blk.cache_control, undefined);
    assert.equal(JSON.stringify(step2Blocks), snapshotStep2, 'step2 anthropicBlocks untouched');
    assert.ok(r3.usage.cachedReadTokens > r2.usage.cachedReadTokens && r2.usage.cachedReadTokens > r1.usage.cachedReadTokens);
    assert.equal(r3.usage.inputTokens, 8);
    assert.equal(r3.usage.cachedWriteTokens, 220);
    assert.equal(r3.usage.cachedReadTokens, 1550);
    assert.equal(r3.usage.outputTokens, 30);
    assert.equal(r3.usage.totalTokens, 1808);
  } finally {
    globalThis.fetch = prevFetch;
  }
});

await test('Claude 5 adaptive thinking, output_config.effort, prefill guard, block-skip rules, and 400 retry fallback', async () => {
  assert.equal(isClaude5AdaptiveModel('claude-opus-5-5'), true);
  assert.equal(isClaude5AdaptiveModel('claude-sonnet-5-5'), true);
  assert.equal(isClaude5AdaptiveModel('claude-fable-5-2'), true);
  assert.equal(isClaude5AdaptiveModel('claude-opus-5-5-20261101'), true);
  assert.equal(isClaude5AdaptiveModel('claude-haiku-5-5'), false);
  assert.equal(isClaude5AdaptiveModel('claude-sonnet-4-5'), false);

  const prevFetch = globalThis.fetch;
  const seen = [];
  let rejectAdaptiveOnce = false;

  globalThis.fetch = async (_input, init = {}) => {
    const body = JSON.parse(String(init.body || '{}'));
    seen.push(body);
    if (rejectAdaptiveOnce && body.thinking) {
      rejectAdaptiveOnce = false;
      return new Response(JSON.stringify({ error: { message: 'Extra inputs are not permitted: output_config / adaptive thinking' } }), { status: 400, headers: { 'content-type': 'application/json' } });
    }
    return sseFrames([
      { type: 'message_start', message: { model: body.model, usage: { input_tokens: 25, cache_creation_input_tokens: 500, cache_creation: { ephemeral_5m_input_tokens: 200, ephemeral_1h_input_tokens: 300 }, cache_read_input_tokens: 100 } } },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Adaptive OK' } },
      { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 12 } },
      '[DONE]',
    ]);
  };

  try {
    const cases = [
      { model: 'claude-opus-5-5', reasoning: 'high', expectedEffort: 'high' },
      { model: 'claude-sonnet-5-5', reasoning: undefined, expectedEffort: 'medium' },
      { model: 'claude-fable-5-2', reasoning: 'none', expectedEffort: 'low' },
      { model: 'claude-opus-5-5', reasoning: 'low', expectedEffort: 'low' },
    ];
    for (const c of cases) {
      seen.length = 0;
      const res = await streamChatCompletion({
        baseUrl: 'https://api.anthropic.com/v1',
        headers: { 'x-api-key': 'sk-ant-5' },
        model: c.model,
        providerFlavor: 'anthropic',
        reasoning: c.reasoning,
        temperature: 0.4,
        tools: [{ type: 'function', function: { name: 'ping', description: 'Ping', parameters: { type: 'object' } } }],
        messages: [
          { role: 'system', content: 'Sys' },
          { role: 'user', content: 'Start task' },
          { role: 'assistant', content: 'Partial', anthropicBlocks: [{ type: 'text', text: 'Partial' }, { type: 'thinking', thinking: 'internal', signature: 'sig1' }] },
        ],
      });
      const b = seen[0];
      assert.deepEqual(b.thinking, { type: 'adaptive' });
      assert.equal(b.thinking.budget_tokens, undefined);
      assert.notEqual(b.thinking.type, 'disabled');
      assert.deepEqual(b.output_config, { effort: c.expectedEffort });
      assert.equal(b.temperature, undefined, 'temperature omitted when thinking active');
      assert.equal(b.tool_choice, undefined, 'no forced tool_choice');
      assert.equal(b.messages.at(-1).role, 'user', 'assistant prefill prevented on Claude 5 adaptive models');
      assert.equal(b.messages.at(-1).content[0].text, 'Continue.');
      assert.deepEqual(b.messages.at(-1).content[0].cache_control, { type: 'ephemeral' });
      assert.equal(countCacheControls(b), 2);
      assert.equal(res.usage.inputTokens, 25);
      assert.equal(res.usage.cachedWriteTokens, 200);
      assert.equal(res.usage.cachedWrite1hTokens, 300);
      assert.equal(res.usage.cachedReadTokens, 100);
      assert.equal(res.usage.totalTokens, 637);
    }

    // Non-adaptive model ending with thinking + redacted_thinking + empty text skips them for cache_control
    seen.length = 0;
    await streamChatCompletion({
      baseUrl: 'https://api.anthropic.com/v1',
      headers: { 'x-api-key': 'sk-ant-4' },
      model: 'claude-sonnet-4-5',
      providerFlavor: 'anthropic',
      reasoning: 'none',
      temperature: 0.2,
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: null, anthropicBlocks: [{ type: 'text', text: 'Cacheable assistant text' }, { type: 'text', text: '   ' }, { type: 'redacted_thinking', data: 'enc' }, { type: 'thinking', thinking: 'thought', signature: 's' }] },
      ],
    });
    assert.equal(seen[0].thinking, undefined);
    assert.equal(seen[0].temperature, 0.2);
    assert.deepEqual(seen[0].messages[1].content[0].cache_control, { type: 'ephemeral' });
    assert.equal(seen[0].messages[1].content[3].cache_control, undefined);

    // 400 retry fallback drops thinking + output_config on custom proxy rejection
    seen.length = 0;
    rejectAdaptiveOnce = true;
    const retryRes = await streamChatCompletion({
      baseUrl: 'https://api.anthropic.com/v1',
      headers: { 'x-api-key': 'sk-ant-proxy' },
      model: 'claude-opus-5-5',
      providerFlavor: 'anthropic',
      reasoning: 'high',
      temperature: 0.3,
      messages: [{ role: 'user', content: 'Hi proxy' }],
    });
    assert.equal(seen.length, 2);
    assert.deepEqual(seen[0].thinking, { type: 'adaptive' });
    assert.equal(seen[1].thinking, undefined);
    assert.equal(seen[1].output_config, undefined);
    assert.equal(seen[1].temperature, 0.3);
    assert.equal(retryRes.content, 'Adaptive OK');
  } finally {
    globalThis.fetch = prevFetch;
  }
});

await test('estimateCostUsd & knownModelPricing compute exact USD across Claude 5.x, Haiku 100k tiers, snapshots, 5m/1h writes, and costUsd pass-through', () => {
  // claude-opus-5-5: $4 in, $20 out, $0.20 read, $5.00 5m write, $8.00 1h write -> $2.30
  approxEqual(
    estimateCostUsd({ inputTokens: 100_000, cachedWriteTokens: 200_000, cachedWrite1hTokens: 50_000, cachedReadTokens: 500_000, outputTokens: 20_000, thoughtTokens: 0, totalTokens: 870_000 }, 'claude-opus-5-5', []),
    2.3,
  );
  // anthropic/claude-sonnet-5.5: $2 in, $10 out, $0.10 read, $2.50 5m write, $4.00 1h write -> $1.45
  approxEqual(
    estimateCostUsd({ inputTokens: 100_000, cachedWriteTokens: 100_000, cachedWrite1hTokens: 100_000, cachedReadTokens: 1_000_000, outputTokens: 50_000, thoughtTokens: 0, totalTokens: 1_350_000 }, 'anthropic/claude-sonnet-5.5', []),
    1.45,
  );
  // claude-haiku-5-5 <= 100k prompt tokens (boundary = 100_000): $0.10 in, $0.50 out, $0.01 read, $0.125 5m, $0.20 1h -> $0.01315
  approxEqual(
    estimateCostUsd({ inputTokens: 20_000, cachedWriteTokens: 30_000, cachedWrite1hTokens: 10_000, cachedReadTokens: 40_000, outputTokens: 10_000, thoughtTokens: 0, totalTokens: 110_000 }, 'claude-haiku-5-5', ANTHROPIC_DIRECT_MODELS),
    0.01315,
  );
  // claude-haiku-5-5 > 100k prompt tokens (150_000 prompt): $0.50 in, $2.50 out, $0.05 read, $0.625 5m, $1.00 1h -> $0.074
  approxEqual(
    estimateCostUsd({ inputTokens: 20_000, cachedWriteTokens: 40_000, cachedWrite1hTokens: 10_000, cachedReadTokens: 80_000, outputTokens: 10_000, thoughtTokens: 0, totalTokens: 160_000 }, 'claude-haiku-5-5', ANTHROPIC_DIRECT_MODELS),
    0.074,
  );
  // claude-fable-5-2: $8 in, $40 out, $0.20 read (0.025x), $10 5m, $16 1h -> $1.74
  approxEqual(
    estimateCostUsd({ inputTokens: 50_000, cachedWriteTokens: 50_000, cachedWrite1hTokens: 25_000, cachedReadTokens: 200_000, outputTokens: 10_000, thoughtTokens: 0, totalTokens: 335_000 }, 'claude-fable-5-2', []),
    1.74,
  );
  // Dated snapshot ID when models lacks pricing fields -> $0.26
  const remoteWithoutPricing = [{ id: 'claude-opus-5-5-20261101', name: 'Claude Opus 5.5 Snapshot', group: 'Anthropic API Models', contextSize: 1_000_000 }];
  approxEqual(
    estimateCostUsd({ inputTokens: 10_000, cachedWriteTokens: 20_000, cachedReadTokens: 100_000, outputTokens: 5_000, thoughtTokens: 0, totalTokens: 135_000 }, 'claude-opus-5-5-20261101', remoteWithoutPricing),
    0.26,
  );
  // Custom gateway model with only prompt + completion prices defaults read=0.1x, write5m=1.25x, write1h=2.0x
  approxEqual(
    estimateCostUsd(
      { inputTokens: 100_000, cachedWriteTokens: 100_000, cachedWrite1hTokens: 100_000, cachedReadTokens: 100_000, outputTokens: 100_000, thoughtTokens: 0, totalTokens: 500_000 },
      'custom/coder-x',
      [{ id: 'custom/coder-x', name: 'Coder X', group: 'Custom', contextSize: 128_000, promptPricePerToken: 1e-6, completionPricePerToken: 5e-6 }],
    ),
    0.1 + 0.125 + 0.2 + 0.01 + 0.5,
  );
  assert.equal(knownModelPricing('claude-haiku-4-5-20251001').input, 1e-6);
  assert.equal(knownModelPricing('claude-opus-4-6').input, 5e-6);
  assert.equal(knownModelPricing('claude-opus-4-5').input, 15e-6);
  assert.equal(knownModelPricing('claude-sonnet-4-5').input, 3e-6);
  assert.equal(estimateCostUsd({ inputTokens: 999, outputTokens: 999, thoughtTokens: 0, cachedReadTokens: 0, totalTokens: 1998, costUsd: 0.42 }, 'claude-opus-5-5', []), 0.42);
  assert.equal(estimateCostUsd({ inputTokens: 100, outputTokens: 50, thoughtTokens: 0, cachedReadTokens: 0, totalTokens: 150 }, 'local/unknown-model', []), undefined);
});

await test('OpenRouter cache_write_tokens, ACP Anthropic cost/usedTokens propagation, and TUI /cost cache-write display', async () => {
  const prevFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.endsWith('/models')) {
      return new Response(JSON.stringify({ data: [{ id: 'claude-opus-5-5-20261101', display_name: 'Claude Opus 5.5' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.endsWith('/chat/completions')) {
      return sseFrames([
        { model: 'anthropic/claude-sonnet-5.5', choices: [{ delta: { content: 'OR_OK' }, finish_reason: 'stop' }], usage: { prompt_tokens: 1000, completion_tokens: 100, total_tokens: 1100, prompt_tokens_details: { cached_tokens: 600, cache_write_tokens: 300 } } },
        '[DONE]',
      ]);
    }
    return sseFrames([
      { type: 'message_start', message: { model: 'claude-opus-5-5-20261101', usage: { input_tokens: 100, cache_creation_input_tokens: 400, cache_read_input_tokens: 1000 } } },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'ACP_COST_OK' } },
      { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 50 } },
      '[DONE]',
    ]);
  };
  const tmp = mkdtempSync(join(tmpdir(), 'oly-cost-acp-'));
  try {
    const orRes = await streamChatCompletion({
      baseUrl: 'https://openrouter.ai/api/v1',
      headers: { Authorization: 'Bearer sk-or-test' },
      model: 'anthropic/claude-sonnet-5.5',
      providerFlavor: 'openrouter',
      messages: [{ role: 'user', content: 'Hi' }],
    });
    assert.equal(orRes.usage.inputTokens, 100);
    assert.equal(orRes.usage.cachedReadTokens, 600);
    assert.equal(orRes.usage.cachedWriteTokens, 300);

    const shared = join(tmp, 'shared');
    const ws = join(tmp, 'ws');
    mkdirSync(ws, { recursive: true });
    setOlympusSharedDir(shared);
    upsertProvider({ flavor: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', key: 'sk-ant-acp', defaultModel: 'claude-opus-5-5-20261101' }, { makeActive: true }, shared);

    const updates = [];
    const app = createOlympusAgentApp({ env: { OLYMPUS_SHARED_DIR: shared, OLYMPUS_DISABLE_OLLAMA_PROBE: '1' }, version: '0.1.0' });
    const conn = client({ name: 'cost-acp-test' })
      .onNotification(methods.client.session.update, ({ params }) => updates.push(params.update))
      .onNotification(methods.client.auth.statusUpdate, () => {})
      .connect(app);
    await conn.agent.request(methods.agent.initialize, { protocolVersion: PROTOCOL_VERSION, clientCapabilities: {}, clientInfo: { name: 't', version: '0' } });
    const s = await conn.agent.request(methods.agent.session.new, { cwd: ws, mcpServers: [] });
    const turn = await conn.agent.request(methods.agent.session.prompt, { sessionId: s.sessionId, prompt: [{ type: 'text', text: 'Compute' }] });
    assert.equal(turn.usage.cachedWriteTokens, 400);
    assert.equal(turn.usage.totalTokens, 1550);
    const usageUpd = updates.filter((u) => u.sessionUpdate === 'usage_update').at(-1);
    assert.equal(usageUpd.used, 1550, 'context window usedTokens includes cache writes');
    assert.equal(usageUpd.size, 1_000_000);
    approxEqual(usageUpd.cost.amount, 0.0036);
    conn.close();

    const costPlain = renderCostRows({ used: 1550, size: 1_000_000, cost: 0.0036 }, { input: 100, output: 50, cached: 1000, cacheWrite: 400, turns: 1 }, turn.usage, 100)
      .map(stripAnsi)
      .join('\n');
    assert.match(costPlain, /400 cache write/);
  } finally {
    globalThis.fetch = prevFetch;
    rmSync(tmp, { recursive: true, force: true });
  }
});

const failed = results.filter((r) => !r.ok);
console.log(`\nCost & caching suite: ${results.length - failed.length}/${results.length} passed.`);
if (failed.length) process.exit(1);
