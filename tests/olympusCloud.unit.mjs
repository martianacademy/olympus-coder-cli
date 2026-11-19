import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.env.OLYMPUS_SECRET_STORE = 'file';
const APP = dirname(dirname(fileURLToPath(import.meta.url)));
const CLOUD_APP_DIST = resolve(APP, '..', 'olympus-coder', 'cloud', 'dist', 'app.js');
const CLOUD_BUDGET_DIST = resolve(APP, '..', 'olympus-coder', 'cloud', 'dist', 'budgetCore.js');
const CLOUD_WALLET_DIST = resolve(APP, '..', 'olympus-coder', 'cloud', 'dist', 'walletCore.js');

const { client, methods, PROTOCOL_VERSION } = await import(
  pathToFileURL(join(APP, 'node_modules', '@agentclientprotocol', 'sdk', 'dist', 'v1', 'unstable', 'acp.js')).href
);
const {
  createOlympusAgentApp,
  deriveProviderId,
  fetchOlympusCloudStatus,
  formatResetUtc,
  GATEWAY_ENDPOINTS,
  inferFlavorFromUrl,
  labelForFlavor,
  runOlympusCloudBrowserLogin,
  setActiveProvider,
  setOlympusSharedDir,
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

await test('Olympus Cloud flavor metadata, URL inference, caching rules, and #1 ACP auth method ordering', async () => {
  assert.equal(GATEWAY_ENDPOINTS.olympusCloud, 'https://olympus-cloud.olympus-relay.workers.dev/v1');
  assert.equal(inferFlavorFromUrl(GATEWAY_ENDPOINTS.olympusCloud), 'olympus-cloud');
  assert.equal(inferFlavorFromUrl('https://api.olympuscoder.app/v1'), 'olympus-cloud');
  assert.equal(labelForFlavor('olympus-cloud', GATEWAY_ENDPOINTS.olympusCloud), 'Olympus Cloud');
  assert.equal(deriveProviderId('olympus-cloud', GATEWAY_ENDPOINTS.olympusCloud), 'olympus-cloud');

  assert.equal(supportsChatExplicitCaching('anthropic/claude-sonnet-5.5', 'olympus-cloud'), true);
  assert.equal(supportsChatExplicitCaching('google/gemini-2.5-pro', 'olympus-cloud'), true);
  assert.equal(supportsChatExplicitCaching('olympus/auto-free', 'olympus-cloud'), false);
  assert.equal(supportsChatExplicitCaching('qwen/qwen3-coder:free', 'olympus-cloud'), false);

  // Default mode: Olympus Cloud paid option stays hidden until launch (OLYMPUS_CLOUD_ENABLED=1)
  const hiddenApp = createOlympusAgentApp({ env: { OLYMPUS_DISABLE_OLLAMA_PROBE: '1' }, version: '0.2.0' });
  const hiddenConn = client({ name: 'init-default-hidden' })
    .onNotification(methods.client.session.update, () => {})
    .onNotification(methods.client.auth.statusUpdate, () => {})
    .connect(hiddenApp);
  const hiddenInit = await hiddenConn.agent.request(methods.agent.initialize, {
    protocolVersion: PROTOCOL_VERSION,
    clientCapabilities: {},
    clientInfo: { name: 't', version: '0' },
  });
  assert.equal(hiddenInit.authMethods[0].id, 'openrouter', 'BYO OpenRouter is #1 when Olympus Cloud is hidden');
  assert.equal(hiddenInit.authMethods.some((m) => m.id.startsWith('olympus-cloud')), false, 'Olympus Cloud auth options stay hidden by default');
  assert.ok(hiddenInit.authMethods.some((m) => m.id === 'ollama-local'), 'Zero-key Ollama remains available');
  hiddenConn.close();

  // Opt-in feature flag mode (OLYMPUS_CLOUD_ENABLED=1): Olympus Cloud appears #1 for pre-launch development
  const app = createOlympusAgentApp({ env: { OLYMPUS_DISABLE_OLLAMA_PROBE: '1', OLYMPUS_CLOUD_ENABLED: '1' }, version: '0.2.0' });
  const conn = client({ name: 'init-check' })
    .onNotification(methods.client.session.update, () => {})
    .onNotification(methods.client.auth.statusUpdate, () => {})
    .connect(app);
  const init = await conn.agent.request(methods.agent.initialize, {
    protocolVersion: PROTOCOL_VERSION,
    clientCapabilities: {},
    clientInfo: { name: 't', version: '0' },
  });
  assert.equal(init.authMethods[0].id, 'olympus-cloud-oauth', '1-click GitHub OAuth is #1 when OLYMPUS_CLOUD_ENABLED=1');
  assert.ok(init.authMethods.some((m) => m.id === 'openrouter'), 'BYO OpenRouter remains available');
  assert.ok(init.authMethods.some((m) => m.id === 'ollama-local'), 'Zero-key Ollama remains available');
  conn.close();

  assert.equal(formatResetUtc(Date.UTC(2026, 11, 19, 0, 0, 0)), 'Dec 19, 12:00 AM UTC');
});

await test('End-to-end oly <-> Olympus Cloud Worker: 0-credit 402 guard, paid cached turn, /status bars, and zero-charge BYO provider switch', async () => {
  assert.ok(existsSync(CLOUD_APP_DIST), `Expected compiled cloud app at ${CLOUD_APP_DIST}`);
  const { createCloudApp } = await import(pathToFileURL(CLOUD_APP_DIST).href);
  const { BudgetCore } = await import(pathToFileURL(CLOUD_BUDGET_DIST).href);
  const { WalletCore } = await import(pathToFileURL(CLOUD_WALLET_DIST).href);

  const makeKv = () => {
    const m = new Map();
    return {
      async get(k) { const v = m.get(k); return v === undefined ? undefined : structuredClone(v); },
      async put(k, v) { m.set(k, structuredClone(v)); },
    };
  };

  const usersByHash = new Map();
  const wallets = new Map();
  const cloudLedger = [];
  const upstreamBodies = [];
  let byoHits = 0;

  const cloud = createCloudApp({
    metadata: {
      async lookupToken(h) { return usersByHash.get(h) ?? null; },
      async upsertDevUser(u, h) { usersByHash.set(h, { ...u }); },
      async updateUserPlan() {},
      async recordUsage(row) { cloudLedger.push(row); },
    },
    getWallet(uid) {
      let w = wallets.get(uid);
      if (!w) { w = new WalletCore(makeKv(), uid); wallets.set(uid, w); }
      return w;
    },
    budget: new BudgetCore(makeKv()),
    upstreams: {
      openrouter: { baseUrl: 'https://upstream-or.mock/v1', apiKey: 'sk-master-or', protocol: 'openai' },
    },
    globalFreeDailyUsdCap: 0,
    freeDailyReqLimitOverride: 0,
    allowDevAuth: true,
    fetchImpl: async (_url, init = {}) => {
      const b = JSON.parse(String(init.body || '{}'));
      upstreamBodies.push(b);
      return sseFrames([
        {
          model: b.model,
          choices: [{ delta: { content: 'PAID_SONNET_OK' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 100_000, completion_tokens: 1_000, total_tokens: 101_000, prompt_tokens_details: { cached_tokens: 90_000, cache_write_tokens: 5_000 } },
        },
        '[DONE]',
      ]);
    },
  });

  // 0. Unpaid 0-credit user gets 402 INSUFFICIENT_CREDITS with ZERO upstream calls & clear /status guidance
  const unpaidRes = await cloud.fetch(
    new Request('https://api.olympuscoder.app/v1/auth/dev-issue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'usr_zero', email: 'zero@olympus.test', plan: 'free', githubVerified: true }),
    }),
  );
  const { token: zeroToken } = await unpaidRes.json();
  const blockedRes = await cloud.fetch(
    new Request('https://api.olympuscoder.app/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${zeroToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'anthropic/claude-sonnet-5.5', stream: true, messages: [{ role: 'user', content: 'hi' }] }),
    }),
  );
  assert.equal(blockedRes.status, 402);
  assert.equal(upstreamBodies.length, 0, '0-credit account must never hit upstream');

  // Issue a Starter ($20 -> 2,000 credits) Olympus Cloud user token
  const issueRes = await cloud.fetch(
    new Request('https://api.olympuscoder.app/v1/auth/dev-issue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'usr_e2e', email: 'suru@olympus.test', plan: 'starter', githubVerified: false }),
    }),
  );
  const { token: olyToken } = await issueRes.json();

  const prevFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.startsWith('https://api.olympuscoder.app/')) {
      return cloud.fetch(new Request(url, init));
    }
    if (url.startsWith('https://byo-openrouter.mock/')) {
      if (url.endsWith('/models')) {
        return new Response(JSON.stringify({ data: [{ id: 'openai/gpt-5-mini', name: 'GPT-5 Mini', context_length: 400_000 }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      byoHits++;
      return sseFrames([
        { model: 'openai/gpt-5-mini', choices: [{ delta: { content: 'BYO_OK' }, finish_reason: 'stop' }], usage: { prompt_tokens: 50, completion_tokens: 5, total_tokens: 55 } },
        '[DONE]',
      ]);
    }
    throw new Error(`Unexpected network URL in test: ${url}`);
  };

  const tmp = mkdtempSync(join(tmpdir(), 'oly-cloud-e2e-'));
  try {
    const shared = join(tmp, 'shared');
    const ws = join(tmp, 'ws');
    mkdirSync(ws, { recursive: true });
    setOlympusSharedDir(shared);

    const zeroStatus = await fetchOlympusCloudStatus('https://api.olympuscoder.app/v1', { Authorization: `Bearer ${zeroToken}` });
    assert.equal(zeroStatus.gatewayLabel, 'Olympus Cloud · No Active Plan');
    assert.match(zeroStatus.lines[0], /No active credits/);
    assert.match(zeroStatus.lines[0], /Local Ollama/);

    const updates = [];
    const app = createOlympusAgentApp({ env: { OLYMPUS_SHARED_DIR: shared, OLYMPUS_DISABLE_OLLAMA_PROBE: '1' }, version: '0.2.0' });
    const conn = client({ name: 'oly-cloud-client' })
      .onNotification(methods.client.session.update, ({ params }) => updates.push(params.update))
      .onNotification(methods.client.auth.statusUpdate, () => {})
      .connect(app);

    await conn.agent.request(methods.agent.initialize, {
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: {},
      clientInfo: { name: 't', version: '0' },
    });

    // 1. Sign in to Olympus Cloud via ACP `authenticate`
    await conn.agent.request(methods.agent.authenticate, {
      methodId: 'olympus-cloud',
      _meta: { 'api-key': { apiKey: olyToken, baseUrl: 'https://api.olympuscoder.app/v1' } },
    });

    const s = await conn.agent.request(methods.agent.session.new, { cwd: ws, mcpServers: [] });

    // 2. Paid Sonnet 5.5 -> oly injects cache_control breakpoints & Olympus Cloud deducts exact credits
    await conn.agent.request(methods.agent.session.setConfigOption, {
      sessionId: s.sessionId,
      configId: 'model',
      value: 'anthropic/claude-sonnet-5.5',
    });
    await conn.agent.request(methods.agent.session.prompt, {
      sessionId: s.sessionId,
      prompt: [{ type: 'text', text: 'Build feature with caching' }],
    });
    assert.equal(cloudLedger.length, 1);
    assert.equal(cloudLedger[0].lane, 'paid');
    assert.ok(cloudLedger[0].creditsCharged > 0, 'paid model deducts credits');
    const lastUpstreamBody = upstreamBodies.at(-1);
    assert.deepEqual(lastUpstreamBody.messages[0].content[0].cache_control, { type: 'ephemeral' }, 'system prompt cached over Olympus Cloud');

    // 3. Run `/status` -> emits limitProbe-compatible credit bar with NO free daily requests bar
    updates.length = 0;
    await conn.agent.request(methods.agent.session.prompt, {
      sessionId: s.sessionId,
      prompt: [{ type: 'text', text: '/status' }],
    });
    const statusText = updates
      .filter((u) => u.sessionUpdate === 'agent_message_chunk')
      .map((u) => u.content?.text ?? '')
      .join('');
    assert.match(statusText, /\*\*Gateway\*\*: Olympus Cloud · Starter/);
    assert.match(statusText, /\*\*Olympus Cloud credits\*\* — \*\*\d+%\*\* · Resets .+ · \$\d+\.\d{2} of \$15\.00/);
    assert.doesNotMatch(statusText, /Free daily requests/);

    // 4. Add a BYO OpenRouter key & switch to it -> 0 additional Olympus Cloud ledger hits or credit deductions!
    const creditsBeforeByo = (await fetchOlympusCloudStatus('https://api.olympuscoder.app/v1', { Authorization: `Bearer ${olyToken}` })).lines[0];
    upsertProvider({ flavor: 'openrouter', baseUrl: 'https://byo-openrouter.mock/v1', key: 'sk-byo-user', defaultModel: 'openai/gpt-5-mini' }, { makeActive: true }, shared);
    setActiveProvider('openrouter', shared);
    await conn.agent.request(methods.agent.session.setConfigOption, {
      sessionId: s.sessionId,
      configId: 'model',
      value: 'openrouter::openai/gpt-5-mini',
    });
    await conn.agent.request(methods.agent.session.prompt, {
      sessionId: s.sessionId,
      prompt: [{ type: 'text', text: 'Run on my own BYO key' }],
    });
    assert.equal(byoHits, 1);
    assert.equal(cloudLedger.length, 1, 'switching to BYO provider never hits or bills Olympus Cloud');
    const creditsAfterByo = (await fetchOlympusCloudStatus('https://api.olympuscoder.app/v1', { Authorization: `Bearer ${olyToken}` })).lines[0];
    assert.equal(creditsAfterByo, creditsBeforeByo, 'Olympus Cloud credit balance unchanged during BYO usage');

    conn.close();
  } finally {
    globalThis.fetch = prevFetch;
    rmSync(tmp, { recursive: true, force: true });
  }
});

await test('1-click browser login (runOlympusCloudBrowserLogin) binds 127.0.0.1, rejects CSRF mismatch, and completes real GitHub OAuth redirect loop', async () => {
  const { createCloudApp } = await import(pathToFileURL(CLOUD_APP_DIST).href);
  const { BudgetCore } = await import(pathToFileURL(CLOUD_BUDGET_DIST).href);
  const { WalletCore } = await import(pathToFileURL(CLOUD_WALLET_DIST).href);

  const makeKv = () => {
    const m = new Map();
    return {
      async get(k) { const v = m.get(k); return v === undefined ? undefined : structuredClone(v); },
      async put(k, v) { m.set(k, structuredClone(v)); },
    };
  };
  const usersByHash = new Map();
  const wallets = new Map();
  const realFetch = globalThis.fetch;

  const cloud = createCloudApp({
    metadata: {
      async lookupToken(h) { return usersByHash.get(h) ?? null; },
      async upsertOAuthUser(input, h) {
        const u = { userId: `usr_${input.githubId}`, email: input.email, plan: 'free', officialOnly: false, githubVerified: true };
        usersByHash.set(h, u);
        return { user: u, isNewUser: true };
      },
      async updateUserPlan() {},
      async recordUsage() {},
    },
    getWallet(uid) {
      let w = wallets.get(uid);
      if (!w) { w = new WalletCore(makeKv(), uid); wallets.set(uid, w); }
      return w;
    },
    budget: new BudgetCore(makeKv()),
    upstreams: {},
    globalFreeDailyUsdCap: 10,
    oauth: {
      githubClientId: 'gh_cli_id',
      githubClientSecret: 'gh_cli_secret',
      oauthStateSecret: 'state_secret_cli_loopback',
    },
    fetchImpl: async (url) => {
      const u = String(url);
      if (u.endsWith('/login/oauth/access_token')) return Response.json({ access_token: 'gho_cli_ok' });
      if (u.endsWith('/user')) return Response.json({ id: 777, login: 'suru', email: 'suru@martian.dev', created_at: '2020-01-01T00:00:00Z' });
      throw new Error(`Unexpected URL: ${u}`);
    },
  });

  const loginRes = await runOlympusCloudBrowserLogin('https://api.olympuscoder.app/v1', {
    timeoutMs: 10_000,
    openBrowser: (authStartUrl) => {
      (async () => {
        // 1. Simulate CSRF attacker hitting local callback with wrong state -> 400 rejected, listener stays open
        const startParsed = new URL(authStartUrl);
        const port = startParsed.searchParams.get('cli_port');
        const badCb = await realFetch(`http://127.0.0.1:${port}/callback?token=oly_live_fake&state=wrong_state`);
        assert.equal(badCb.status, 400);

        // 2. Follow real Olympus Cloud -> GitHub -> Olympus Cloud -> 127.0.0.1:<port>/callback flow
        const r1 = await cloud.fetch(new Request(authStartUrl));
        assert.equal(r1.status, 302);
        const ghLoc = new URL(r1.headers.get('location'));
        const cookie = (r1.headers.get('set-cookie') ?? '').split(';')[0];

        const r2 = await cloud.fetch(
          new Request(`https://api.olympuscoder.app/v1/auth/github/callback?code=valid_code&state=${encodeURIComponent(ghLoc.searchParams.get('state'))}`, {
            headers: { Cookie: cookie },
          }),
        );
        assert.equal(r2.status, 302);
        const localCbUrl = r2.headers.get('location');
        const r3 = await realFetch(localCbUrl);
        assert.equal(r3.status, 200);
        const html = await r3.text();
        assert.match(html, /Signed in to Olympus Cloud/);
        assert.match(html, /history\.replaceState/);
      })().catch((err) => {
        console.error('Simulated browser flow failed:', err);
      });
    },
  });

  assert.match(loginRes.token, /^oly_live_[a-f0-9]{48}$/);
  assert.equal(loginRes.email, 'suru@martian.dev');
  assert.equal(loginRes.plan, 'free');

  // 3. Also verify ACP `authenticate({ methodId: 'olympus-cloud-oauth' })` (used by Olympus Coder desktop LoginDialog!)
  const tmp = mkdtempSync(join(tmpdir(), 'oly-acp-oauth-'));
  try {
    const shared = join(tmp, 'shared');
    mkdirSync(shared, { recursive: true });
    setOlympusSharedDir(shared);
    const app = createOlympusAgentApp({
      env: { OLYMPUS_SHARED_DIR: shared, OLYMPUS_DISABLE_OLLAMA_PROBE: '1' },
      version: '0.2.0',
      openBrowser: (authStartUrl) => {
        (async () => {
          const r1 = await cloud.fetch(new Request(authStartUrl));
          const ghLoc = new URL(r1.headers.get('location'));
          const cookie = (r1.headers.get('set-cookie') ?? '').split(';')[0];
          const r2 = await cloud.fetch(
            new Request(`https://api.olympuscoder.app/v1/auth/github/callback?code=acp_code&state=${encodeURIComponent(ghLoc.searchParams.get('state'))}`, {
              headers: { Cookie: cookie },
            }),
          );
          await realFetch(r2.headers.get('location'));
        })().catch((err) => console.error('ACP OAuth simulation failed:', err));
      },
    });
    const statusUpdates = [];
    const conn = client({ name: 'desktop-login-dialog' })
      .onNotification(methods.client.session.update, () => {})
      .onNotification(methods.client.auth.statusUpdate, ({ params }) => statusUpdates.push(params))
      .connect(app);
    await conn.agent.request(methods.agent.initialize, {
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: {},
      clientInfo: { name: 'olympus-coder', version: '0.3.0' },
    });
    await conn.agent.request(methods.agent.authenticate, { methodId: 'olympus-cloud-oauth' });
    const authStatus = await conn.agent.request(methods.agent.auth.status, {});
    assert.equal(authStatus.state, 'authenticated');
    assert.equal(authStatus.accounts[0].id, 'olympus-cloud');
    assert.equal(authStatus.accounts[0].label, 'Olympus Cloud (suru@martian.dev)');
    assert.equal(authStatus.accounts[0].active, true);
    assert.ok(statusUpdates.length >= 1, 'emitted auth/statusUpdate to desktop client');
    conn.close();
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

const failed = results.filter((r) => !r.ok);
console.log(`\nOlympus Cloud CLI integration suite: ${results.length - failed.length}/${results.length} passed.`);
if (failed.length) process.exit(1);
