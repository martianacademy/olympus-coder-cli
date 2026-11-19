import { client, methods, PROTOCOL_VERSION, } from '@agentclientprotocol/sdk/unstable';
import { createOlympusAgentApp, inputsFromEnv } from '../acpServer.js';
import { resolveConnectedProviders } from '../providers.js';
import { TerminalHost } from './terminalHost.js';
export class Engine {
    handlers;
    terminals = new TerminalHost();
    conn;
    sessionId;
    configOptions = [];
    cwd;
    constructor(env, version, cwd, handlers) {
        this.handlers = handlers;
        this.cwd = cwd;
        const agentApp = createOlympusAgentApp({ env, version });
        this.terminals.onChange = (t) => handlers.onTerminalChange?.(t);
        const app = client({ name: 'oly-tui' })
            .onNotification(methods.client.session.update, ({ params }) => {
            const p = params;
            handlers.onUpdate(p.update, String(p.sessionId ?? ''));
        })
            .onNotification(methods.client.auth.statusUpdate, () => { })
            .onRequest(methods.client.session.requestPermission, async ({ params, signal }) => {
            const p = params;
            const answer = await handlers.onPermission({ sessionId: String(p.sessionId ?? ''), toolCall: p.toolCall ?? {}, options: Array.isArray(p.options) ? p.options : [] }, signal);
            return { outcome: answer };
        })
            .onRequest(methods.client.terminal.create, async ({ params }) => {
            const p = params;
            return this.terminals.create(p, this.cwd);
        })
            .onRequest(methods.client.terminal.output, async ({ params }) => {
            const p = params;
            return this.terminals.output(String(p.terminalId));
        })
            .onRequest(methods.client.terminal.waitForExit, async ({ params, signal }) => {
            const p = params;
            return await this.terminals.waitForExit(String(p.terminalId), signal);
        })
            .onRequest(methods.client.terminal.kill, async ({ params }) => {
            const p = params;
            this.terminals.kill(String(p.terminalId));
            return {};
        })
            .onRequest(methods.client.terminal.release, async ({ params }) => {
            const p = params;
            this.terminals.release(String(p.terminalId));
            return {};
        });
        this.conn = app.connect(agentApp);
    }
    async initialize() {
        return this.conn.agent.request(methods.agent.initialize, {
            protocolVersion: PROTOCOL_VERSION,
            clientCapabilities: { terminal: true },
            clientInfo: { name: 'oly-tui', version: '0.2.0' },
        });
    }
    async authStatus() {
        const res = (await this.conn.agent.request(methods.agent.auth.status, {}));
        return { state: String(res?.state ?? 'unauthenticated'), accounts: Array.isArray(res?.accounts) ? res.accounts : [] };
    }
    async newSession(configOptions) {
        const res = (await this.conn.agent.request(methods.agent.session.new, {
            cwd: this.cwd,
            mcpServers: [],
            ...(configOptions?.length ? { configOptions } : {}),
        }));
        this.sessionId = String(res.sessionId);
        this.configOptions = Array.isArray(res.configOptions) ? res.configOptions : [];
        return this.sessionId;
    }
    async loadSession(sessionId) {
        const res = (await this.conn.agent.request(methods.agent.session.load, {
            sessionId,
            cwd: this.cwd,
            mcpServers: [],
        }));
        this.sessionId = sessionId;
        this.configOptions = Array.isArray(res?.configOptions) ? res.configOptions : [];
    }
    async closeSession() {
        if (!this.sessionId)
            return;
        const id = this.sessionId;
        await this.conn.agent.request(methods.agent.session.close, { sessionId: id }).catch(() => { });
    }
    async listSessions() {
        const res = (await this.conn.agent.request(methods.agent.session.list, { cwd: this.cwd }));
        return Array.isArray(res?.sessions) ? res.sessions : [];
    }
    async refreshOptions() {
        const res = (await this.conn.agent.request(methods.agent.session.options, this.sessionId ? { sessionId: this.sessionId } : { cwd: this.cwd }));
        if (Array.isArray(res?.configOptions))
            this.configOptions = res.configOptions;
    }
    async prompt(blocks) {
        if (!this.sessionId)
            throw new Error('No session');
        return (await this.conn.agent.request(methods.agent.session.prompt, {
            sessionId: this.sessionId,
            prompt: blocks,
        }));
    }
    async cancel() {
        if (!this.sessionId)
            return;
        await this.conn.agent.notify(methods.agent.session.cancel, { sessionId: this.sessionId });
    }
    /** Mid-turn steering. `injected` = queued for the next step; `promptRequired` = no turn is running. */
    async steer(blocks) {
        if (!this.sessionId)
            return 'failed';
        const res = (await this.conn.agent.request('_session/steering', {
            sessionId: this.sessionId,
            prompt: blocks,
        }));
        return res?.outcome ?? 'failed';
    }
    async setConfig(configId, value) {
        if (!this.sessionId)
            return;
        const res = (await this.conn.agent.request(methods.agent.session.setConfigOption, {
            sessionId: this.sessionId,
            configId,
            value,
        }));
        if (Array.isArray(res?.configOptions))
            this.configOptions = res.configOptions;
    }
    option(id) {
        return this.configOptions.find((o) => o.id === id);
    }
    /** Flattened model choices with their group names. */
    modelChoices() {
        const opt = this.option('model');
        if (!opt)
            return [];
        const out = [];
        for (const o of opt.options) {
            if ('group' in o && Array.isArray(o.options))
                for (const x of o.options)
                    out.push({ ...x, group: o.name });
            else
                out.push(o);
        }
        return out;
    }
    close() {
        this.terminals.killAll();
        this.conn.close();
    }
}
/** Build initial ACP `session/new` config options from CLI `--provider`, `--model`, and `-y` flags. */
export function buildInitialSessionConfig(opts) {
    const cfg = [];
    if (opts.autoApprove)
        cfg.push({ configId: 'mode', value: 'auto' });
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
    }
    else if (m) {
        cfg.push({ configId: 'model', value: m });
    }
    return cfg;
}
//# sourceMappingURL=engine.js.map