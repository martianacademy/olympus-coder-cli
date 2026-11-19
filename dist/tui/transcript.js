import { MarkdownStream } from './markdown.js';
import { renderNotice, renderUserMessage } from './components.js';
import { formatDuration, theme, truncateAnsi } from './text.js';
import { renderTool, spinnerFrame, toolActivity } from './toolView.js';
export class Transcript {
    opts;
    md = null;
    mdId;
    mdChars = 0;
    thinking = null;
    lastThought = '';
    lastThoughtMs = 0;
    tools = new Map();
    active = [];
    lastToolId;
    lastKind;
    /** Text of the assistant message being streamed, and of the last finished one (`/copy`). */
    currentAssistantText = '';
    lastAssistantText = '';
    /** Rough count of streamed output characters this turn (for the ↓ tokens estimate). */
    streamedChars = 0;
    /** True while replaying `session/load` history. */
    replay = false;
    /** Terminal objects by id (they outlive `terminal/release`). */
    terminals = new Map();
    /** Fired when a tool needs a redraw (status or output changed). */
    width;
    cwd;
    constructor(opts) {
        this.opts = opts;
        this.width = opts.width;
        this.cwd = opts.cwd;
    }
    setWidth(w) {
        this.width = w;
        this.md?.setWidth(Math.max(10, w - 2));
    }
    /** Print rows as one block, with a blank row between blocks (tool rows stay grouped). */
    emit(kind, rows, continuation = false) {
        if (!rows.length)
            return;
        const out = [];
        if (!continuation && this.lastKind !== undefined && !(kind === 'tool' && this.lastKind === 'tool'))
            out.push('');
        out.push(...rows);
        this.lastKind = kind;
        this.opts.print(out, kind);
    }
    /** Reset spacing (after the screen was cleared). */
    resetSpacing() {
        this.lastKind = undefined;
    }
    user(text) {
        this.flushText();
        this.endThinking();
        this.emit('user', renderUserMessage(text, this.width));
    }
    notice(text, color = theme.muted) {
        this.flushText();
        this.emit('notice', renderNotice(text, this.width, color));
    }
    header(rows) {
        this.emit('header', rows);
    }
    endThinking() {
        if (!this.thinking)
            return;
        const ms = Date.now() - this.thinking.startedAt;
        this.lastThought = this.thinking.text;
        this.lastThoughtMs = ms;
        this.thinking = null;
        const label = this.replay || ms < 1000 ? 'thought' : `thought for ${formatDuration(ms)}`;
        this.emit('thought', [truncateAnsi(`  ${theme.subtle(label)}`, this.width)]);
    }
    /** Commit the streaming message (end of message / before a tool or user row). */
    flushText() {
        if (this.currentAssistantText.trim())
            this.lastAssistantText = this.currentAssistantText.trim();
        this.currentAssistantText = '';
        if (!this.md)
            return;
        const rows = this.md.flush();
        const cont = this.mdChars > 0 && this.lastKind === 'text' && this.mdEmitted;
        if (rows.length)
            this.emit('text', rows.map((r) => '  ' + r), cont);
        this.md = null;
        this.mdId = undefined;
        this.mdChars = 0;
        this.mdEmitted = false;
    }
    mdEmitted = false;
    pushText(id, text) {
        this.endThinking();
        if (this.md && id && this.mdId && id !== this.mdId)
            this.flushText();
        if (!this.md) {
            this.md = new MarkdownStream({ width: Math.max(10, this.width - 2) });
            this.mdId = id;
            this.mdEmitted = false;
        }
        this.mdChars += text.length;
        this.currentAssistantText += text;
        this.streamedChars += text.length;
        const rows = this.md.push(text);
        if (rows.length) {
            this.emit('text', rows.map((r) => '  ' + r), this.mdEmitted);
            this.mdEmitted = true;
        }
    }
    handleUpdate(u) {
        const kind = u?.sessionUpdate;
        const msgContent = u.content && typeof u.content === 'object' && !Array.isArray(u.content) ? u.content : undefined;
        switch (kind) {
            case 'user_message_chunk': {
                const t = msgContent?.type === 'text' ? String(msgContent.text ?? '') : '';
                if (t)
                    this.user(t);
                break;
            }
            case 'agent_message_chunk': {
                if (msgContent?.type === 'text')
                    this.pushText(u.messageId, String(msgContent.text ?? ''));
                break;
            }
            case 'agent_thought_chunk': {
                const t = msgContent?.type === 'text' ? String(msgContent.text ?? '') : '';
                if (!t)
                    break;
                this.flushText();
                if (!this.thinking)
                    this.thinking = { startedAt: Date.now(), text: '' };
                this.thinking.text += t;
                this.streamedChars += t.length;
                break;
            }
            case 'tool_call': {
                this.flushText();
                this.endThinking();
                const t = {
                    id: String(u.toolCallId),
                    fn: String(u.name ?? u.title ?? ''),
                    title: String(u.title ?? ''),
                    kind: String(u.kind ?? 'other'),
                    status: u.status ?? 'pending',
                    rawInput: u.rawInput ?? {},
                    content: Array.isArray(u.content) ? u.content : [],
                    ...(Array.isArray(u.locations) ? { locations: u.locations } : {}),
                    startedAt: Date.now(),
                };
                this.tools.set(t.id, t);
                this.active.push(t.id);
                this.lastToolId = t.id;
                break;
            }
            case 'tool_call_update': {
                const t = this.tools.get(String(u.toolCallId));
                if (!t)
                    break;
                if (u.title)
                    t.title = String(u.title);
                if (u.rawInput)
                    t.rawInput = u.rawInput;
                if (Array.isArray(u.locations))
                    t.locations = u.locations;
                if (u.rawOutput !== undefined)
                    t.rawOutput = u.rawOutput;
                if (Array.isArray(u.content)) {
                    const items = u.content;
                    const term = items.find((c) => c?.type === 'terminal');
                    if (term?.terminalId) {
                        t.terminalId = String(term.terminalId);
                        const lt = this.terminals.get(t.terminalId);
                        if (lt)
                            t.terminal = lt;
                    }
                    // Keep a diff preview from the permission request when the final content is a terminal handle only.
                    if (!term || items.some((c) => c?.type !== 'terminal'))
                        t.content = items;
                }
                if (u.status)
                    t.status = u.status;
                if (t.status === 'completed' || t.status === 'failed')
                    this.finishTool(t);
                break;
            }
            case 'plan':
                // todo_write already renders its checklist on the tool row.
                break;
            default:
                break;
        }
    }
    /** A terminal produced output: attach it to its tool. */
    terminalChanged(term) {
        this.terminals.set(term.id, term);
        for (const id of this.active) {
            const t = this.tools.get(id);
            if (t && t.terminalId === term.id)
                t.terminal = term;
        }
    }
    finishTool(t) {
        t.endedAt ??= Date.now();
        const i = this.active.indexOf(t.id);
        if (i >= 0)
            this.active.splice(i, 1);
        this.emit('tool', renderTool(t, { width: this.width, cwd: this.cwd, replay: this.replay }));
    }
    /** Attach a permission request's preview (diff / command) to the tool row. */
    attachPermissionPreview(toolCallId, toolCall) {
        const t = this.tools.get(toolCallId);
        if (!t)
            return;
        if (Array.isArray(toolCall?.content) && toolCall.content.length)
            t.content = toolCall.content;
        if (toolCall?.rawInput && typeof toolCall.rawInput === 'object')
            t.rawInput = { ...t.rawInput, ...toolCall.rawInput };
        if (Array.isArray(toolCall?.locations))
            t.locations = toolCall.locations;
    }
    markDenied(toolCallId) {
        const t = this.tools.get(toolCallId);
        if (t)
            t.denied = true;
    }
    get activeTools() {
        return this.active.map((id) => this.tools.get(id)).filter(Boolean);
    }
    get isStreamingText() {
        return Boolean(this.md);
    }
    /** End of turn: commit everything still open; running tools are marked interrupted when `cancelled`. */
    endTurn(cancelled = false) {
        this.flushText();
        this.endThinking();
        for (const t of this.activeTools) {
            if (cancelled)
                t.cancelled = true;
            this.finishTool(t);
        }
        this.active = [];
    }
    /** Spinner label for the current activity. */
    activity() {
        const tool = this.activeTools[this.activeTools.length - 1];
        if (tool)
            return toolActivity(tool, this.cwd);
        if (this.thinking)
            return 'Thinking';
        if (this.md)
            return 'Writing';
        return 'Working';
    }
    /** Live rows: the streaming tail, the thinking line and running tool rows. */
    liveRows(now = Date.now()) {
        const rows = [];
        const w = this.width;
        if (this.md) {
            const pending = this.md.pending();
            if (pending.length) {
                if (this.lastKind !== undefined && !this.mdEmitted)
                    rows.push('');
                rows.push(...pending.map((r) => '  ' + r));
            }
        }
        if (this.thinking) {
            const glyphs = ['◐', '◓', '◑', '◒'];
            const g = glyphs[Math.floor(now / 160) % glyphs.length];
            const secs = formatDuration(now - this.thinking.startedAt);
            const snippet = this.thinking.text.replace(/\s+/g, ' ').trim().slice(-200);
            const head = `  ${theme.muted(`${g} thinking · ${secs}`)}`;
            rows.push('');
            rows.push(truncateAnsi(snippet ? `${head}  ${theme.subtle(snippet)}` : head, w));
        }
        const tools = this.activeTools;
        if (tools.length) {
            if (this.lastKind !== 'tool' || rows.length)
                rows.push('');
            for (const t of tools)
                rows.push(...renderTool(t, { width: w, cwd: this.cwd, now }));
        }
        return rows;
    }
    /** Last full thinking text (Ctrl+O). */
    expandThinking() {
        const t = this.thinking?.text || this.lastThought;
        if (!t.trim())
            return [];
        const label = this.lastThoughtMs >= 1000 ? `thought for ${formatDuration(this.lastThoughtMs)}` : 'thinking';
        const rows = [`  ${theme.subtle(label)}`];
        for (const line of t.trim().split('\n')) {
            rows.push(...renderNotice(line || ' ', this.width, (s) => theme.subtle(s)).map((r) => r));
        }
        return rows;
    }
    /** Last tool's full output (Ctrl+O). */
    expandLastTool() {
        const t = this.lastToolId ? this.tools.get(this.lastToolId) : undefined;
        if (!t)
            return [];
        return renderTool(t, { width: this.width, cwd: this.cwd, expanded: true });
    }
    spinner(now = Date.now()) {
        return spinnerFrame(now);
    }
}
//# sourceMappingURL=transcript.js.map