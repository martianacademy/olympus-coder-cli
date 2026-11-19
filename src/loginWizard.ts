/**
 * Interactive `oly login` wizard with hidden TTY secret input (`Prompter`) for BYO API keys
 * (OpenRouter, Anthropic Direct, Vercel AI Gateway, Custom OpenAI) and local servers (Ollama, LM Studio).
 * Olympus Cloud stays hidden until launched (`OLYMPUS_CLOUD_ENABLED=1`).
 */

import { createInterface, type Interface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { runOlympusCloudBrowserLogin } from './browserLogin.js';
import { OLYMPUS_CLOUD_PORTAL_LINK } from './olympusCloud.js';
import {
  defaultModelForFlavor,
  fetchRemoteModels,
  GATEWAY_ENDPOINTS,
  safeHost,
  type ProviderFlavor,
} from './providers.js';
import {
  findSavedProvider,
  listSavedProviders,
  upsertProvider,
  type SavedProvider,
} from './providerStore.js';
import { credentialsFile } from './secretStore.js';

/** Line prompter: one readline for the whole wizard; `askSecret` hides typed characters on a TTY. */
export class Prompter {
  private muted = false;
  private readonly rl: Interface;
  private readonly lines?: AsyncIterator<string>;
  private readonly tty = Boolean(process.stdin.isTTY);

  constructor() {
    const output = new Writable({
      write: (chunk, _enc, cb) => {
        if (!this.muted) process.stdout.write(chunk);
        cb();
      },
    });
    this.rl = createInterface({ input: process.stdin, output, terminal: this.tty });
    if (!this.tty) this.lines = this.rl[Symbol.asyncIterator]();
  }

  async ask(question: string): Promise<string> {
    if (this.lines) {
      process.stdout.write(question);
      const r = await this.lines.next();
      if (!r.done) process.stdout.write('\n');
      return r.done ? '' : String(r.value).trim();
    }
    return (await this.rl.question(question)).trim();
  }

  async askSecret(question: string): Promise<string> {
    if (this.lines) return this.ask(question);
    process.stdout.write(question);
    this.muted = true;
    try {
      return (await this.rl.question('')).trim();
    } finally {
      this.muted = false;
      process.stdout.write('\n');
    }
  }

  close() {
    this.rl.close();
  }
}

function keyStoreText(p: SavedProvider): string {
  if (p.keyStore === 'keychain') return 'macOS Keychain';
  if (p.keyStore === 'file') return `${credentialsFile()} (mode 0600)`;
  return 'no key';
}

async function suggestLocalModel(baseUrl: string): Promise<string | undefined> {
  try {
    const models = await fetchRemoteModels(baseUrl, {}, 3000);
    return models[0]?.id;
  } catch {
    return undefined;
  }
}

export async function runLoginWizard(initStorage?: () => void) {
  initStorage?.();
  const io = new Prompter();
  try {
    const saved = listSavedProviders();
    const cloudEnabled = process.env.OLYMPUS_CLOUD_ENABLED === '1';
    console.log('\n⚡ Olympus CLI (oly) — Sign in or add a provider\n');
    if (saved.length) {
      console.log(`  Saved providers (kept as they are): ${saved.map((p) => p.id).join(', ')}\n`);
    }
    const menu: Array<{ id: string; text: string }> = [
      ...(cloudEnabled
        ? [{ id: 'olympus-cloud', text: 'Olympus Cloud (Paid multi-model credits: $20/$60/$100 or $10 top-up · Zero chat logging)' }]
        : []),
      { id: 'openrouter', text: 'OpenRouter (BYO API key → 500+ models: Claude 5.5, GPT-5, Gemini, DeepSeek, Qwen, Free tier)' },
      { id: 'anthropic', text: 'Anthropic Direct (BYO Claude API key → Native Claude 5.5 + Prompt Caching + Adaptive Thinking)' },
      { id: 'ai-gateway', text: 'Vercel AI Gateway (BYO API key → 400+ models at 0% token markup)' },
      { id: 'custom-openai', text: 'Custom OpenAI-Compatible Endpoint (OpenAI, DeepSeek, Groq, Together, LiteLLM, vLLM)' },
      { id: 'ollama', text: 'Local Ollama (Zero API key, runs locally on your machine)' },
      { id: 'lmstudio', text: 'LM Studio (local server, zero API key)' },
    ];
    menu.forEach((item, idx) => console.log(`  ${idx + 1}) ${item.text}`));
    console.log('');
    const choiceNum = Number((await io.ask(`Choose provider [1-${menu.length}] (default 1): `)) || '1');
    const selectedId = menu[choiceNum - 1]?.id ?? menu[0].id;

    let flavor: ProviderFlavor;
    let baseUrl: string;
    let keyMode: 'required' | 'optional' | 'none' = 'required';
    let keyLabel = 'API key';
    if (selectedId === 'olympus-cloud') {
      flavor = 'olympus-cloud';
      const defaultCloudUrl = process.env.OLYMPUS_CLOUD_URL?.trim() || GATEWAY_ENDPOINTS.olympusCloud;
      console.log(`\n  Get your Olympus Cloud token at: ${OLYMPUS_CLOUD_PORTAL_LINK}`);
      baseUrl = (await io.ask(`Olympus Cloud URL (Enter for ${defaultCloudUrl}): `)) || defaultCloudUrl;
      keyLabel = 'Olympus Cloud token (oly_live_...)';
    } else if (selectedId === 'openrouter') {
      flavor = 'openrouter';
      baseUrl = GATEWAY_ENDPOINTS.openrouter;
      keyLabel = 'OpenRouter API key (sk-or-...)';
    } else if (selectedId === 'anthropic') {
      flavor = 'anthropic';
      baseUrl = GATEWAY_ENDPOINTS.anthropic;
      keyLabel = 'Anthropic Claude API key';
    } else if (selectedId === 'ai-gateway') {
      flavor = 'ai-gateway';
      baseUrl = GATEWAY_ENDPOINTS.aiGateway;
      keyLabel = 'Vercel AI Gateway API key';
    } else if (selectedId === 'custom-openai') {
      flavor = 'openai-compatible';
      baseUrl = (await io.ask(`Base URL (Enter for ${GATEWAY_ENDPOINTS.openai}): `)) || GATEWAY_ENDPOINTS.openai;
      keyMode = 'optional';
    } else if (selectedId === 'ollama') {
      flavor = 'ollama';
      baseUrl = (await io.ask(`Ollama base URL (Enter for ${GATEWAY_ENDPOINTS.ollama}): `)) || GATEWAY_ENDPOINTS.ollama;
      keyMode = 'none';
    } else {
      flavor = 'openai-compatible';
      baseUrl = (await io.ask(`LM Studio base URL (Enter for ${GATEWAY_ENDPOINTS.lmstudio}): `)) || GATEWAY_ENDPOINTS.lmstudio;
      keyMode = 'none';
    }
    if (!/^https?:\/\//i.test(baseUrl)) throw new Error('Base URL must start with http:// or https://');

    const existing = findSavedProvider(baseUrl);
    if (existing) {
      flavor = existing.flavor;
      console.log(`\n  Updating saved provider "${existing.id}" (${existing.label}); other providers are kept.\n`);
    }
    const hasKey = Boolean(existing && existing.keyStore !== 'none');

    let key = '';
    if (flavor === 'olympus-cloud' && Boolean(process.stdin.isTTY)) {
      const useBrowser = (await io.ask('Sign in via browser with GitHub (1-click, no copy-paste)? [Y/n]: ')).toLowerCase();
      if (useBrowser === '' || useBrowser === 'y' || useBrowser === 'yes') {
        try {
          const browserRes = await runOlympusCloudBrowserLogin(baseUrl, {
            onAuthorizeUrl: (url) => console.log(`\n  Opening GitHub sign-in in your browser...\n  If it does not open automatically, visit:\n  ${url}\n`),
          });
          key = browserRes.token;
          console.log(`  ✓ Signed in via GitHub${browserRes.email ? ` (${browserRes.email})` : ''}${browserRes.plan ? ` · Plan: ${browserRes.plan}` : ''}\n`);
        } catch (err: unknown) {
          console.log(`  Browser sign-in did not complete (${(err as Error)?.message ?? err}). Falling back to token paste.\n`);
        }
      }
    }
    if (!key && keyMode !== 'none') {
      const hint = hasKey ? ' (Enter to keep the saved key)' : keyMode === 'optional' ? ' (Enter for none)' : '';
      key = await io.askSecret(`Paste your ${keyLabel}${hint} — input is hidden: `);
      if (!key && keyMode === 'required' && !hasKey) throw new Error(`${keyLabel} is required.`);
    }

    const local = keyMode === 'none' || flavor === 'ollama';
    const suggested =
      existing?.defaultModel ||
      (local ? await suggestLocalModel(baseUrl) : undefined) ||
      (local && flavor === 'openai-compatible' ? '' : defaultModelForFlavor(flavor));
    const model = suggested
      ? (await io.ask(`Default model (Enter for ${suggested}): `)) || suggested
      : await io.ask('Default model ID (as listed by the server, e.g. qwen/qwen3-coder-30b): ');
    if (!model) throw new Error('A default model ID is required for this provider.');

    const others = listSavedProviders().filter((p) => p.id !== existing?.id);
    let makeActive = true;
    if (others.length) {
      const ans = (await io.ask('Make it the active provider? [Y/n]: ')).toLowerCase();
      makeActive = ans === '' || ans === 'y' || ans === 'yes';
    }

    const res = upsertProvider({ flavor, baseUrl, ...(key ? { key } : {}), defaultModel: model }, { makeActive });
    console.log(`\n✓ ${res.created ? 'Saved' : 'Updated'} provider "${res.provider.id}" — ${res.provider.label} (${safeHost(res.provider.baseUrl)}), model ${model}.`);
    console.log(`  Key stored in: ${keyStoreText(res.provider)}`);
    console.log(res.active ? '  This is now the active provider.' : `  Active provider unchanged. Switch any time with: oly use ${res.provider.id}`);
    console.log('');
  } finally {
    io.close();
  }
}
