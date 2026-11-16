import { type AgentApp } from '@agentclientprotocol/sdk/unstable';
import { type ProviderInputs } from './providers.js';
import { type OlympusMode } from './sessionStore.js';
export interface OlympusServerOptions {
    env?: Record<string, string | undefined>;
    version?: string;
}
export declare function inputsFromEnv(env: Record<string, string | undefined>): ProviderInputs;
export declare function buildSystemInstructions(cwd: string, mode: OlympusMode, customPrompt?: string): string;
export declare function createOlympusAgentApp(opts?: OlympusServerOptions): AgentApp;
//# sourceMappingURL=acpServer.d.ts.map