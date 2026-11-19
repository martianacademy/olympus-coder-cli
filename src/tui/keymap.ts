import type { InputEditor } from './editor.js';
import { isCtrl, type KeyEvent } from './keys.js';
import type { Suggestions } from './overlays.js';

/**
 * Editor keyboard binding dispatcher: routes decoded `KeyEvent`s to `InputEditor` operations,
 * suggestion popup navigation, and app-level shortcuts (submit, interrupt, clear, expand, mode cycle).
 */

export interface EditorKeyHost {
  readonly editor: InputEditor;
  readonly textWidth: number;
  readonly isRunning: boolean;
  suggestions: Suggestions | null;
  resetCtrlC(): void;
  acceptSuggestion(viaEnter: boolean): void;
  dismissSuggestions(): void;
  submit(): void;
  cycleMode(): void;
  interrupt(): void;
  clearHint(): void;
  ctrlC(): void;
  clearScreen(): void;
  expand(): void;
  exit(): void;
}

export function dispatchEditorKey(host: EditorKeyHost, k: KeyEvent): void {
  const e = host.editor;
  const width = host.textWidth;
  const sug = host.suggestions;
  if (k.name !== 'text' || !isCtrl(k, 'c')) host.resetCtrlC();

  if (sug && sug.items.length) {
    if (k.name === 'up') {
      sug.selected = (sug.selected + sug.items.length - 1) % sug.items.length;
      return;
    }
    if (k.name === 'down') {
      sug.selected = (sug.selected + 1) % sug.items.length;
      return;
    }
    if (k.name === 'tab' && !k.shift) return host.acceptSuggestion(false);
    if (k.name === 'enter' && !k.shift && !k.alt) return host.acceptSuggestion(true);
    if (k.name === 'escape') return host.dismissSuggestions();
  }

  switch (k.name) {
    case 'paste':
      return e.paste(k.text ?? '');
    case 'enter':
      if (k.shift || k.alt) return e.newline();
      if (e.text.slice(0, e.cursor).endsWith('\\')) {
        e.backspace();
        return e.newline();
      }
      return host.submit();
    case 'tab':
      if (k.shift) host.cycleMode();
      return;
    case 'escape':
      if (host.isRunning) return host.interrupt();
      host.clearHint();
      return;
    case 'backspace':
      return k.alt || k.ctrl ? e.deleteWordBack() : e.backspace();
    case 'delete':
      return e.deleteForward();
    case 'left':
      return k.alt || k.ctrl ? e.wordLeft() : e.left();
    case 'right':
      return k.alt || k.ctrl ? e.wordRight() : e.right();
    case 'home':
      return e.home();
    case 'end':
      return e.end();
    case 'up':
      if (!e.moveVertical(-1, width)) e.historyPrev();
      return;
    case 'down':
      if (!e.moveVertical(1, width)) e.historyNext();
      return;
    case 'text':
      break;
    default:
      return;
  }

  const t = k.text ?? '';
  if (k.ctrl && !k.alt) {
    switch (t) {
      case 'c':
        return host.ctrlC();
      case 'd':
        return e.isEmpty ? host.exit() : e.deleteForward();
      case 'a':
        return e.home();
      case 'e':
        return e.end();
      case 'b':
        return e.left();
      case 'f':
        return e.right();
      case 'w':
        return e.deleteWordBack();
      case 'u':
        return e.killToStart();
      case 'k':
        return e.killToEnd();
      case 'j':
        return e.newline();
      case 'l':
        return host.clearScreen();
      case 'o':
        return host.expand();
      case 'p':
        if (!e.moveVertical(-1, width)) e.historyPrev();
        return;
      case 'n':
        if (!e.moveVertical(1, width)) e.historyNext();
        return;
      default:
        return;
    }
  }
  if (k.alt) {
    if (t === 'b') return e.wordLeft();
    if (t === 'f') return e.wordRight();
    if (t === 'd') {
      const start = e.cursor;
      e.wordRight();
      e.setText(e.text.slice(0, start) + e.text.slice(e.cursor), start);
    }
    return;
  }
  e.insert(t);
}
