/**
 * Interactive `oly login` wizard with hidden TTY secret input (`Prompter`) for BYO API keys
 * (OpenRouter, Anthropic Direct, Vercel AI Gateway, Custom OpenAI) and local servers (Ollama, LM Studio).
 * Olympus Cloud stays hidden until launched (`OLYMPUS_CLOUD_ENABLED=1`).
 */
/** Line prompter: one readline for the whole wizard; `askSecret` hides typed characters on a TTY. */
export declare class Prompter {
    private muted;
    private readonly rl;
    private readonly lines?;
    private readonly tty;
    constructor();
    ask(question: string): Promise<string>;
    askSecret(question: string): Promise<string>;
    close(): void;
}
export declare function runLoginWizard(initStorage?: () => void): Promise<void>;
//# sourceMappingURL=loginWizard.d.ts.map