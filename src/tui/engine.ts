import {
  client,
  methods,
  PROTOCOL_VERSION,
  type ClientConnection,
  type ContentBlock,
  type RequestPermissionOutcome,
} from '@agentclientprotocol/sdk/unstable';
import { createOlympusAgentApp, inputsFromEnv } from '../acpServer.js';
import { resolveConnectedProviders } from '../providers.js';
import type { PromptBlock } from './files.js';
import { TerminalHost, type CreateTerminalParams } from './terminalHost.js';
import type { PermissionToolPreview, SessionUpdatePayload } from './transcript.js';

/**
 * The TUI's engine: an in-process ACP client of the same Olympus agent the desktop app talks to. Sessions on disk,
 * resume, the multi-provider model picker, steering, usage and `/compact` all come from the agent, unchanged.
 * The client implements `terminal/*` locally (live command output) and forwards permission requests to the UI.
 */

export interface PermissionOptionView {
  optionId: string;
  name: string;
  kind: string;
}

export interface PermissionRequestView {
  sessionId: string;
  toolCall: PermissionToolPreview;
  options: PermissionOptionView[];
}

export type PermissionAnswer = { outcome: 'selected'; optionId: string } | { outcome: 'cancelled' };

export interface EngineHandlers {
  onUpdate: (update: SessionUpdatePayload, sessionId: string) => void;
  onPermission: (req: PermissionRequestView, signal: AbortSignal) => Promise<PermissionAnswer>;
  onTerminalChange?: TerminalHost['onChange'];
}

export interface ConfigSelectOption {
  value: string;
  name: string;
  description?: string;
}

export interface ConfigOption {
  id: string;
  name: string;
  type: string;
  currentValue: string;
  options: (ConfigSelectOption | { group: string; name: string; options: ConfigSelectOption[] })[];
}

export interface PromptResult {
  stopReason: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    thoughtTokens?: number;
    cachedReadTokens?: number;
    cachedWriteTokens?: number;
    cachedWrite1hTokens?: number;
    totalTokens?: number;
  };
}

export interface SessionSummary {
  sessionId: string;
  cwd: string;
  title: string;
  updatedAt: string;
}

export interface AuthAccountSummary {
  id?: string;
  label?: string;
  [k: string]: unknown;
}

interface SessionConfigReply {
  sessionId?: string;
  configOptions?: ConfigOption[];
}

export class Engine {
  readonly terminals = new TerminalHost();
  private conn: ClientConnection;
  sessionId: string | undefined;
  configOptions: ConfigOption[] = [];
  cwd: string;

  constructor(
    env: Record<string, string | undefined>,
    version: string,
    cwd: string,
    private readonly handlers: EngineHandlers,
  ) {
    this.cwd = cwd;
    const agentApp = createOlympusAgentApp({ env, version });
    this.terminals.onChange = (t) => handlers.onTerminalChange?.(t);
    const app = client({ name: 'oly-tui' })
      .onNotification(methods.client.session.update, ({ params }) => {
        const p = params as unknown as { sessionId?: string; update: SessionUpdatePayload };
        handlers.onUpdate(p.update, String(p.sessionId ?? ''));
      })
      .onNotification(methods.client.auth.statusUpdate, () => {})
      .onRequest(methods.client.session.requestPermission, async ({ params, signal }) => {
        const p = params as unknown as {
          sessionId?: string;
          toolCall?: PermissionToolPreview;
          options?: PermissionOptionView[];
        };
        const answer = await handlers.onPermission(
          { sessionId: String(p.sessionId ?? ''), toolCall: p.toolCall ?? {}, options: Array.isArray(p.options) ? p.options : [] },
          signal,
        );
        return { outcome: answer as RequestPermissionOutcome };
      })
      .onRequest(methods.client.terminal.create, async ({ params }) => {
        const p = params as unknown as CreateTerminalParams;
        return this.terminals.create(p, this.cwd);
      })
      .onRequest(methods.client.terminal.output, async ({ params }) => {
        const p = params as unknown as { terminalId: string };
        return this.terminals.output(String(p.terminalId));
      })
      .onRequest(methods.client.terminal.waitForExit, async ({ params, signal }) => {
        const p = params as unknown as { terminalId: string };
        return await this.terminals.waitForExit(String(p.terminalId), signal);
      })
      .onRequest(methods.client.terminal.kill, async ({ params }) => {
        const p = params as unknown as { terminalId: string };
        this.terminals.kill(String(p.terminalId));
        return {};
      })
      .onRequest(methods.client.terminal.release, async ({ params }) => {
        const p = params as unknown as { terminalId: string };
        this.terminals.release(String(p.terminalId));
        return {};
      });
    this.conn = app.connect(agentApp);
  }

  async initialize(): Promise<unknown> {
    return this.conn.agent.request(methods.agent.initialize, {
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: { terminal: true },
      clientInfo: { name: 'oly-tui', version: '0.1.0' },
    });
  }

