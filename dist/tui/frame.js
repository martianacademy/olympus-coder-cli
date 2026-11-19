import { inputTextWidth, renderDialog, renderInputBox, renderPicker, renderStatusLine, renderSuggestions, } from './components.js';
import { filteredPickerItems } from './overlays.js';
import { renderHero, renderTopBar, TOP_BAR_ROWS } from './logo.js';
import { formatDuration, formatTokens, padEndAnsi, strWidth, theme, truncateAnsi } from './text.js';
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
// ---------------------------------------------------------------------------------------------------------
// Full-screen (alt screen) frame
export { TOP_BAR_ROWS };
export const SCROLL_HINT = '↓ scrolled up · PgDn / wheel / End to follow';
/** Status line used by both composers. */
function statusRow(s) {
    return renderStatusLine({
        mode: s.mode,
        ...(s.noProvider ? { provider: 'not connected' } : { provider: s.provider, model: s.model }),
        used: s.usage.used,
        size: s.usage.size,
        cost: s.usage.cost,
        ...(s.hint ? { hint: s.hint } : {}),
    }, s.width);
}
/** Bottom dock: spinner, queued steering, scroll hint, dialog / picker / (suggestions + input box), status bar. */
export function composeDock(s, now, scrolled, maxRows) {
    const w = s.width;
    const rows = [];
    let cursor = null;
    if (s.running)
        rows.push(renderSpinnerRow(s, now));
    for (const shown of s.queuedShown) {
        rows.push(truncateAnsi(`  ${theme.muted('↳ queued: ')}${theme.subtle(shown.replace(/\s+/g, ' '))}`, w));
    }
    if (scrolled)
        rows.push(truncateAnsi(`  ${theme.accent('↓')} ${theme.muted(SCROLL_HINT.slice(2))}`, w));
    const room = Math.max(4, maxRows - rows.length - 1);
    if (s.overlay?.type === 'permission') {
        rows.push(...renderDialog({ ...s.overlay, width: w }));
    }
    else if (s.overlay?.type === 'picker') {
        const p = s.overlay;
        const items = filteredPickerItems(p);
        const view = renderPicker({
            title: p.title,
            filter: p.filter,
            items,
            selected: Math.min(p.selected, Math.max(0, items.length - 1)),
            width: w,
            maxRows: Math.max(3, Math.min(12, room - 5)),
        });
        cursor = { row: rows.length + view.cursor.row, col: view.cursor.col };
        rows.push(...view.rows);
    }
    else {
        if (s.suggestions?.items.length) {
            rows.push(...renderSuggestions(s.suggestions.items, s.suggestions.selected, w, Math.max(2, Math.min(8, room - 4))));
        }
        const box = renderInputBox({
            width: w,
            layout: s.editor.layout(inputTextWidth(w)),
            isEmpty: s.editor.isEmpty,
            placeholder: s.placeholder,
            maxRows: Math.max(1, Math.min(10, room - 2)),
        });
        cursor = { row: rows.length + box.cursor.row, col: box.cursor.col };
        rows.push(...box.rows);
    }
    rows.push(statusRow(s));
    if (rows.length > maxRows) {
        const cut = rows.length - maxRows;
        rows.splice(0, cut);
        cursor = cursor && cursor.row >= cut ? { row: cursor.row - cut, col: cursor.col } : null;
    }
    return { rows, cursor };
}
/** Scrollbar glyph for viewport row `i`. */
function scrollbarGlyph(i, vp, total, start) {
    const thumb = Math.max(1, Math.round((vp * vp) / total));
    const maxStart = Math.max(1, total - vp);
    const top = Math.round((start / maxStart) * (vp - thumb));
    return i >= top && i < top + thumb ? theme.muted('┃') : theme.subtle('│');
}
export function composeFullFrame(s) {
    const now = s.now ?? Date.now();
    const w = s.width;
    const h = Math.max(4, s.height);
    const top = renderTopBar(s.topBar, w);
    const maxDock = Math.max(1, h - TOP_BAR_ROWS - 1);
    const live = s.transcript.liveRows(now);
    const conversation = s.hasConversation || s.running || live.length > 0 || s.overlay !== null;
    if (!conversation) {
        const dock = composeDock(s, now, false, maxDock);
        const mid = h - TOP_BAR_ROWS - dock.rows.length;
        const hero = renderHero(s.hero, w);
        const shown = hero.length <= mid ? hero : [];
        const heroW = Math.max(0, ...shown.map(strWidth));
        const left = ' '.repeat(Math.max(0, Math.floor((w - heroW) / 2)));
        const padTop = Math.max(0, Math.floor((mid - shown.length) / 2));
        const middle = Array.from({ length: mid }, () => '');
        shown.forEach((r, i) => (middle[padTop + i] = truncateAnsi(left + r, w)));
        const cursor = dock.cursor ? { row: TOP_BAR_ROWS + mid + dock.cursor.row, col: dock.cursor.col } : null;
        return { frame: { rows: [...top, ...middle, ...dock.rows], cursor }, scrollOffset: 0, total: 0, viewportHeight: mid };
    }
    const total = s.committedRows.length + live.length;
    let want = Math.max(0, s.scrollOffset);
    if (want > 0 && s.prevTotal > 0 && total > s.prevTotal)
        want += total - s.prevTotal;
    let dock = composeDock(s, now, false, maxDock);
    let vp = Math.max(1, h - TOP_BAR_ROWS - dock.rows.length);
    let offset = Math.min(want, Math.max(0, total - vp));
    if (offset > 0) {
        // The scroll hint takes a dock row: re-clamp the requested offset against the smaller viewport.
        dock = composeDock(s, now, true, maxDock);
        vp = Math.max(1, h - TOP_BAR_ROWS - dock.rows.length);
        offset = Math.min(want, Math.max(0, total - vp));
    }
    const start = Math.max(0, total - vp - offset);
    const at = (i) => (i < s.committedRows.length ? s.committedRows[i] : live[i - s.committedRows.length]);
    const overflow = total > vp;
    const view = [];
    for (let i = 0; i < vp; i++) {
        const idx = start + i;
        const row = idx < total ? (at(idx) ?? '') : '';
        view.push(overflow ? padEndAnsi(truncateAnsi(row, w - 2), w - 2) + ' ' + scrollbarGlyph(i, vp, total, start) : truncateAnsi(row, w));
    }
    const cursor = dock.cursor ? { row: TOP_BAR_ROWS + vp + dock.cursor.row, col: dock.cursor.col } : null;
    return { frame: { rows: [...top, ...view, ...dock.rows], cursor }, scrollOffset: offset, total, viewportHeight: vp };
}
//# sourceMappingURL=frame.js.map