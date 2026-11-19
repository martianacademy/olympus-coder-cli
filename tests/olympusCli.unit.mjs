import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
import { SEP, installMockGatewayFetch, mockBaseUrl, sseResponse } from './mockFetch.mjs';
import { runProviderStoreCases } from './providerStore.cases.mjs';

const APP = dirname(dirname(fileURLToPath(import.meta.url)));
const PKG_VERSION = JSON.parse(readFileSync(join(APP, 'package.json'), 'utf8')).version;
// Every test uses temp dirs and the 0600 file secret backend (never the real Keychain or ~/.olympus).
process.env.OLYMPUS_SECRET_STORE = 'file';
const KEY_ENV_VARS = ['OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY', 'AI_GATEWAY_API_KEY', 'VERCEL_AI_GATEWAY_API_KEY', 'OLYMPUS_OPENAI_API_KEY', 'OPENAI_API_KEY', 'OLYMPUS_BASE_URL', 'OPENAI_BASE_URL', 'OLYMPUS_USE_OLLAMA', 'OLYMPUS_OLLAMA_HOST', 'OLYMPUS_MODEL', 'ANTHROPIC_MODEL', 'OPENAI_MODEL', 'OLYMPUS_HOME', 'OLYMPUS_SHARED_DIR', 'AGENTDESK_SHARED_ROOT'];
function childEnv(home, extra = {}) {
  const e = { ...process.env };
  for (const k of KEY_ENV_VARS) delete e[k];
  return { ...e, OLYMPUS_HOME: home, OLYMPUS_SECRET_STORE: 'file', OLYMPUS_DISABLE_OLLAMA_PROBE: '1', ...extra };
}
const { client, McpOverAcpProvider, methods, ndJsonStream, PROTOCOL_VERSION } = await import(
  pathToFileURL(join(APP, 'node_modules', '@agentclientprotocol', 'sdk', 'dist', 'v1', 'unstable', 'acp.js')).href
);
const {
  CURATED_MODELS,
  ThinkTagSplitter,
  clearSavedCliSettingsKey,
  createOlympusAgentApp,
  getProviderKey,
  listSavedProviders,
  loadCliSettings,
  loadProviderSettings,
  removeProvider,
  resolveConnectedProviders,
  resolveEndpointById,
  resolveEndpointConfig,
  saveCliSettings,
  setActiveProvider,
  setOlympusHomeDirOverride,
  setOlympusSharedDir,
  streamChatCompletion,
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

await test('ThinkTagSplitter separates <think>...</think> across arbitrary chunk boundaries', () => {
  const s = new ThinkTagSplitter();
  const chunks = ['<th', 'ink>Step 1: check ', 'types</thi', 'nk>\nHello ', 'world!'];
  const events = [];
  for (const c of chunks) events.push(...s.push(c));
  events.push(...s.flush());
  const thought = events.filter((e) => e.type === 'thought').map((e) => e.text).join('');
  const text = events.filter((e) => e.type === 'text').map((e) => e.text).join('');
  assert.equal(thought, 'Step 1: check types');
  assert.equal(text, 'Hello world!');
});

await test('resolveEndpointConfig prioritizes override > OpenRouter > AI Gateway > Custom > Ollama', () => {
  const tmpShared = mkdtempSync(join(tmpdir(), 'oly-cfg-'));
  try {
    const unconf = resolveEndpointConfig({ sharedDir: tmpShared }, null, false);
    assert.equal(unconf.configured, false);

    const ollamaAuto = resolveEndpointConfig({ sharedDir: tmpShared }, null, true);
    assert.equal(ollamaAuto.configured, true);
    assert.equal(ollamaAuto.flavor, 'ollama');

    const aiGw = resolveEndpointConfig({ sharedDir: tmpShared, aiGatewayToken: 'vck_test_123' }, null, true);
    assert.equal(aiGw.configured, true);
    assert.equal(aiGw.flavor, 'ai-gateway');

    const openRouter = resolveEndpointConfig(
      { sharedDir: tmpShared, openRouterToken: 'tok_or_test', aiGatewayToken: 'vck_test_123' },
      null,
      true,
    );
    assert.equal(openRouter.configured, true);
    assert.equal(openRouter.flavor, 'openrouter');
    assert.equal(openRouter.defaultModel, CURATED_MODELS[0].id);

    const overridden = resolveEndpointConfig(
      { sharedDir: tmpShared, openRouterToken: 'tok_or_test' },
      { baseUrl: 'https://custom-gateway.example.com/v1', headers: { Authorization: 'Bearer gw_999' } },
      false,
    );
    assert.equal(overridden.configured, true);
    assert.equal(overridden.baseUrl, 'https://custom-gateway.example.com/v1');
    assert.equal(overridden.headers.Authorization, 'Bearer gw_999');
  } finally {
    rmSync(tmpShared, { recursive: true, force: true });
  }
});

const mockState = installMockGatewayFetch(CURATED_MODELS[0].id);

await test('streamChatCompletion retries 400 unsupported params and parses fragmented SSE reasoning + usage', async () => {
  mockState.rejectCompatOnce = true;
  mockState.requestLog.length = 0;
  const deltas = [];
  const res = await streamChatCompletion({
    baseUrl: mockBaseUrl,
    headers: { Authorization: 'Bearer test_key' },
    model: CURATED_MODELS[0].id,
    providerFlavor: 'openai-compatible',
    reasoning: 'high',
    messages: [{ role: 'user', content: 'Reply with PONG' }],
    onDelta: (ev) => deltas.push(ev),
  });
  assert.equal(mockState.requestLog.length, 2, 'should retry once without reasoning_effort on 400');
  assert.equal(res.content, 'PONG_FROM_OLYMPUS_CLI');
  assert.equal(res.usage.totalTokens, 25);
});

await test('Full ACP lifecycle: auth, providers/set, MCP-over-ACP, fs buffer, diff edit, terminal, steering, fork & load', async () => {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'oly-acp-'));
  const wsDir = join(tmpRoot, 'project');
  const sharedDir = join(tmpRoot, 'shared');
  setOlympusSharedDir(sharedDir);
  mkdirSync(wsDir, { recursive: true });
  const appFile = join(wsDir, ['app', 'ts'].join('.'));
  writeFileSync(appFile, 'export const DISK_VALUE = 0;\n', 'utf8');

  const editorBuffers = new Map([[appFile, 'export const UNSAVED_VALUE = 1;\n']]);
  const writtenFiles = new Map();
  const permissionPrompts = [];
  const updates = [];
  let terminalCount = 0;

  const env = { OLYMPUS_SHARED_DIR: sharedDir, OLYMPUS_DISABLE_OLLAMA_PROBE: '1' };
  const agentApp = createOlympusAgentApp({ env, version: '0.1.0' });

  const clientApp = client({ name: 'test-olympus-desk' })
    .onNotification(methods.client.session.update, ({ params }) => {
      updates.push(params.update);
    })
    .onNotification(methods.client.auth.statusUpdate, () => {})
    .onRequest(methods.client.session.requestPermission, async ({ params }) => {
      permissionPrompts.push(params.toolCall?.title);
      return { outcome: { outcome: 'selected', optionId: 'allow_once' } };
    })
    .onRequest(methods.client.fs.readTextFile, async ({ params }) => ({
      content: editorBuffers.get(params.path) ?? readFileSync(params.path, 'utf8'),
    }))
    .onRequest(methods.client.fs.writeTextFile, async ({ params }) => {
      writtenFiles.set(params.path, params.content);
      editorBuffers.set(params.path, params.content);
      writeFileSync(params.path, params.content, 'utf8');
      return {};
    })
    .onRequest(methods.client.terminal.create, async () => ({ terminalId: `term_${++terminalCount}` }))
    .onRequest(methods.client.terminal.waitForExit, async () => ({ exitCode: 0 }))
    .onRequest(methods.client.terminal.output, async () => ({ output: 'build-ok\n', truncated: false }))
    .onRequest(methods.client.terminal.release, async () => ({}));

  const mcpProvider = new McpOverAcpProvider();
  clientApp.onRequest(methods.client.mcp.message, mcpProvider.handleRequest);
  const mcpListMethod = ['tools', 'list'].join(SEP);
  const mcpCallMethod = ['tools', 'call'].join(SEP);

  const conn = clientApp.connect(agentApp);
  const mcpReg = mcpProvider.registerServer(conn.agent, {
    name: 'olympus',
    handler: async (ctx) => {
      if (ctx.method === mcpListMethod) {
        return {
          result: {
            tools: [{ name: 'session_info', description: 'Get Olympus orchestrator session info', inputSchema: { type: 'object', properties: {} } }],
          },
        };
      }
      if (ctx.method === mcpCallMethod && ctx.params?.name === 'session_info') {
        return { result: { content: [{ type: 'text', text: 'ORCHESTRATOR_OK' }] } };
      }
      return { result: {} };
    },
  });
  try {
    const init = await conn.agent.request(methods.agent.initialize, {
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
        terminal: true,
        session: { configOptions: { boolean: {} } },
      },
      clientInfo: { name: 'olympus-coder-test', version: '0.1.0' },
    });

    assert.equal(init.agentInfo?.name, 'olympus');
    assert.equal(init._meta?.steering?.supported, true);
    assert.equal(Boolean(init.agentCapabilities?.providers), true);
    assert.equal(init.agentCapabilities?.mcpCapabilities?.acp, true);
    assert.ok(init.authMethods.some((m) => m.id === 'openrouter'));
    assert.ok(init.authMethods.some((m) => m.id === 'ai-gateway'));

    const initialAuth = await conn.agent.request(methods.agent.auth.status, {});
    assert.equal(initialAuth.state, 'unauthenticated');

    const provList = await conn.agent.request(methods.agent.providers.list, {});
    assert.equal(provList.providers[0].providerId, 'openai');

    await conn.agent.request(methods.agent.providers.set, {
      providerId: 'openai',
      apiType: 'openai',
      baseUrl: mockBaseUrl,
      headers: { Authorization: 'Bearer tok_mock_router' },
    });

    const afterAuth = await conn.agent.request(methods.agent.auth.status, {});
    assert.equal(afterAuth.state, 'authenticated');

    const previewOpts = await conn.agent.request(methods.agent.session.options, { cwd: wsDir });
    const modelOpt = previewOpts.configOptions.find((o) => o.id === 'model');
    const allModelValues = modelOpt.options.flatMap((g) => g.options.map((x) => x.value));
    assert.ok(allModelValues.includes('martian-custom-coder-v1'), 'live models entry should appear in configOptions');

    const newRes = await conn.agent.request(methods.agent.session.new, {
      cwd: wsDir,
      mcpServers: [mcpReg.declaration],
    });
    const sessionId = newRes.sessionId;
    assert.ok(sessionId.startsWith('oly_'));

    let steerRes = null;
    mockState.onFirstStepToolIssued = async () => {
      steerRes = await conn.agent.request('_session/steering', {
        sessionId,
        prompt: [{ type: 'text', text: 'STEER_NOTE_EXTRA' }],
      });
    };

    const promptRes = await conn.agent.request(methods.agent.session.prompt, {
      sessionId,
      prompt: [{ type: 'text', text: 'Read and update file, run verification, and check session_info' }],
    });
    mockState.onFirstStepToolIssued = null;

    assert.equal(promptRes.stopReason, 'end_turn');
    assert.equal(steerRes?.outcome, 'injected');
    assert.equal(writtenFiles.get(appFile), 'export const UNSAVED_VALUE = 42;\n', 'edit_file should edit unsaved buffer content');
    assert.equal(terminalCount, 1, 'run_command should execute inside ACP client terminal');
    assert.ok(permissionPrompts.length >= 2, 'edit_file and run_command should request permission in code mode');

    const msgText = updates.filter((u) => u.sessionUpdate === 'agent_message_chunk').map((u) => u.content?.text ?? '').join('');
    const thoughtText = updates.filter((u) => u.sessionUpdate === 'agent_thought_chunk').map((u) => u.content?.text ?? '').join('');
    const hasDiff = updates.some(
      (u) => u.sessionUpdate === 'tool_call_update' && Array.isArray(u.content) && u.content.some((c) => c.type === 'diff'),
    );
    const hasPlan = updates.some((u) => u.sessionUpdate === 'plan' && u.entries?.length === 1);

    assert.ok(thoughtText.includes('Inspecting unsaved buffer'), 'explicit delta.reasoning streamed');
    assert.ok(thoughtText.includes('Verifying all tool results.'), 'inline <think> tag streamed as thought');
    assert.ok(msgText.includes('Completed! Steered=true; MCP=true'), `expected final message, got: ${msgText}`);
    assert.equal(hasDiff, true, 'edit_file should emit ACP diff content');
    assert.equal(hasPlan, true, 'todo_write should emit ACP plan update');

    updates.length = 0;
    await conn.agent.request(methods.agent.session.prompt, { sessionId, prompt: [{ type: 'text', text: `${SEP}status` }] });
    const statusText = updates.filter((u) => u.sessionUpdate === 'agent_message_chunk').map((u) => u.content?.text ?? '').join('');
    assert.ok(statusText.includes('Olympus Native Agent'));

    updates.length = 0;
    await conn.agent.request(methods.agent.session.prompt, { sessionId, prompt: [{ type: 'text', text: `${SEP}compact` }] });
    const compactText = updates.filter((u) => u.sessionUpdate === 'agent_message_chunk').map((u) => u.content?.text ?? '').join('');
    assert.ok(compactText.includes('Compacted context'));

    const forked = await conn.agent.request(methods.agent.session.fork, { sessionId, cwd: wsDir, mcpServers: [] });
    assert.notEqual(forked.sessionId, sessionId);

    await conn.agent.request(methods.agent.session.close, { sessionId });
    updates.length = 0;
    await conn.agent.request(methods.agent.session.load, { sessionId, cwd: wsDir, mcpServers: [] });
    assert.ok(updates.some((u) => u.sessionUpdate === 'user_message_chunk'), 'session/load should replay user messages');
    assert.ok(updates.some((u) => u.sessionUpdate === 'tool_call'), 'session/load should replay tool calls');
  } finally {
    conn.close();
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

await test('Standalone bin/oly runs stdio ACP + CLI one-shot cleanly', async () => {
  const cliBin = join(APP, 'bin', 'oly');
  const tmpHome = mkdtempSync(join(tmpdir(), 'oly-bin-'));
  const verRun = spawnSync(cliBin, ['--version'], { encoding: 'utf8', timeout: 10000, env: childEnv(tmpHome) });
  assert.equal(verRun.status, 0, `bin/oly --version stderr: ${verRun.stderr}`);
  assert.ok(verRun.stdout.includes(`olympus ${PKG_VERSION}`), `unexpected --version output: ${verRun.stdout}`);

  const proc = spawn(cliBin, ['acp'], {
    cwd: APP,
    env: childEnv(tmpHome, { ANTHROPIC_API_KEY: 'tok_ant_stdio_test' }),
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const stream = ndJsonStream(Writable.toWeb(proc.stdin), Readable.toWeb(proc.stdout));
  const stdioConn = client({ name: 'stdio-probe' }).connect(stream);
  try {
    const init = await stdioConn.agent.request(methods.agent.initialize, {
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: true },
      clientInfo: { name: 'stdio-test', version: '0.1.0' },
    });
    assert.equal(init.agentInfo?.name, 'olympus');
    assert.ok(init.authMethods.some((m) => m.id === 'anthropic'));
    const auth = await stdioConn.agent.request(methods.agent.auth.status, {});
    assert.equal(auth.state, 'authenticated');
    assert.match(auth.accounts[0]?.label ?? '', /Anthropic/);
  } finally {
    stdioConn.close();
    proc.kill();
  }

  const tmpPreloadDir = mkdtempSync(join(tmpdir(), 'oly-preload-'));
  const preloadFile = join(tmpPreloadDir, ['mock-fetch', 'mjs'].join('.'));
  writeFileSync(
    preloadFile,
    `globalThis.fetch = async () => new Response('data: {"model":"m1","choices":[{"delta":{"content":"PONG_FROM_SUBPROCESS"}}]}\\n\\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":4,"total_tokens":14}}\\n\\ndata: [DONE]\\n\\n', { status: 200, headers: { 'content-type': 'text/event-stream' } });\n`,
    'utf8',
  );
  try {
    const oneShot = spawnSync(
      process.execPath,
      ['--import', pathToFileURL(preloadFile).href, cliBin, '-y', 'Reply with PONG'],
      {
        encoding: 'utf8',
        timeout: 15000,
        env: childEnv(tmpHome, { ELECTRON_RUN_AS_NODE: '1', OPENROUTER_API_KEY: 'tok_oneshot_test' }),
      },
    );
    assert.equal(oneShot.status, 0, `one-shot stderr: ${oneShot.stderr}`);
    assert.ok(oneShot.stdout.includes('PONG_FROM_SUBPROCESS'), `unexpected stdout: ${oneShot.stdout}`);
  } finally {
    rmSync(tmpPreloadDir, { recursive: true, force: true });
    rmSync(tmpHome, { recursive: true, force: true });
  }
});

await test('Native Anthropic Direct (/v1/messages) streams Claude 5.5 adaptive thinking + Claude 4.5 budget_tokens + prompt caching', async () => {
  const prevFetch = globalThis.fetch;
  const capturedCalls = [];
  const mockAnthropicUrl = `https:${SEP}${SEP}api.anthropic.com${SEP}v1`;

  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.startsWith(mockAnthropicUrl) && url.endsWith('messages')) {
      const body = JSON.parse(String(init.body || '{}'));
      capturedCalls.push({ headers: init.headers, body });
      return sseResponse([
        { type: 'message_start', message: { model: body.model, usage: { input_tokens: 40, cache_creation_input_tokens: 80, cache_read_input_tokens: 120 } } },
        { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'Checking Claude native messages.' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 'sig_abc_123' } },
        { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'Hello from Direct Claude!' } },
        { type: 'content_block_start', index: 2, content_block: { type: 'tool_use', id: 'toolu_99', name: 'list_dir' } },
        { type: 'content_block_delta', index: 2, delta: { type: 'input_json_delta', partial_json: '{"recursive":true}' } },
        { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 35 } },
        '[DONE]',
      ]);
    }
    return prevFetch(input, init);
  };

  try {
    const tmpDir = mkdtempSync(join(tmpdir(), 'oly-anth-'));
    const ep = resolveEndpointConfig({ sharedDir: tmpDir, anthropicToken: 'tok_ant_direct' }, null, false);
    assert.equal(ep.flavor, 'anthropic');
    assert.equal(ep.defaultModel, 'claude-sonnet-5-5');
    assert.equal(ep.headers['x-api-key'], 'tok_ant_direct');

    // 1. Default Claude 5.5 (`claude-sonnet-5-5`) uses adaptive thinking + output_config.effort + 2 cache breakpoints.
    const seenDeltas = [];
    const res = await streamChatCompletion({
      baseUrl: ep.baseUrl,
      headers: ep.headers,
      model: ep.defaultModel,
      providerFlavor: 'anthropic',
      reasoning: 'medium',
      messages: [
        { role: 'system', content: 'System prompt cached.' },
        { role: 'user', content: 'List workspace files.' },
      ],
      tools: [{ type: 'function', function: { name: 'list_dir', description: 'List dir', parameters: { type: 'object', properties: {} } } }],
      onDelta: (ev) => seenDeltas.push(ev),
    });

    assert.equal(capturedCalls[0].headers['x-api-key'], 'tok_ant_direct');
    assert.equal(capturedCalls[0].body.system[0].cache_control.type, 'ephemeral');
    assert.equal(capturedCalls[0].body.messages[0].content[0].cache_control.type, 'ephemeral');
    assert.deepEqual(capturedCalls[0].body.thinking, { type: 'adaptive' });
    assert.deepEqual(capturedCalls[0].body.output_config, { effort: 'medium' });
    assert.equal(res.thought, 'Checking Claude native messages.');
    assert.equal(res.content, 'Hello from Direct Claude!');
    assert.equal(res.toolCalls.length, 1);
    assert.equal(res.toolCalls[0].function.name, 'list_dir');
    assert.equal(res.usage.inputTokens, 40);
    assert.equal(res.usage.cachedWriteTokens, 80);
    assert.equal(res.usage.cachedReadTokens, 120);
    assert.equal(res.usage.totalTokens, 275);
    assert.equal(res.anthropicBlocks[0].signature, 'sig_abc_123');

    // 2. Legacy Claude 4.5 (`claude-sonnet-4-5`) keeps `thinking: { type: 'enabled', budget_tokens: 4096 }`.
    await streamChatCompletion({
      baseUrl: ep.baseUrl,
      headers: ep.headers,
      model: 'claude-sonnet-4-5',
      providerFlavor: 'anthropic',
      reasoning: 'medium',
      messages: [{ role: 'user', content: 'Check 4.5 thinking.' }],
    });
    assert.deepEqual(capturedCalls[1].body.thinking, { type: 'enabled', budget_tokens: 4096 });
    assert.equal(capturedCalls[1].body.output_config, undefined);

    rmSync(tmpDir, { recursive: true, force: true });
  } finally {
    globalThis.fetch = prevFetch;
  }
});

await runProviderStoreCases({
  APP,
  CURATED_MODELS,
  PROTOCOL_VERSION,
  childEnv,
  clearSavedCliSettingsKey,
  client,
  createOlympusAgentApp,
  getProviderKey,
  listSavedProviders,
  loadCliSettings,
  loadProviderSettings,
  methods,
  mockState,
  removeProvider,
  resolveConnectedProviders,
  resolveEndpointById,
  resolveEndpointConfig,
  saveCliSettings,
  setActiveProvider,
  setOlympusHomeDirOverride,
  setOlympusSharedDir,
  test,
  upsertProvider,
});

const failed = results.filter((r) => !r.ok);
console.log(`\nOlympus CLI suite: ${results.length - failed.length}/${results.length} passed.`);
if (failed.length) process.exit(1);
