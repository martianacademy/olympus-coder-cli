import { fuzzyFilter } from './commands.js';
import { renderDiff } from './diff.js';
import { mentionText } from './files.js';
import { languageFor, sanitizeLine } from './highlight.js';
import { isCtrl } from './keys.js';
import { PermissionRules } from './permissions.js';
import { formatCost, formatTokens, strWidth, style, theme, truncateAnsi, wrapAnsi } from './text.js';
import { relPath } from './toolView.js';
export function permissionSubject(tc) {
    const kind = tc?.kind === 'edit' || tc?.kind === 'execute' || tc?.kind === 'fetch' ? tc.kind : 'other';
    const raw = tc?.rawInput ?? {};
    return {
        kind,
        ...(typeof raw.command === 'string' ? { command: raw.command } : {}),
        ...(typeof raw.url === 'string' ? { url: raw.url } : {}),
    };
}
export function pickPermissionOption(req, kind) {
    const o = req.options.find((x) => x.kind === kind) ?? req.options.find((x) => x.optionId === kind);
    return o ? { outcome: 'selected', optionId: o.optionId } : kind === 'reject_once' ? { outcome: 'cancelled' } : { outcome: 'selected', optionId: kind };
}
export function buildPermissionView(tc, cwd, width, screenHeight) {
    const subject = permissionSubject(tc);
    const inner = Math.max(10, width - 4);
    const maxPreview = Math.max(4, screenHeight - 14);
    if (subject.kind === 'edit') {
        const diff = (tc.content ?? []).find((c) => c?.type === 'diff');
        const path = relPath(cwd, String(diff?.path ?? tc.locations?.[0]?.path ?? ''));
        const verb = /^(Create|Overwrite)\b/.exec(String(tc.title ?? ''))?.[1] ?? 'Edit';
        const preview = diff
            ? renderDiff(String(diff.oldText ?? ''), String(diff.newText ?? ''), {
                width: inner,
                maxLines: maxPreview,
                startLine: tc.locations?.[0]?.line ?? 1,
                lang: languageFor(path),
            })
            : [];
        return { title: `${verb} ${sanitizeLine(path, 2)}?`, preview, subject };
    }
    if (subject.kind === 'execute') {
        const rawCmd = subject.command ?? String(tc.title ?? '').replace(/^Run:\s*/, '');
        const cmd = rawCmd
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '↵')
            .split('\n')
            .map((l) => sanitizeLine(l, 2))
            .join('\n');
        const rows = wrapAnsi(cmd, inner, { firstIndent: theme.accent('$ '), indent: '  ' }).slice(0, maxPreview);
        const cmdCwd = tc.rawInput?.cwd;
        if (typeof cmdCwd === 'string' && cmdCwd && cmdCwd !== cwd)
            rows.push(theme.muted(`in ${sanitizeLine(relPath(cwd, cmdCwd), 2)}`));
        return { title: 'Run command?', preview: rows, subject };
    }
    if (subject.kind === 'fetch') {
        const urlText = sanitizeLine(subject.url ?? String(tc.title ?? ''), 2);
        return { title: 'Fetch URL?', preview: wrapAnsi(urlText, inner), subject };
    }
    return { title: `${sanitizeLine(String(tc.title ?? 'Allow tool'), 2)}?`, preview: [], subject };
}
export function createPermissionOverlay(req, cwd, width, screenHeight, rules, hooks, signal) {
    const tc = (req.toolCall ?? {});
    const id = String(tc.toolCallId ?? '');
    const view = buildPermissionView(tc, cwd, width, screenHeight);
    const overlay = {
        type: 'permission',
        title: view.title,
        preview: view.preview,
        options: ['Yes', PermissionRules.alwaysLabel(view.subject), 'No, tell Olympus what to do instead'],
        selected: 0,
        subject: view.subject,
        resolve: (choice) => {
            hooks.onClose(overlay);
            signal.removeEventListener('abort', onAbort);
            if (choice === 0) {
                hooks.onAnswer(pickPermissionOption(req, 'allow_once'));
            }
            else if (choice === 1) {
                rules.remember(view.subject);
                hooks.onAnswer(pickPermissionOption(req, 'allow_always'));
            }
            else {
                hooks.onDenied(id, choice === 2);
                hooks.onAnswer(choice === -1 ? { outcome: 'cancelled' } : pickPermissionOption(req, 'reject_once'));
            }
        },
    };
    const onAbort = () => overlay.resolve(-1);
    signal.addEventListener('abort', onAbort, { once: true });
    return overlay;
}
export function requestPermissionThroughOverlay(req, signal, cwd, width, screenHeight, rules, hooks) {
    const tc = (req.toolCall ?? {});
    const subject = permissionSubject(tc);
    const id = String(tc.toolCallId ?? '');
    hooks.attachPreview(id, tc);
    if (rules.allows(subject))
        return Promise.resolve(pickPermissionOption(req, 'allow_once'));
    return new Promise((resolve) => {
        const ov = createPermissionOverlay(req, cwd, width, screenHeight, rules, {
            onClose: (o) => hooks.clearOverlay(o),
            onDenied: hooks.onDenied,
            onAnswer: (ans) => {
                resolve(ans);
                hooks.requestRedraw();
            },
        }, signal);
        hooks.setOverlay(ov);
        hooks.requestRedraw();
    });
}
export function handlePermissionKey(k, o, onInterrupt) {
    if (isCtrl(k, 'c')) {
        o.resolve(2);
        onInterrupt();
        return;
    }
    if (k.name === 'up')
        o.selected = (o.selected + 2) % 3;
    else if (k.name === 'down' || k.name === 'tab')
        o.selected = (o.selected + 1) % 3;
    else if (k.name === 'enter')
        o.resolve(o.selected);
    else if (k.name === 'escape')
        o.resolve(2);
    else if (k.name === 'text' && !k.ctrl && !k.alt && /^[123]$/.test(k.text ?? ''))
        o.resolve((Number(k.text) - 1));
    else if (k.name === 'text' && !k.ctrl && (k.text === 'y' || k.text === 'Y'))
        o.resolve(0);
    else if (k.name === 'text' && !k.ctrl && (k.text === 'n' || k.text === 'N'))
        o.resolve(2);
}
export function filteredPickerItems(p) {
    return fuzzyFilter(p.items, p.filter, (x) => x.search, 500);
}
export function handlePickerKey(k, p, onClose, onError, onDone) {
    const items = filteredPickerItems(p);
    if (k.name === 'escape' || isCtrl(k, 'c')) {
        onClose();
    }
    else if (k.name === 'up' || k.name === 'wheelup') {
        p.selected = Math.max(0, p.selected - 1);
    }
    else if (k.name === 'down' || k.name === 'tab' || k.name === 'wheeldown') {
        p.selected = Math.min(Math.max(0, items.length - 1), p.selected + 1);
    }
    else if (k.name === 'pageup') {
        p.selected = Math.max(0, p.selected - 8);
    }
    else if (k.name === 'pagedown') {
        p.selected = Math.min(Math.max(0, items.length - 1), p.selected + 8);
    }
    else if (k.name === 'enter') {
        const it = items[p.selected];
        onClose();
        if (it) {
            void Promise.resolve(p.onPick(it.value))
                .catch((e) => onError(String(e?.message ?? e)))
                .finally(onDone);
        }
    }
    else if (k.name === 'backspace') {
        p.filter = Array.from(p.filter).slice(0, -1).join('');
        p.selected = 0;
    }
    else if ((k.name === 'text' && !k.ctrl && !k.alt && k.text) || k.name === 'paste') {
        p.filter += (k.text ?? '').replace(/\s+/g, ' ');
        p.selected = 0;
    }
}
export function computeSuggestions(editor, commands, getFiles, prev) {
    const tok = editor.currentToken();
    if (!tok)
        return null;
    const prevSel = prev?.kind === tok.kind ? prev.selected : 0;
    if (tok.kind === '/') {
        const list = fuzzyFilter(commands, tok.query, (c) => c.name, 20);
        const items = list.map((c) => ({
            label: `/${c.name}${c.hint ? ` ${c.hint}` : ''}`,
            detail: c.description,
            insert: `/${c.name}`,
            submit: !c.hint,
        }));
        return items.length ? { kind: '/', start: 0, items, selected: Math.min(prevSel, items.length - 1) } : null;
    }
    const files = fuzzyFilter(getFiles(), tok.query, (f) => f, 30);
    const items = files.map((f) => ({ label: f, insert: `@${mentionText(f)} ` }));
    return items.length ? { kind: '@', start: tok.start, items, selected: Math.min(prevSel, items.length - 1) } : null;
}
export function applyAcceptedSuggestion(s, editor, viaEnter) {
    const it = s.items[s.selected];
    if (!it)
        return { shouldSubmit: false, dismissedText: null };
    if (s.kind === '/') {
        const typed = editor.text.trim();
        editor.setText(it.insert + (it.submit ? '' : ' '));
        if (viaEnter && (it.submit || typed === it.insert)) {
            editor.setText(it.insert);
            return { shouldSubmit: true, dismissedText: null };
        }
        return { shouldSubmit: false, dismissedText: editor.text };
    }
    editor.replaceToken(s.start, it.insert);
    return { shouldSubmit: false, dismissedText: editor.text };
}
export function renderHelpRows(commands, width) {
    const rows = [`  ${style.bold('Commands')}`];
    const nameW = Math.min(22, Math.max(...commands.map((c) => strWidth(`/${c.name}${c.hint ? ` ${c.hint}` : ''}`))) + 2);
    for (const c of commands) {
        const n = `/${c.name}${c.hint ? ` ${c.hint}` : ''}`;
        rows.push(truncateAnsi(`  ${theme.accent(n.padEnd(nameW))}${theme.muted(c.description)}`, width));
    }
    rows.push('', `  ${style.bold('Keys')}`);
    const keys = [
        ['enter', 'send · while running: queue a follow-up'],
        ['shift+enter  alt+enter  ctrl+j', 'new line (or end the line with \\)'],
        ['esc', 'interrupt the running turn · close a popup'],
        ['ctrl+c', 'clear input · interrupt · press twice to exit'],
        ['ctrl+d', 'exit (empty input)'],
        ['shift+tab', 'cycle mode: code → plan → auto'],
        ['↑ ↓', 'move between lines · history'],
        ['ctrl+o', 'show the last thinking / full tool output'],
        ['pgup pgdn  wheel  shift+↑↓', 'scroll the conversation · end follows the latest'],
        ['/copy', 'copy the last response to the clipboard'],
        ['ctrl+l', 'redraw the screen'],
        ['@path', 'attach a file · !cmd runs a shell command locally'],
    ];
    const kw = Math.min(34, Math.max(...keys.map(([k]) => k.length)) + 2);
    for (const [k, d] of keys)
        rows.push(truncateAnsi(`  ${theme.text(k.padEnd(kw))}${theme.muted(d)}`, width));
    return rows;
}
export function renderCostRows(usage, totals, lastTurn, width) {
    const rows = [`  ${style.bold('Usage')}`];
    if (usage.size) {
        rows.push(`  ${theme.muted('context'.padEnd(12))}${formatTokens(usage.used)} / ${formatTokens(usage.size)} (${Math.round((usage.used / usage.size) * 100)}%)`);
    }
    rows.push(`  ${theme.muted('cost'.padEnd(12))}${usage.cost > 0 ? formatCost(usage.cost) : 'not reported by this provider'}`);
    if (totals.turns) {
        const cw = totals.cacheWrite ?? 0;
        const cwSuffix = cw > 0 ? ` · ${formatTokens(cw)} cache write` : '';
        rows.push(`  ${theme.muted('this run'.padEnd(12))}${totals.turns} turn${totals.turns === 1 ? '' : 's'} · ↑ ${formatTokens(totals.input)} in · ↓ ${formatTokens(totals.output)} out · ${formatTokens(totals.cached)} cached${cwSuffix}`);
    }
    if (lastTurn) {
        const lcw = (lastTurn.cachedWriteTokens ?? 0) + (lastTurn.cachedWrite1hTokens ?? 0);
        const lcwSuffix = lcw > 0 ? ` · ${formatTokens(lcw)} cache write` : '';
        rows.push(`  ${theme.muted('last turn'.padEnd(12))}↑ ${formatTokens(lastTurn.inputTokens ?? 0)} in · ↓ ${formatTokens(lastTurn.outputTokens ?? 0)} out · ${formatTokens(lastTurn.cachedReadTokens ?? 0)} cached${lcwSuffix}`);
    }
    return rows.map((r) => truncateAnsi(r, width));
}
//# sourceMappingURL=overlays.js.map