  async authStatus(): Promise<{ state: string; accounts: AuthAccountSummary[] }> {
    const res = (await this.conn.agent.request(methods.agent.auth.status, {})) as unknown as {
      state?: string;
      accounts?: AuthAccountSummary[];
    };
    return { state: String(res?.state ?? 'unauthenticated'), accounts: Array.isArray(res?.accounts) ? res.accounts : [] };
  }

  async newSession(configOptions?: { configId: string; value: string }[]): Promise<string> {
    const res = (await this.conn.agent.request(methods.agent.session.new, {
      cwd: this.cwd,
      mcpServers: [],
      ...(configOptions?.length ? { configOptions } : {}),
    })) as unknown as SessionConfigReply;
    this.sessionId = String(res.sessionId);
    this.configOptions = Array.isArray(res.configOptions) ? res.configOptions : [];
    return this.sessionId;
  }

  async loadSession(sessionId: string): Promise<void> {
    const res = (await this.conn.agent.request(methods.agent.session.load, {
      sessionId,
      cwd: this.cwd,
      mcpServers: [],
    })) as unknown as SessionConfigReply;
    this.sessionId = sessionId;
    this.configOptions = Array.isArray(res?.configOptions) ? res.configOptions : [];
  }

  async closeSession(): Promise<void> {
    if (!this.sessionId) return;
    const id = this.sessionId;
    await this.conn.agent.request(methods.agent.session.close, { sessionId: id }).catch(() => {});
  }

  async listSessions(): Promise<SessionSummary[]> {
    const res = (await this.conn.agent.request(methods.agent.session.list, { cwd: this.cwd })) as unknown as {
      sessions?: SessionSummary[];
    };
    return Array.isArray(res?.sessions) ? res.sessions : [];
  }

  async refreshOptions(): Promise<void> {
    const res = (await this.conn.agent.request(
      methods.agent.session.options,
      this.sessionId ? { sessionId: this.sessionId } : { cwd: this.cwd },
    )) as unknown as SessionConfigReply;
    if (Array.isArray(res?.configOptions)) this.configOptions = res.configOptions;
  }

  async prompt(blocks: PromptBlock[]): Promise<PromptResult> {
    if (!this.sessionId) throw new Error('No session');
    return (await this.conn.agent.request(methods.agent.session.prompt, {
      sessionId: this.sessionId,
      prompt: blocks as unknown as ContentBlock[],
    })) as unknown as PromptResult;
  }

  async cancel(): Promise<void> {
    if (!this.sessionId) return;
    await this.conn.agent.notify(methods.agent.session.cancel, { sessionId: this.sessionId });
  }

  /** Mid-turn steering. `injected` = queued for the next step; `promptRequired` = no turn is running. */
  async steer(blocks: PromptBlock[]): Promise<'injected' | 'promptRequired' | 'failed'> {
    if (!this.sessionId) return 'failed';
    const res = (await this.conn.agent.request('_session/steering', {
      sessionId: this.sessionId,
      prompt: blocks,
    })) as unknown as { outcome?: 'injected' | 'promptRequired' | 'failed' };
    return res?.outcome ?? 'failed';
  }

  async setConfig(configId: string, value: string): Promise<void> {
    if (!this.sessionId) return;
    const res = (await this.conn.agent.request(methods.agent.session.setConfigOption, {
      sessionId: this.sessionId,
      configId,
      value,
    })) as unknown as SessionConfigReply;
    if (Array.isArray(res?.configOptions)) this.configOptions = res.configOptions;
  }

  option(id: string): ConfigOption | undefined {
    return this.configOptions.find((o) => o.id === id);
  }

  /** Flattened model choices with their group names. */
  modelChoices(): { value: string; name: string; group?: string; description?: string }[] {
    const opt = this.option('model');
    if (!opt) return [];
    const out: { value: string; name: string; group?: string; description?: string }[] = [];
    for (const o of opt.options) {
      if ('group' in o && Array.isArray(o.options)) for (const x of o.options) out.push({ ...x, group: o.name });
      else out.push(o as ConfigSelectOption);
    }
    return out;
  }

  close(): void {
    this.terminals.killAll();
    this.conn.close();
  }
}

/** Build initial ACP `session/new` config options from CLI `--provider`, `--model`, and `-y` flags. */
export function buildInitialSessionConfig(opts: {
  env: Record<string, string | undefined>;
  providerId?: string;
  model?: string;
  autoApprove?: boolean;
}): { configId: string; value: string }[] {
  const cfg: { configId: string; value: string }[] = [];
  if (opts.autoApprove) cfg.push({ configId: 'mode', value: 'auto' });
  const m = opts.model?.trim();
  const p = opts.providerId?.trim();
  if (p) {
    const conn = resolveConnectedProviders(inputsFromEnv(opts.env), null, false);
    const prov = conn.providers.find((x) => x.id === p);
    if (!prov) {
      throw new Error(`Provider "${p}" is not connected (connected: ${conn.providers.map((x) => x.id).join(', ') || 'none'}).`);
    }
    const model = m ? (m.includes('::') ? m.split('::').slice(1).join('::') : m) : prov.endpoint.defaultModel;
    cfg.push({ configId: 'model', value: `${p}::${model}` });
  } else if (m) {
    cfg.push({ configId: 'model', value: m });
  }
  return cfg;
}
