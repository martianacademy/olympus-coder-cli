/**
 * Slash commands: registry, parsing and fuzzy filtering for the suggestions popup.
 * `agent: true` commands are passed through to the agent as a prompt (`/compact`, `/status`).
 */
export interface SlashCommand {
    name: string;
    description: string;
    hint?: string;
    aliases?: string[];
    /** Sent to the agent as a prompt instead of handled by the TUI. */
    agent?: boolean;
}
export declare const TUI_COMMANDS: SlashCommand[];
export interface ParsedCommand {
    name: string;
    arg: string;
}
/** `/model gpt-5` → { name: 'model', arg: 'gpt-5' }; non-commands → null. `//x` is literal text. */
export declare function parseSlash(input: string): ParsedCommand | null;
export declare function findCommand(list: SlashCommand[], name: string): SlashCommand | undefined;
/**
 * Fuzzy score: all query chars must appear in order. Higher is better; prefix and word-boundary hits rank first.
 * Returns -1 when it does not match.
 */
export declare function fuzzyScore(query: string, target: string): number;
export declare function fuzzyFilter<T>(items: T[], query: string, key: (t: T) => string, limit?: number): T[];
/** Merge the agent's advertised commands (`available_commands_update`) into the TUI list; TUI entries win. */
export declare function mergeAgentCommands(tui: SlashCommand[], agentCmds: {
    name: string;
    description?: string;
    input?: {
        hint?: string;
    };
}[]): SlashCommand[];
//# sourceMappingURL=commands.d.ts.map