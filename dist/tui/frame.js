import { inputTextWidth, renderDialog, renderInputBox, renderPicker, renderStatusLine, renderSuggestions, } from './components.js';
import { filteredPickerItems } from './overlays.js';
import { formatDuration, formatTokens, strWidth, theme, truncateAnsi } from './text.js';
export function renderSpinnerRow(s, now) {
    const secs = formatDuration(now - s.turnStartedAt);
    const toks = Math.round(s.transcript.streamedChars / 4);
    const meta = [secs, ...(toks > 0 ? [`↓ ${formatTokens(toks)} tokens`] : []), 'esc to interrupt'].join(' · ');
    const label = s.overlay?.type === 'permission' ? 'Waiting for approval' : s.transcript.activity();
    const left = `  ${theme.accent(s.transcript.spinner(now))} ${label}`;
    const room = s.width - strWidth(left) - 3;
    const right = room > 8 ? theme.muted(` · ${truncateAnsi(meta, room)}`) : '';
    return truncateAnsi(left + right, s.width);
}
export function composeLiveFrame(s) {
    const now = s.now ?? Date.now();
    const w = s.width;
    const rows = [...s.transcript.liveRows(now)];
    if (s.running)
        rows.push('', renderSpinnerRow(s, now));
    if (s.queuedShown.length) {
        rows.push('');
        for (const shown of s.queuedShown) {
            rows.push(truncateAnsi(`  ${theme.muted('↳ queued: ')}${theme.subtle(shown.replace(/\s+/g, ' '))}`, w));
        }
    }
    rows.push('');
    let cursor = null;
    const collapseBlanks = () => {
        for (let i = rows.length - 1; i > 0; i--) {
            if (rows[i] === '' && rows[i - 1] === '')
                rows.splice(i, 1);
        }
        return rows.length;
    };
    const statusLine = () => renderStatusLine({
        mode: s.mode,
        ...(s.noProvider ? { provider: 'not connected' } : { provider: s.provider, model: s.model }),
        used: s.usage.used,
        size: s.usage.size,
        cost: s.usage.cost,
        ...(s.hint ? { hint: s.hint } : {}),
    }, w);
    if (s.overlay?.type === 'permission') {
        collapseBlanks();
        rows.push(...renderDialog({ ...s.overlay, width: w }), statusLine());
    }
    else if (s.overlay?.type === 'picker') {
        const at = collapseBlanks();
        const p = s.overlay;
        const items = filteredPickerItems(p);
        const view = renderPicker({
            title: p.title,
            filter: p.filter,
            items,
            selected: Math.min(p.selected, Math.max(0, items.length - 1)),
            width: w,
            maxRows: Math.max(4, Math.min(12, s.screenHeight - 8)),
        });
        rows.push(...view.rows);
        cursor = { row: at + view.cursor.row, col: view.cursor.col };
    }
    else {
        const at = collapseBlanks();
        const boxView = renderInputBox({
            width: w,
            layout: s.editor.layout(inputTextWidth(w)),
            isEmpty: s.editor.isEmpty,
            placeholder: s.placeholder,
            maxRows: Math.max(3, Math.min(12, s.screenHeight - 8)),
        });
        rows.push(...boxView.rows);
        cursor = { row: at + boxView.cursor.row, col: boxView.cursor.col };
        if (s.suggestions?.items.length) {
            rows.push(...renderSuggestions(s.suggestions.items, s.suggestions.selected, w));
        }
        else {
            rows.push(statusLine());
        }
    }
    return { rows, cursor };
}
//# sourceMappingURL=frame.js.map