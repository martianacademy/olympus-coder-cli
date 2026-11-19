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
  createOlympusAgentApp,
  prepareChatCachePayload,
  setOlympusSharedDir,
  streamChatCompletion,
  supportsChatExplicitCaching,
  upsertProvider,
} = await import(pathToFileURL(join(APP, 'dist', 'index.js')).href);

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

function sseFrames(frames) {
  const text = frames.map((f) => (f === '[DONE]' ? 'data: [DONE]\n\n' : `data: ${JSON.stringify(f)}\n\n`)).join('');
  return new Response(text, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

function countChatBreakpoints(body) {
  let count = 0;
  if (body.cache_control) count++;
  for (const m of body.messages ?? []) {
    if (m?.cache_control) count++;
    if (Array.isArray(m?.content)) {
      for (const p of m.content) if (p?.cache_control) count++;
    }
  }
  return count;
}

await test('supportsChatExplicitCaching routes OpenRouter and AI Gateway models accurately while skipping :free and implicit providers', () => {
  assert.equal(supportsChatExplicitCaching('anthropic/claude-sonnet-5.5', 'openrouter'), true);
  assert.equal(supportsChatExplicitCaching('openrouter::anthropic/claude-opus-5.5', 'openrouter'), true);
  assert.equal(supportsChatExplicitCaching('google/gemini-2.5-pro', 'openrouter'), true);
  assert.equal(supportsChatExplicitCaching('google/gemini-2.0-flash-exp:free', 'openrouter'), false, 'free tier skipped');
  assert.equal(supportsChatExplicitCaching('openai/gpt-5', 'openrouter'), false, 'OpenAI auto-caches prefixes');
  assert.equal(supportsChatExplicitCaching('deepseek/deepseek-chat-v3-0324', 'openrouter'), false, 'DeepSeek auto-caches prefixes');

  assert.equal(supportsChatExplicitCaching('anthropic/claude-sonnet-5.5', 'ai-gateway'), true);
  assert.equal(supportsChatExplicitCaching('qwen/qwen3-coder', 'ai-gateway'), true);
  assert.equal(supportsChatExplicitCaching('google/gemini-2.5-pro', 'ai-gateway'), false, 'Gemini is implicit on Vercel AI Gateway');
  assert.equal(supportsChatExplicitCaching('openai/gpt-5', 'ai-gateway'), false);

  assert.equal(supportsChatExplicitCaching('claude-sonnet-5-5', 'anthropic'), false, 'Direct Anthropic uses streamAnthropicMessages');
  assert.equal(supportsChatExplicitCaching('anthropic/claude-sonnet-5.5', 'openai-compatible'), false);
  assert.equal(supportsChatExplicitCaching('qwen2.5-coder:latest', 'ollama'), false);
});

await test('OpenRouter multi-step agent loop: block cache_control on system + user/assistant, top-level cache_control on tool tail, <=2 breakpoints, immutable input', async () => {
  const prevFetch = globalThis.fetch;
  const bodies = [];
  globalThis.fetch = async (_input, init = {}) => {
    const body = JSON.parse(String(init.body || '{}'));
    bodies.push(body);
    return sseFrames([
      { model: body.model, choices: [{ delta: { content: 'OK' }, finish_reason: 'stop' }], usage: { prompt_tokens: 1500, completion_tokens: 40, total_tokens: 1540, prompt_tokens_details: { cached_tokens: 1200, cache_write_tokens: 200 } } },
      '[DONE]',
    ]);
  };

  try {
    const history = [
      { role: 'system', content: 'Static system instructions' },
      { role: 'user', content: 'Inspect app.ts' },
    ];

    // Step 1: [system, user] -> 2 block-level breakpoints, no top-level cache_control
    await streamChatCompletion({
      baseUrl: 'https://openrouter.ai/api/v1',
      headers: { Authorization: 'Bearer sk-or' },
      model: 'anthropic/claude-sonnet-5.5',
      providerFlavor: 'openrouter',
      messages: history,
    });
    assert.equal(countChatBreakpoints(bodies[0]), 2);
    assert.equal(bodies[0].cache_control, undefined);
    assert.deepEqual(bodies[0].messages[0].content, [{ type: 'text', text: 'Static system instructions', cache_control: { type: 'ephemeral' } }]);
    assert.deepEqual(bodies[0].messages[1].content, [{ type: 'text', text: 'Inspect app.ts', cache_control: { type: 'ephemeral' } }]);
    assert.equal(typeof history[0].content, 'string', 'caller history stays immutable');
    assert.equal(typeof history[1].content, 'string', 'caller history stays immutable');

    // Step 2: [system, user, assistant(tool_calls), tool] -> system block + top-level cache_control, tool content stays string
    history.push(
      { role: 'assistant', content: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'read_file', arguments: '{"path":"app.ts"}' } }] },
      { role: 'tool', tool_call_id: 'call_1', name: 'read_file', content: 'export const x = 1;' },
    );
    await streamChatCompletion({
      baseUrl: 'https://openrouter.ai/api/v1',
      headers: { Authorization: 'Bearer sk-or' },
      model: 'anthropic/claude-sonnet-5.5',
      providerFlavor: 'openrouter',
      messages: history,
    });
    assert.equal(countChatBreakpoints(bodies[1]), 2);
    assert.deepEqual(bodies[1].cache_control, { type: 'ephemeral' });
    assert.deepEqual(bodies[1].messages[0].content[0].cache_control, { type: 'ephemeral' });
    assert.equal(bodies[1].messages[1].content, 'Inspect app.ts', 'prior user message reverts to plain string');
    assert.equal(bodies[1].messages[3].content, 'export const x = 1;', 'tool message content stays plain string');

    // Step 3: inject stale cache_control on earlier multipart user message + new multimodal user turn -> stripped cleanly
    history[1] = {
      role: 'user',
      content: [{ type: 'text', text: 'Inspect app.ts', cache_control: { type: 'ephemeral' } }],
    };
    history.push({
      role: 'user',
      content: [
        { type: 'text', text: 'Now check screenshot' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } },
      ],
    });
    await streamChatCompletion({
      baseUrl: 'https://openrouter.ai/api/v1',
      headers: { Authorization: 'Bearer sk-or' },
      model: 'google/gemini-2.5-pro',
      providerFlavor: 'openrouter',
      messages: history,
    });
    assert.equal(countChatBreakpoints(bodies[2]), 2, 'stale cache_control stripped; total stays <= 2');
    assert.equal(bodies[2].cache_control, undefined);
    assert.equal(bodies[2].messages[1].content[0].cache_control, undefined);
    assert.deepEqual(bodies[2].messages[4].content[0].cache_control, { type: 'ephemeral' });
    assert.equal(bodies[2].messages[4].content[1].type, 'image_url');
    assert.deepEqual(history[1].content[0].cache_control, { type: 'ephemeral' }, 'caller input object was not mutated');
  } finally {
    globalThis.fetch = prevFetch;
  }
});

