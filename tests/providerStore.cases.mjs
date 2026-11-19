import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { SEP, mockBaseUrl, mockSecondUrl } from './mockFetch.mjs';

const ANTH_URL = `https:${SEP}${SEP}api.anthropic.com${SEP}v1`;
const OR_URL = `https:${SEP}${SEP}openrouter.ai${SEP}api${SEP}v1`;
const LMSTUDIO_URL = `http:${SEP}${SEP}127.0.0.1:1234${SEP}v1`;
const modeOf = (f) => statSync(f).mode & 0o777;

export async function runProviderStoreCases(ctx) {
  const {
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
  } = ctx;

  await test('Migration: v1 settings + legacy olympus-cli become saved providers; keys leave settings.json', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'oly-mig-'));
    try {
      const base = join(tmp, 'base');
      mkdirSync(join(base, 'cli'), { recursive: true });
      mkdirSync(join(base, 'olympus-cli'), { recursive: true });
      const secret = 'sk-ant-MIGRATION-SECRET-123';
      const v1 = { providerFlavor: 'anthropic', baseUrl: ANTH_URL, providerKey: secret, defaultModel: 'claude-opus-4-5', defaultMode: 'plan', defaultReasoning: 'high' };
      writeFileSync(join(base, 'cli', 'settings.json'), JSON.stringify(v1));
      const legacyFile = join(base, 'olympus-cli', 'settings.json');
      const legacyText = JSON.stringify({ providerFlavor: 'ollama', baseUrl: LMSTUDIO_URL, defaultModel: 'qwen/qwen3.8-27b' });
      writeFileSync(legacyFile, legacyText);

      const s = loadProviderSettings(base);
      assert.deepEqual(s.providers.map((p) => p.id).sort(), ['anthropic', 'lmstudio']);
      assert.equal(s.activeProviderId, 'anthropic');
      const lm = s.providers.find((p) => p.id === 'lmstudio');
      assert.equal(lm.flavor, 'ollama', 'saved flavor kept');
      assert.equal(lm.label, 'LM Studio (local)');
      assert.equal(lm.defaultModel, 'qwen/qwen3.8-27b');
      assert.equal(s.providers.find((p) => p.id === 'anthropic').keyStore, 'file');
      assert.equal(getProviderKey('anthropic', base), secret);
      assert.equal(s.defaultMode, 'plan');
      assert.equal(s.defaultReasoning, 'high');

      const settingsFile = join(base, 'cli', 'settings.json');
      const raw = readFileSync(settingsFile, 'utf8');
      assert.ok(!raw.includes(secret), 'settings.json must not contain the key');
      assert.equal(JSON.parse(raw).version, 2);
      assert.equal(modeOf(join(base, 'cli', 'credentials.json')), 0o600);
      assert.equal(modeOf(join(base, 'cli')), 0o700);
      const backup = join(base, 'cli', 'settings.v1.backup.json');
      assert.equal(modeOf(backup), 0o600);
      assert.deepEqual(JSON.parse(readFileSync(backup, 'utf8')), v1);
      assert.equal(readFileSync(legacyFile, 'utf8'), legacyText, 'legacy file untouched');

      const again = loadProviderSettings(base);
      assert.equal(readFileSync(settingsFile, 'utf8'), raw);
      assert.equal(again.providers.length, 2);

      const compat = loadCliSettings(base);
      assert.equal(compat.providerFlavor, 'anthropic');
      assert.equal(compat.defaultModel, 'claude-opus-4-5');
      assert.equal(compat.defaultMode, 'plan');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  await test('Migration: ~/.agents/olympus-cli legacy is imported only for the default base', () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'oly-home-'));
    try {
      setOlympusHomeDirOverride(fakeHome);
      mkdirSync(join(fakeHome, '.agents', 'olympus-cli'), { recursive: true });
      writeFileSync(join(fakeHome, '.agents', 'olympus-cli', 'settings.json'), JSON.stringify({ providerFlavor: 'openrouter', baseUrl: OR_URL, providerKey: 'sk-or-LEGACY-AGENTS' }));

      const other = join(fakeHome, 'not-default');
      assert.equal(loadProviderSettings(other).providers.length, 0, 'non-default base ignores ~/.agents');

      const defBase = join(fakeHome, '.olympus');
      const s = loadProviderSettings(defBase);
      assert.deepEqual(s.providers.map((p) => p.id), ['openrouter']);
      assert.equal(s.activeProviderId, 'openrouter');
      assert.equal(getProviderKey('openrouter', defBase), 'sk-or-LEGACY-AGENTS');
      assert.ok(s.importedLegacy.some((f) => f.includes('.agents')));
      removeProvider('openrouter', defBase);
      assert.equal(loadProviderSettings(defBase).providers.length, 0);
    } finally {
      setOlympusHomeDirOverride('');
      rmSync(fakeHome, { recursive: true, force: true });
    }
  });

  await test('Migration: same LM Studio URL saved under two flavors (real-machine shape) becomes ONE provider', () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'oly-home-twin-'));
    try {
      setOlympusHomeDirOverride(fakeHome);
      const defBase = join(fakeHome, '.olympus');
      mkdirSync(join(defBase, 'cli'), { recursive: true });
      mkdirSync(join(fakeHome, '.agents', 'olympus-cli'), { recursive: true });
      writeFileSync(
        join(defBase, 'cli', 'settings.json'),
        JSON.stringify({ providerFlavor: 'ollama', baseUrl: LMSTUDIO_URL, defaultModel: 'qwen/qwen3.8-27b', defaultMode: 'code', defaultReasoning: 'medium' }),
      );
      writeFileSync(
        join(fakeHome, '.agents', 'olympus-cli', 'settings.json'),
        JSON.stringify({ providerFlavor: 'openai-compatible', baseUrl: LMSTUDIO_URL, defaultModel: 'qwen/qwen3.8-27b', defaultMode: 'code', defaultReasoning: 'high' }),
      );
      const s = loadProviderSettings(defBase);
      assert.deepEqual(s.providers.map((p) => p.id), ['lmstudio'], 'no lmstudio-2 twin');
      assert.equal(s.providers[0].flavor, 'ollama', 'the current file wins');
      assert.equal(s.activeProviderId, 'lmstudio');
      assert.equal(s.defaultReasoning, 'medium', 'current file defaults win over legacy');
      upsertProvider({ flavor: 'openai-compatible', baseUrl: `${LMSTUDIO_URL}${SEP}` }, {}, defBase);
      assert.equal(listSavedProviders(defBase).length, 1);
    } finally {
      setOlympusHomeDirOverride('');
      rmSync(fakeHome, { recursive: true, force: true });
    }
  });

  await test('Key cache: a key changed by another process is seen on the next read', () => {
    const base = mkdtempSync(join(tmpdir(), 'oly-xproc-'));
    try {
      upsertProvider({ flavor: 'anthropic', baseUrl: ANTH_URL, key: 'sk-ant-OLD-1' }, { makeActive: true }, base);
      assert.equal(getProviderKey('anthropic', base), 'sk-ant-OLD-1');
      const credFile = join(base, 'cli', 'credentials.json');
      const cred = JSON.parse(readFileSync(credFile, 'utf8'));
      cred.keys.anthropic = 'sk-ant-NEW-2';
      writeFileSync(credFile, JSON.stringify(cred));
      const settingsFile = join(base, 'cli', 'settings.json');
      const st = JSON.parse(readFileSync(settingsFile, 'utf8'));
      st.providers[0].updatedAt += 1;
      writeFileSync(settingsFile, JSON.stringify(st));
      assert.equal(getProviderKey('anthropic', base), 'sk-ant-NEW-2');
      assert.equal(resolveEndpointConfig({ sharedDir: base }).headers['x-api-key'], 'sk-ant-NEW-2');
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  await test('Switching providers never deletes others; re-login updates in place', () => {
    const base = mkdtempSync(join(tmpdir(), 'oly-switch-'));
    try {
      const a = upsertProvider({ flavor: 'anthropic', baseUrl: ANTH_URL, key: 'sk-ant-SWITCH-1' }, { makeActive: true }, base);
      assert.equal(a.created, true);
      const lm = upsertProvider({ flavor: 'openai-compatible', baseUrl: LMSTUDIO_URL, defaultModel: 'qwen-local' }, { makeActive: true }, base);
      assert.equal(lm.provider.id, 'lmstudio');
      assert.equal(loadProviderSettings(base).activeProviderId, 'lmstudio');
      assert.equal(getProviderKey('anthropic', base), 'sk-ant-SWITCH-1', 'anthropic key survives switching');

      const conn = resolveConnectedProviders({ sharedDir: base }, null, false);
      assert.deepEqual(conn.providers.map((p) => p.id).sort(), ['anthropic', 'lmstudio']);
      assert.equal(conn.defaultId, 'lmstudio');
      assert.equal(resolveEndpointById({ sharedDir: base }, 'anthropic').headers['x-api-key'], 'sk-ant-SWITCH-1');

      setActiveProvider('anthropic', base);
      assert.equal(resolveEndpointConfig({ sharedDir: base }).providerId, 'anthropic');
      setActiveProvider('lmstudio', base);
      const rm = removeProvider('lmstudio', base);
      assert.equal(rm.activeProviderId, 'anthropic');
      assert.deepEqual(listSavedProviders(base).map((p) => p.id), ['anthropic']);

      const again = upsertProvider({ flavor: 'anthropic', baseUrl: `${ANTH_URL}${SEP}`, key: 'sk-ant-SWITCH-2' }, {}, base);
      assert.equal(again.created, false);
      assert.equal(listSavedProviders(base).length, 1, 'no duplicate');
      assert.equal(getProviderKey('anthropic', base), 'sk-ant-SWITCH-2');
      assert.equal(resolveEndpointConfig({ sharedDir: base }).headers['x-api-key'], 'sk-ant-SWITCH-2');

      upsertProvider({ flavor: 'openrouter', baseUrl: OR_URL, key: 'sk-or-KEEP' }, {}, base);
      saveCliSettings({ defaultModel: 'claude-haiku-5-5' }, base);
      assert.equal(listSavedProviders(base).find((p) => p.id === 'anthropic').defaultModel, 'claude-haiku-5-5');
      clearSavedCliSettingsKey(base);
      assert.equal(getProviderKey('anthropic', base), undefined);
      assert.equal(getProviderKey('openrouter', base), 'sk-or-KEEP', 'clearing the active key keeps other providers');
      const raw = readFileSync(join(base, 'cli', 'settings.json'), 'utf8');
      assert.ok(!raw.includes('sk-or-KEEP') && !raw.includes('sk-ant-SWITCH'));
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  await test('ACP with two saved providers: grouped models, per-session provider routing, auth/status, logout', async () => {
    const tmpRoot = mkdtempSync(join(tmpdir(), 'oly-acp2-'));
    const sharedDir = join(tmpRoot, 'shared');
    const wsDir = join(tmpRoot, 'ws');
    mkdirSync(wsDir, { recursive: true });
    setOlympusSharedDir(sharedDir);
    const a = upsertProvider({ flavor: 'openai-compatible', baseUrl: mockBaseUrl, key: 'tok_A_secret', defaultModel: 'martian-custom-coder-v1' }, { makeActive: true }, sharedDir).provider;
    const b = upsertProvider({ flavor: 'openai-compatible', baseUrl: mockSecondUrl, key: 'tok_B_secret' }, { makeActive: false }, sharedDir).provider;
    const updates = [];
    const agentApp = createOlympusAgentApp({ env: { OLYMPUS_SHARED_DIR: sharedDir, OLYMPUS_DISABLE_OLLAMA_PROBE: '1' }, version: '0.1.0' });
    const conn = client({ name: 'two-provider-test' })
      .onNotification(methods.client.session.update, ({ params }) => updates.push(params.update))
      .onNotification(methods.client.auth.statusUpdate, () => {})
      .connect(agentApp);
    try {
      await conn.agent.request(methods.agent.initialize, { protocolVersion: PROTOCOL_VERSION, clientCapabilities: {}, clientInfo: { name: 't', version: '0' } });
      const auth = await conn.agent.request(methods.agent.auth.status, {});
      assert.equal(auth.state, 'authenticated');
      assert.equal(auth.accounts.length, 2);
      assert.equal(auth.accounts.filter((x) => x.active).length, 1);
      assert.equal(auth.accounts.find((x) => x.active)._meta.providerId, a.id);
      assert.ok(!JSON.stringify(auth).includes('tok_A_secret') && !JSON.stringify(auth).includes('tok_B_secret'));

      const provList = await conn.agent.request(methods.agent.providers.list, {});
      assert.deepEqual(provList.providers.map((p) => p.providerId), ['openai', a.id, b.id]);
      assert.ok(!JSON.stringify(provList).includes('tok_'));

      const newRes = await conn.agent.request(methods.agent.session.new, { cwd: wsDir, mcpServers: [] });
      const modelOpt = newRes.configOptions.find((o) => o.id === 'model');
      const values = modelOpt.options.flatMap((g) => g.options.map((x) => x.value));
      assert.ok(values.includes('martian-custom-coder-v1'), 'provider A models listed');
      assert.ok(values.includes('second-only-model'), 'provider B models listed');
      assert.ok(values.includes(`${a.id}::${CURATED_MODELS[0].id}`) && values.includes(`${b.id}::${CURATED_MODELS[0].id}`), 'shared ids are provider-qualified');
      assert.ok(modelOpt.options.some((g) => g.name.startsWith(a.label)) && modelOpt.options.some((g) => g.name.startsWith(b.label)));
      assert.equal(modelOpt.currentValue, 'martian-custom-coder-v1');

      const setRes = await conn.agent.request(methods.agent.session.setConfigOption, { sessionId: newRes.sessionId, configId: 'model', value: 'second-only-model' });
      assert.equal(setRes.configOptions.find((o) => o.id === 'model').currentValue, 'second-only-model');
      const after = loadProviderSettings(sharedDir);
      assert.equal(after.activeProviderId, b.id, 'picking a model on B makes B active');
      assert.equal(after.providers.find((p) => p.id === b.id).defaultModel, 'second-only-model');

      mockState.requestLog.length = 0;
      const promptRes = await conn.agent.request(methods.agent.session.prompt, { sessionId: newRes.sessionId, prompt: [{ type: 'text', text: 'Reply with PONG' }] });
      assert.equal(promptRes.stopReason, 'end_turn');
      assert.equal(mockState.requestLog.length, 1);
      assert.ok(mockState.requestLog[0].url.startsWith(mockSecondUrl), `prompt went to ${mockState.requestLog[0].url}`);
      assert.equal(mockState.requestLog[0].headers.Authorization, 'Bearer tok_B_secret');
      assert.equal(mockState.requestLog[0].body.model, 'second-only-model');

      setActiveProvider(a.id, sharedDir);
      const sessDir = join(sharedDir, 'cli', 'sessions');
      const oldSession = JSON.parse(readFileSync(join(sessDir, `${newRes.sessionId}.json`), 'utf8'));
      delete oldSession.providerId;
      oldSession.sessionId = 'oly_legacy_no_provider';
      writeFileSync(join(sessDir, 'oly_legacy_no_provider.json'), JSON.stringify(oldSession));
      await conn.agent.request(methods.agent.session.load, { sessionId: 'oly_legacy_no_provider', cwd: wsDir, mcpServers: [] });
      mockState.requestLog.length = 0;
      await conn.agent.request(methods.agent.session.prompt, { sessionId: 'oly_legacy_no_provider', prompt: [{ type: 'text', text: 'Reply with PONG' }] });
      assert.ok(mockState.requestLog[0].url.startsWith(mockSecondUrl), 'legacy session inferred provider B from its model');
      assert.equal(JSON.parse(readFileSync(join(sessDir, 'oly_legacy_no_provider.json'), 'utf8')).providerId, b.id);

      await conn.agent.request(methods.agent.session.setConfigOption, { sessionId: newRes.sessionId, configId: 'model', value: `${a.id}::${CURATED_MODELS[0].id}` });
      assert.equal(loadProviderSettings(sharedDir).activeProviderId, a.id);

      await conn.agent.request(methods.agent.logout, {});
      assert.deepEqual(listSavedProviders(sharedDir).map((p) => p.id), [b.id], 'logout removes only the active provider');
      assert.equal(getProviderKey(b.id, sharedDir), 'tok_B_secret');
      const authAfter = await conn.agent.request(methods.agent.auth.status, {});
      assert.equal(authAfter.accounts.length, 1);
    } finally {
      conn.close();
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  await test('CLI: bin/oly providers lists saved providers without printing keys; use / rm work', () => {
    const tmpHome = mkdtempSync(join(tmpdir(), 'oly-cli-'));
    try {
      const keyA = 'sk-ant-CLI-LISTING-SECRET-9';
      upsertProvider({ flavor: 'anthropic', baseUrl: ANTH_URL, key: keyA, defaultModel: 'claude-sonnet-5-5' }, { makeActive: true }, tmpHome);
      upsertProvider({ flavor: 'openai-compatible', baseUrl: LMSTUDIO_URL, defaultModel: 'qwen-local' }, { makeActive: false }, tmpHome);
      const cliBin = join(APP, 'bin', 'oly');
      const run = (args) => spawnSync(process.execPath, [cliBin, ...args], { encoding: 'utf8', timeout: 15000, env: childEnv(tmpHome) });
      const list = run(['providers']);
      assert.equal(list.status, 0, list.stderr);
      assert.ok(list.stdout.includes('anthropic') && list.stdout.includes('lmstudio'), list.stdout);
      assert.ok(list.stdout.includes('LM Studio (local)'));
      assert.ok(list.stdout.includes('file'));
      assert.match(list.stdout, /\*\s+anthropic/);
      assert.ok(!list.stdout.includes(keyA) && !list.stderr.includes(keyA), 'key never printed');

      const use = run(['use', 'lmstudio']);
      assert.equal(use.status, 0, use.stderr);
      assert.equal(loadProviderSettings(tmpHome).activeProviderId, 'lmstudio');
      const bad = run(['providers', 'use', 'nope']);
      assert.notEqual(bad.status, 0);
      const rm = run(['providers', 'rm', 'lmstudio', '-y']);
      assert.equal(rm.status, 0, rm.stderr);
      assert.deepEqual(listSavedProviders(tmpHome).map((p) => p.id), ['anthropic']);
      for (const r of [use, bad, rm]) assert.ok(!r.stdout.includes(keyA) && !r.stderr.includes(keyA));
    } finally {
      rmSync(tmpHome, { recursive: true, force: true });
    }
  });

  if (process.env.OLY_TEST_KEYCHAIN === '1') {
    await test('Keychain backend (OLY_TEST_KEYCHAIN=1): store, read, remove with a throwaway service', () => {
      const base = mkdtempSync(join(tmpdir(), 'oly-kc-'));
      const service = `olympus-cli-test-${process.pid}-${Date.now()}`;
      const prev = { store: process.env.OLYMPUS_SECRET_STORE, svc: process.env.OLYMPUS_KEYCHAIN_SERVICE };
      process.env.OLYMPUS_SECRET_STORE = 'keychain';
      process.env.OLYMPUS_KEYCHAIN_SERVICE = service;
      const secret = 'sk-kc-TEST-"quoted"\\back$lash';
      try {
        const res = upsertProvider({ flavor: 'anthropic', baseUrl: ANTH_URL, key: secret }, { makeActive: true }, base);
        assert.equal(res.provider.keyStore, 'keychain');
        const found = spawnSync('/usr/bin/security', ['find-generic-password', '-s', service, '-w'], { encoding: 'utf8' });
        assert.equal(found.status, 0);
        assert.equal(found.stdout.replace(/\n$/, ''), secret, 'stored exactly');
        assert.ok(!existsSync(join(base, 'cli', 'credentials.json')) || !readFileSync(join(base, 'cli', 'credentials.json'), 'utf8').includes(secret));
        assert.equal(getProviderKey('anthropic', base), secret);
        removeProvider('anthropic', base);
        const gone = spawnSync('/usr/bin/security', ['find-generic-password', '-s', service], { encoding: 'utf8' });
        assert.notEqual(gone.status, 0, 'keychain item deleted on remove');
      } finally {
        spawnSync('/usr/bin/security', ['delete-generic-password', '-s', service], { stdio: 'ignore' });
        process.env.OLYMPUS_SECRET_STORE = prev.store;
        if (prev.svc === undefined) delete process.env.OLYMPUS_KEYCHAIN_SERVICE;
        else process.env.OLYMPUS_KEYCHAIN_SERVICE = prev.svc;
        rmSync(base, { recursive: true, force: true });
      }
    });
  }
}
