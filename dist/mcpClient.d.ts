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
export declare const mcpOverAcpCaller: McpOverAcpCaller;
export declare class SessionMcpBridge {
    readonly tools: Map<string, ConnectedMcpTool>;
    private procs;
    connectAll(servers: any[], clientCtx?: AgentContext): Promise<void>;
    private connectOne;
    private registerTool;
    close(): void;
}
//# sourceMappingURL=mcpClient.d.ts.map