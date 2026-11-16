import { spawn, type ChildProcess } from 'node:child_process';
import { McpOverAcpCaller, type AgentContext } from '@agentclientprotocol/sdk/unstable';
import type { ChatToolSpec } from './providers.js';

/**
 * MCP client bridge for Olympus CLI: connects to ACP-multiplexed MCP servers (`type: 'acp'`, such as Olympus
 * Coder's own `olympus` orchestrator tools), HTTP Streamable MCP servers (`type: 'http'`), and stdio MCP
 * servers (`command` + `args`), exposing their tools seamlessly to any OpenAI-compatible model.
 */

export interface ConnectedMcpTool {
  qualifiedName: string;
  serverName: string;
  toolName: string;
  spec: ChatToolSpec;
  call: (args: Record<string, unknown>) => Promise<string>;
}

export const mcpOverAcpCaller = new McpOverAcpCaller({
  clientInfo: { name: 'olympus-cli', version: '0.1.0' },
});

export class SessionMcpBridge {
  readonly tools = new Map<string, ConnectedMcpTool>();
  private procs: ChildProcess[] = [];

  async connectAll(servers: any[], clientCtx?: AgentContext): Promise<void> {
    if (!Array.isArray(servers) || !servers.length) return;
    await Promise.all(servers.map((s) => this.connectOne(s, clientCtx).catch(() => {})));
  }

  private async connectOne(server: any, clientCtx?: AgentContext): Promise<void> {
    const serverName = String(server?.name ?? 'mcp').trim();
    if (!serverName) return;

    if (server?.type === 'acp' && typeof server.serverId === 'string' && clientCtx) {
      const listRes: any = await mcpOverAcpCaller.request(clientCtx, server.serverId, 'tools/list', {});
      const list = Array.isArray(listRes?.result?.tools) ? listRes.result.tools : [];
      for (const t of list) {
        this.registerTool(serverName, t, async (args) => {
          const r: any = await mcpOverAcpCaller.request(clientCtx, server.serverId, 'tools/call', { name: t.name, arguments: args });
          if (r?.error) throw new Error(String(r.error.message ?? JSON.stringify(r.error)));
          return formatMcpResult(r?.result);
        });
      }
      return;
    }

    if (server?.type === 'http' && typeof server.url === 'string') {
      const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
      if (Array.isArray(server.headers)) {
        for (const h of server.headers) {
          if (h?.name && typeof h.value === 'string') headers[String(h.name)] = h.value;
        }
      }
      let rpcId = 1;
      const rpc = async (method: string, params: unknown) => {
        const res = await fetch(server.url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ jsonrpc: '2.0', id: rpcId++, method, params }),
          signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) throw new Error(`MCP HTTP ${res.status}`);
        const text = await res.text();
        const dataLine = text
          .split('\n')
          .map((l) => l.trim())
          .find((l) => l.startsWith('data:'));
        const json = JSON.parse(dataLine ? dataLine.slice(5).trim() : text);
        if (json?.error) throw new Error(String(json.error.message ?? JSON.stringify(json.error)));
        return json?.result;
      };
      await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'olympus-cli', version: '0.1.0' } }).catch(() => {});
      const listRes: any = await rpc('tools/list', {});
      for (const t of Array.isArray(listRes?.tools) ? listRes.tools : []) {
        this.registerTool(serverName, t, async (args) => formatMcpResult(await rpc('tools/call', { name: t.name, arguments: args })));
      }
      return;
    }

    if (typeof server?.command === 'string' && server.command) {
      const env: Record<string, string> = { ...(process.env as Record<string, string>) };
      if (Array.isArray(server.env)) {
        for (const e of server.env) if (e?.name && typeof e.value === 'string') env[String(e.name)] = e.value;
      }
      const proc = spawn(server.command, Array.isArray(server.args) ? server.args.map(String) : [], {
        env,
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      this.procs.push(proc);
      const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
      let nextId = 1;
      let buf = '';
      proc.stdout?.on('data', (chunk: Buffer) => {
        buf += chunk.toString('utf8');
        let idx: number;
        while ((idx = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if (!line) continue;
          try {
            const msg = JSON.parse(line);
            const p = typeof msg?.id === 'number' ? pending.get(msg.id) : undefined;
            if (p) {
              pending.delete(msg.id);
              if (msg.error) p.reject(new Error(String(msg.error.message ?? JSON.stringify(msg.error))));
              else p.resolve(msg.result);
            }
          } catch {
            /* skip non-json log line */
          }
        }
      });
      proc.once('exit', () => {
        for (const [, p] of pending) p.reject(new Error(`MCP server ${serverName} exited.`));
        pending.clear();
      });

      const rpc = (method: string, params: unknown, timeoutMs = 20_000) =>
        new Promise<any>((resolve, reject) => {
          const id = nextId++;
          const timer = setTimeout(() => {
            pending.delete(id);
            reject(new Error(`MCP ${serverName}.${method} timed out`));
          }, timeoutMs);
          pending.set(id, {
            resolve: (v) => {
              clearTimeout(timer);
              resolve(v);
            },
            reject: (e) => {
              clearTimeout(timer);
              reject(e);
            },
          });
          proc.stdin?.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
        });

      await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'olympus-cli', version: '0.1.0' } });
      proc.stdin?.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} })}\n`);
      const listRes = await rpc('tools/list', {});
      for (const t of Array.isArray(listRes?.tools) ? listRes.tools : []) {
        this.registerTool(serverName, t, async (args) => formatMcpResult(await rpc('tools/call', { name: t.name, arguments: args }, 120_000)));
      }
    }
  }

  private registerTool(serverName: string, tool: any, call: (args: Record<string, unknown>) => Promise<string>) {
    const rawName = String(tool?.name ?? '').trim();
    if (!rawName) return;
    const safeServer = serverName.replace(/[^A-Za-z0-9_-]/g, '_');
    const safeTool = rawName.replace(/[^A-Za-z0-9_-]/g, '_');
    // Match Claude Code's `mcp__<server>__<tool>` convention so Olympus Coder's `olympusToolName()` & `isOlympusTool()` recognize it automatically!
    const qualifiedName = `mcp__${safeServer}__${safeTool}`.slice(0, 64);
    const schema = tool?.inputSchema && typeof tool.inputSchema === 'object' ? tool.inputSchema : { type: 'object', properties: {} };
    this.tools.set(qualifiedName, {
      qualifiedName,
      serverName,
      toolName: rawName,
      spec: {
        type: 'function',
        function: {
          name: qualifiedName,
          description: `[MCP ${serverName}] ${String(tool?.description ?? rawName)}`.slice(0, 1024),
          parameters: schema,
        },
      },
      call,
    });
  }

  close() {
    for (const p of this.procs) {
      try {
        p.kill();
      } catch {
        /* ignore */
      }
    }
    this.procs = [];
    this.tools.clear();
  }
}

function formatMcpResult(result: any): string {
  if (!result) return '(ok)';
  if (Array.isArray(result.content)) {
    const parts = result.content
      .map((c: any) => (c?.type === 'text' ? String(c.text ?? '') : JSON.stringify(c)))
      .filter(Boolean);
    if (parts.length) return parts.join('\n');
  }
  return typeof result === 'string' ? result : JSON.stringify(result, null, 2);
}