await test('Vercel AI Gateway moving message-level cache_control and HTTP 400 compatLevel fallback stripping', async () => {
  const step1 = prepareChatCachePayload(
    [
      { role: 'system', content: 'Gateway system' },
      { role: 'user', content: 'Task 1' },
      { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'list_dir', arguments: '{}' } }] },
      { role: 'tool', tool_call_id: 'c1', content: 'src/\ntests/' },
    ],
    'anthropic/claude-opus-5.5',
    'ai-gateway',
  );
  assert.equal(step1.topLevelCacheControl, undefined);
  assert.deepEqual(step1.cachedMessages[0].cache_control, { type: 'ephemeral' });
  assert.equal(step1.cachedMessages[1].cache_control, undefined);
  assert.deepEqual(step1.cachedMessages[3].cache_control, { type: 'ephemeral' });
  assert.equal(step1.cachedMessages[3].content, 'src/\ntests/');

  // Verify HTTP 400 on cache_control transparently retries at compatLevel 1 without cache_control
  const prevFetch = globalThis.fetch;
  const attempts = [];
  globalThis.fetch = async (_input, init = {}) => {
    const body = JSON.parse(String(init.body || '{}'));
    attempts.push(body);
    if (attempts.length === 1) {
      return new Response(JSON.stringify({ error: { message: 'Extra inputs are not permitted: cache_control' } }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }
    return sseFrames([
      { model: body.model, choices: [{ delta: { content: 'FALLBACK_OK' }, finish_reason: 'stop' }], usage: { prompt_tokens: 50, completion_tokens: 5, total_tokens: 55 } },
      '[DONE]',
    ]);
  };

  try {
    const res = await streamChatCompletion({
      baseUrl: 'https://ai-gateway.vercel.sh/v1',
      headers: { Authorization: 'Bearer vck-test' },
      model: 'anthropic/claude-sonnet-5.5',
      providerFlavor: 'ai-gateway',
      messages: [
        { role: 'system', content: 'Sys' },
        { role: 'user', content: 'Ping' },
      ],
    });
    assert.equal(res.content, 'FALLBACK_OK');
    assert.equal(attempts.length, 2);
    assert.equal(countChatBreakpoints(attempts[0]), 2);
    assert.equal(countChatBreakpoints(attempts[1]), 0, 'compatLevel 1 retry strips all cache_control markers');
  } finally {
    globalThis.fetch = prevFetch;
  }
});

