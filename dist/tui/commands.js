/**
 * Slash commands: registry, parsing and fuzzy filtering for the suggestions popup.
 * `agent: true` commands are passed through to the agent as a prompt (`/compact`, `/status`).
 */
export const TUI_COMMANDS = [
    { name: 'help', description: 'Commands and keyboard shortcuts', aliases: ['?'] },
    { name: 'model', description: 'Pick the model for this session', hint: '[id]', aliases: ['models'] },
    { name: 'provider', description: 'Switch to another connected provider', aliases: ['providers'] },
    { name: 'login', description: 'Add or update a provider and API key' },
    { name: 'mode', description: 'Set the mode: code, plan or auto', hint: '[code|plan|auto]' },
    { name: 'cost', description: 'Tokens and cost for this session' },
    { name: 'clear', description: 'Clear the conversation and the screen' },
    { name: 'new', description: 'Start a new session' },
    { name: 'resume', description: 'Resume an earlier session in this folder' },
    { name: 'compact', description: 'Summarize older turns to free context', agent: true },
    { name: 'status', description: 'Provider, model, mode and usage', agent: true },
    { name: 'exit', description: 'Quit Olympus', aliases: ['quit'] },
];
/** `/model gpt-5` → { name: 'model', arg: 'gpt-5' }; non-commands → null. `//x` is literal text. */
export function parseSlash(input) {
    const t = input.trim();
    if (!t.startsWith('/') || t.startsWith('//'))
        return null;
    const m = /^\/(\S+)\s*([\s\S]*)$/.exec(t);
    if (!m)
        return null;
    return { name: m[1].toLowerCase(), arg: m[2].trim() };
}
export function findCommand(list, name) {
    const n = name.toLowerCase();
    return list.find((c) => c.name === n || c.aliases?.includes(n));
}
/**
 * Fuzzy score: all query chars must appear in order. Higher is better; prefix and word-boundary hits rank first.
 * Returns -1 when it does not match.
 */
export function fuzzyScore(query, target) {
    const q = query.toLowerCase();
    const t = target.toLowerCase();
    if (!q)
        return 1;
    if (t === q)
        return 1000;
    if (t.startsWith(q))
        return 800 - t.length;
    const sub = t.indexOf(q);
    if (sub >= 0) {
        const boundary = sub === 0 || /[\/\-_. ]/.test(t[sub - 1]);
        return (boundary ? 600 : 400) - sub - t.length / 100;
    }
    let score = 0;
    let ti = 0;
    let prev = -2;
    for (const ch of q) {
        const i = t.indexOf(ch, ti);
        if (i < 0)
            return -1;
        score += i === prev + 1 ? 6 : 1;
        if (i === 0 || /[\/\-_. ]/.test(t[i - 1]))
            score += 4;
        prev = i;
        ti = i + 1;
    }
    return score - t.length / 100;
}
export function fuzzyFilter(items, query, key, limit = 50) {
    if (!query)
        return items.slice(0, limit);
    return items
        .map((item, idx) => ({ item, idx, s: fuzzyScore(query, key(item)) }))
        .filter((x) => x.s >= 0)
        .sort((a, b) => b.s - a.s || a.idx - b.idx)
        .slice(0, limit)
        .map((x) => x.item);
}
/** Merge the agent's advertised commands (`available_commands_update`) into the TUI list; TUI entries win. */
export function mergeAgentCommands(tui, agentCmds) {
    const out = [...tui];
    for (const a of agentCmds) {
        if (!a?.name)
            continue;
        if (findCommand(out, a.name))
            continue;
        out.push({ name: a.name, description: a.description ?? '', ...(a.input?.hint ? { hint: a.input.hint } : {}), agent: true });
    }
    return out;
}
//# sourceMappingURL=commands.js.map