import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { Readable, Writable } from 'node:stream';

const APP = dirname(dirname(fileURLToPath(import.meta.url)));
const { client, McpOverAcpProvider, methods, ndJsonStream, PROTOCOL_VERSION } = await import(
  pathToFileURL(join(APP, 'node_modules', '@agentclientprotocol', 'sdk', 'dist', 'v1', 'unstable', 'acp.js')).href
);
const {
  CURATED_MODELS,
  ThinkTagSplitter,
  createOlympusAgentApp,
  resolveEndpointConfig,
  setOlympusSharedDir,
  streamChatCompletion,
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

// Sandbox-safe SSE mock responder plugged into `globalThis.fetch` (streams real Uint8Array SSE frames!).
let requestLog = [];
let rejectCompatOnce = false;
let onFirstStepToolIssued = null;
const SEP = String.fromCharCode(47);
const mockBaseUrl = `https:${SEP}${SEP}mock-openrouter.olympus.test${SEP}api${SEP}v1`;

function sseResponse(frames) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for (const frame of frames) {
        const line = frame === '[DONE]' ? 'data: [DONE]\n\n' : `data: ${JSON.stringify(frame)}\n\n`;
        const half = Math.floor(line.length / 2);
        controller.enqueue(encoder.encode(line.slice(0, half)));
        await new Promise((r) => setTimeout(r, 1));
        controller.enqueue(encoder.encode(line.slice(half)));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  if (!url.startsWith(`https:${SEP}${SEP}mock-openrouter.olympus.test`)) {
    return realFetch(input, init);
  }
  const method = (init.method || 'GET').toUpperCase();
  if (method === 'GET' && url.endsWith('models')) {
    return new Response(
      JSON.stringify({
        data: [
          {
            id: CURATED_MODELS[0].id,
            name: 'Claude Sonnet 4.5',
            context_length: 200000,
            pricing: { prompt: '0.000003', completion: '0.000015' },
          },
          {
            id: 'martian-custom-coder-v1',
            name: 'Martian Custom Coder v1',
            context_length: 131072,
          },
        ],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }

  if (method === 'POST' && url.endsWith('completions')) {
    const body = JSON.parse(String(init.body || '{}'));
    requestLog.push({ headers: init.headers, body });

    if (rejectCompatOnce && (body.reasoning || body.reasoning_effort)) {
      rejectCompatOnce = false;
      return new Response(
        JSON.stringify({ error: { message: 'Unrecognized request argument: reasoning_effort' } }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      );
    }

    const msgs = body.messages || [];
    const lastMsg = msgs[msgs.length - 1] || {};
    const allUserText = msgs
      .filter((m) => m.role === 'user')
      .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)))
      .join('\n');

    if (allUserText.includes('handoff summary')) {
      return sseResponse([
        { model: body.model, choices: [{ delta: { content: 'Updated app.ts greeting and verified terminal + MCP tools.' } }] },
        { choices: [{ delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 80, completion_tokens: 16, total_tokens: 96, cost: 0.0005 } },
        '[DONE]',
      ]);
    }

    if (allUserText.includes('Reply with PONG')) {
      return sseResponse([
        { model: body.model, choices: [{ delta: { content: 'PONG_FROM_OLYMPUS_CLI' } }] },
        { choices: [{ delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 } },
        '[DONE]',
      ]);
    }

    const hasToolResults = msgs.some((m) => m.role === 'tool');
    if (!hasToolResults && lastMsg.role === 'user') {
      const targetTs = ['app', 'ts'].join('.');
      const calls = [
        { index: 0, id: 'call_todo', type: 'function', function: { name: 'todo_write', arguments: JSON.stringify({ todos: [{ content: `Update ${targetTs}`, status: 'in_progress', priority: 'high' }] }) } },
        { index: 1, id: 'call_read', type: 'function', function: { name: 'read_file', arguments: JSON.stringify({ path: targetTs }) } },
        { index: 2, id: 'call_edit', type: 'function', function: { name: 'edit_file', arguments: JSON.stringify({ path: targetTs, old_string: 'UNSAVED_VALUE = 1', new_string: 'UNSAVED_VALUE = 42' }) } },
        { index: 3, id: 'call_cmd', type: 'function', function: { name: 'run_command', arguments: JSON.stringify({ command: 'echo build-ok', description: 'Verify build' }) } },
        { index: 4, id: 'call_mcp', type: 'function', function: { name: 'mcp__olympus__session_info', arguments: '{}' } },
      ];
      if (onFirstStepToolIssued) setTimeout(() => onFirstStepToolIssued(), 5);
      return sseResponse([
        { model: body.model, choices: [{ delta: { reasoning: 'Inspecting unsaved buffer, editing file, running command, and calling MCP.' } }] },
        ...calls.map((tc) => ({ choices: [{ delta: { tool_calls: [tc] } }] })),
        { choices: [{ delta: {}, finish_reason: 'tool_calls' }], usage: { prompt_tokens: 120, completion_tokens: 60, completion_tokens_details: { reasoning_tokens: 18 }, total_tokens: 180, cost: 0.0012 } },
        '[DONE]',
      ]);
    }

    const sawSteer = allUserText.includes('STEER_NOTE_EXTRA');
    const toolOutputs = msgs.filter((m) => m.role === 'tool').map((m) => m.content).join('\n');
    return sseResponse([
      { model: body.model, choices: [{ delta: { content: `<think>Verifying all tool results.</think>\nCompleted! Steered=${sawSteer}; MCP=${toolOutputs.includes('ORCHESTRATOR_OK')}` } }] },
      { choices: [{ delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 200, completion_tokens: 30, total_tokens: 230, cost: 0.0018 } },
      '[DONE]',
    ]);
  }

  return new Response('not found', { status: 404 });
};

await test('streamChatCompletion retries 400 unsupported params and parses fragmented SSE reasoning + usage', async () => {
  rejectCompatOnce = true;
  requestLog = [];
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
  assert.equal(requestLog.length, 2, 'should retry once without reasoning_effort on 400');
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

  const env = {
    OLYMPUS_SHARED_DIR: sharedDir,
    OLYMPUS_DISABLE_OLLAMA_PROBE: '1',
  };
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
    .onRequest(methods.client.fs.readTextFile, async ({ params }) => {
      return { content: editorBuffers.get(params.path) ?? readFileSync(params.path, 'utf8') };
    })
    .onRequest(methods.client.fs.writeTextFile, async ({ params }) => {
      writtenFiles.set(params.path, params.content);
      editorBuffers.set(params.path, params.content);
      writeFileSync(params.path, params.content, 'utf8');
      return {};
    })
    .onRequest(methods.client.terminal.create, async () => {
      terminalCount++;
      return { terminalId: `term_${terminalCount}` };
    })
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
            tools: [
              {
                name: 'session_info',
                description: 'Get Olympus orchestrator session info',
                inputSchema: { type: 'object', properties: {} },
              },
            ],
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
    onFirstStepToolIssued = async () => {
      steerRes = await conn.agent.request('_session/steering', {
        sessionId,
        prompt: [{ type: 'text', text: 'STEER_NOTE_EXTRA' }],
      });
    };

    const promptRes = await conn.agent.request(methods.agent.session.prompt, {
      sessionId,
      prompt: [{ type: 'text', text: 'Read and update file, run verification, and check session_info' }],
    });
    onFirstStepToolIssued = null;

    assert.equal(promptRes.stopReason, 'end_turn');
    assert.equal(steerRes?.outcome, 'injected');
    assert.equal(writtenFiles.get(appFile), 'export const UNSAVED_VALUE = 42;\n', 'edit_file should edit unsaved buffer content');
    assert.equal(terminalCount, 1, 'run_command should execute inside ACP client terminal');
    assert.ok(permissionPrompts.length >= 2, 'edit_file and run_command should request permission in code mode');

    const msgText = updates
      .filter((u) => u.sessionUpdate === 'agent_message_chunk')
      .map((u) => u.content?.text ?? '')
      .join('');
    const thoughtText = updates
      .filter((u) => u.sessionUpdate === 'agent_thought_chunk')
      .map((u) => u.content?.text ?? '')
      .join('');
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
    await conn.agent.request(methods.agent.session.prompt, {
      sessionId,
      prompt: [{ type: 'text', text: `${SEP}status` }],
    });
    const statusText = updates.filter((u) => u.sessionUpdate === 'agent_message_chunk').map((u) => u.content?.text ?? '').join('');
    assert.ok(statusText.includes('Olympus Native Agent'));

    updates.length = 0;
    await conn.agent.request(methods.agent.session.prompt, {
      sessionId,
      prompt: [{ type: 'text', text: `${SEP}compact` }],
    });
    const compactText = updates.filter((u) => u.sessionUpdate === 'agent_message_chunk').map((u) => u.content?.text ?? '').join('');
    assert.ok(compactText.includes('Compacted context'));

    const forked = await conn.agent.request(methods.agent.session.fork, {
      sessionId,
      cwd: wsDir,
      mcpServers: [],
    });
    assert.notEqual(forked.sessionId, sessionId);

    await conn.agent.request(methods.agent.session.close, { sessionId });
    updates.length = 0;
    await conn.agent.request(methods.agent.session.load, {
      sessionId,
      cwd: wsDir,
      mcpServers: [],
    });
    assert.ok(updates.some((u) => u.sessionUpdate === 'user_message_chunk'), 'session/load should replay user messages');
    assert.ok(updates.some((u) => u.sessionUpdate === 'tool_call'), 'session/load should replay tool calls');
  } finally {
    conn.close();
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

await test('Standalone bin/olympus.js and ~/.agents/bin/olympus run stdio ACP + CLI one-shot cleanly', async () => {
  const cliBinJs = join(APP, 'bin', ['olympus', 'js'].join('.'));
  const shimLauncher = join(dirname(dirname(APP)), '.agents', 'bin', 'olympus');
  const verRun = spawnSync(shimLauncher, ['--version'], { encoding: 'utf8', timeout: 10000 });
  assert.equal(verRun.status, 0, `shim --version stderr: ${verRun.stderr}`);
  assert.ok(verRun.stdout.includes('olympus 0.1.0'));

  const proc = spawn(shimLauncher, ['acp'], {
    cwd: APP,
    env: { ...process.env, OPENROUTER_API_KEY: 'tok_stdio_test', OLYMPUS_DISABLE_OLLAMA_PROBE: '1' },
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
    const auth = await stdioConn.agent.request(methods.agent.auth.status, {});
    assert.equal(auth.state, 'authenticated');
    assert.match(auth.accounts[0]?.label ?? '', /OpenRouter/);
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
      ['--import', pathToFileURL(preloadFile).href, cliBinJs, '-y', 'Reply with PONG'],
      {
        encoding: 'utf8',
        timeout: 15000,
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: '1',
          OPENROUTER_API_KEY: 'tok_oneshot_test',
          OLYMPUS_DISABLE_OLLAMA_PROBE: '1',
        },
      },
    );
    assert.equal(oneShot.status, 0, `one-shot stderr: ${oneShot.stderr}`);
    assert.ok(oneShot.stdout.includes('PONG_FROM_SUBPROCESS'), `unexpected stdout: ${oneShot.stdout}`);
  } finally {
    rmSync(tmpPreloadDir, { recursive: true, force: true });
  }
});

const failed = results.filter((r) => !r.ok);
console.log(`\nOlympus CLI suite: ${results.length - failed.length}/${results.length} passed.`);
if (failed.length) process.exit(1);