await test('End-to-end ACP prompt turn over OpenRouter injects cache_control across tool steps', async () => {
  const prevFetch = globalThis.fetch;
  const chatBodies = [];
  let callNum = 0;
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.endsWith('/models')) {
      return new Response(JSON.stringify({ data: [{ id: 'anthropic/claude-sonnet-5.5', name: 'Claude Sonnet 5.5', context_length: 1_000_000 }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    callNum++;
    const body = JSON.parse(String(init.body || '{}'));
    chatBodies.push(body);
    if (callNum === 1) {
      return sseFrames([
        {
          model: body.model,
          choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_ls', type: 'function', function: { name: 'list_dir', arguments: '{}' } }] }, finish_reason: 'tool_calls' }],
          usage: { prompt_tokens: 2000, completion_tokens: 30, total_tokens: 2030, prompt_tokens_details: { cached_tokens: 0, cache_write_tokens: 1950 } },
        },
        '[DONE]',
      ]);
    }
    return sseFrames([
      {
        model: body.model,
        choices: [{ delta: { content: 'All done.' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 2200, completion_tokens: 20, total_tokens: 2220, prompt_tokens_details: { cached_tokens: 1950, cache_write_tokens: 200 } },
      },
      '[DONE]',
    ]);
  };

  const tmp = mkdtempSync(join(tmpdir(), 'oly-or-acp-'));
  try {
    const shared = join(tmp, 'shared');
    const ws = join(tmp, 'ws');
    mkdirSync(ws, { recursive: true });
    setOlympusSharedDir(shared);
    upsertProvider({ flavor: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', key: 'sk-or-e2e', defaultModel: 'anthropic/claude-sonnet-5.5' }, { makeActive: true }, shared);

    const app = createOlympusAgentApp({ env: { OLYMPUS_SHARED_DIR: shared, OLYMPUS_DISABLE_OLLAMA_PROBE: '1' }, version: '0.1.0' });
    const conn = client({ name: 'or-cache-e2e' })
      .onNotification(methods.client.session.update, () => {})
      .onNotification(methods.client.auth.statusUpdate, () => {})
      .connect(app);
    await conn.agent.request(methods.agent.initialize, { protocolVersion: PROTOCOL_VERSION, clientCapabilities: {}, clientInfo: { name: 't', version: '0' } });
    const s = await conn.agent.request(methods.agent.session.new, { cwd: ws, mcpServers: [] });
    const turn = await conn.agent.request(methods.agent.session.prompt, { sessionId: s.sessionId, prompt: [{ type: 'text', text: 'List workspace' }] });

    assert.equal(chatBodies.length, 2);
    assert.equal(countChatBreakpoints(chatBodies[0]), 2, 'step 1 caches system + user');
    assert.equal(countChatBreakpoints(chatBodies[1]), 2, 'step 2 caches system + trailing tool result');
    assert.deepEqual(chatBodies[1].cache_control, { type: 'ephemeral' });
    assert.equal(turn.usage.cachedReadTokens, 1950);
    assert.equal(turn.usage.cachedWriteTokens, 2150);
    conn.close();
  } finally {
    globalThis.fetch = prevFetch;
    rmSync(tmp, { recursive: true, force: true });
  }
});

const failed = results.filter((r) => !r.ok);
console.log(`\nChat completions cache_control suite: ${results.length - failed.length}/${results.length} passed.`);
if (failed.length) process.exit(1);
