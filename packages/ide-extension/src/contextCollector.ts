import * as path from 'node:path';
import * as vscode from 'vscode';
import type {
  IdeContextPayload,
  IdeDiagnostic,
  IdeDiagnosticSeverity,
  IdeSelection,
} from '@botprogracraft/shared';

const MAX_VISIBLE_RANGE_CHARS = 16_000;
const MAX_DIAGNOSTICS = 50;

function isSensitiveFilePath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  const base = path.posix.basename(normalized);
  if (
    base === '.env' ||
    base.startsWith('.env.') ||
    base.endsWith('.pem') ||
    base.endsWith('.key')
  ) {
    return true;
  }
  return normalized.includes('credentials');
}

function mapDiagnosticSeverity(
  severity: vscode.DiagnosticSeverity
): IdeDiagnosticSeverity {
  switch (severity) {
    case vscode.DiagnosticSeverity.Error:
      return 'error';
    case vscode.DiagnosticSeverity.Warning:
      return 'warning';
    case vscode.DiagnosticSeverity.Information:
      return 'info';
    case vscode.DiagnosticSeverity.Hint:
      return 'hint';
  }
}

function normalizeDiagnosticCode(
  code: vscode.Diagnostic['code']
): string | number | undefined {
  if (code === undefined) {
    return undefined;
  }
  if (typeof code === 'object' && code !== null) {
    return code.value;
  }
  return code;
}

function extractSelection(editor: vscode.TextEditor): IdeSelection {
  const sel = editor.selection;
  return {
    text: editor.document.getText(sel),
    range: {
      start: {
        line: sel.start.line,
        character: sel.start.character,
      },
      end: {
        line: sel.end.line,
        character: sel.end.character,
      },
    },
    isEmpty: sel.isEmpty,
  };
}

function extractVisibleRangeText(editor: vscode.TextEditor): string {
  if (editor.visibleRanges.length === 0) {
    return '';
  }

  const combined = editor.visibleRanges
    .map((range) => editor.document.getText(range))
    .join('\n...\n');

  if (combined.length <= MAX_VISIBLE_RANGE_CHARS) {
    return combined;
  }
  return combined.slice(0, MAX_VISIBLE_RANGE_CHARS);
}

function extractDiagnostics(uri: vscode.Uri): IdeDiagnostic[] {
  const raw = vscode.languages.getDiagnostics(uri);
  return raw.slice(0, MAX_DIAGNOSTICS).map((diag) => ({
    message: diag.message,
    severity: mapDiagnosticSeverity(diag.severity),
    line: diag.range.start.line,
    character: diag.range.start.character,
    source: diag.source,
    code: normalizeDiagnosticCode(diag.code),
  }));
}

/**
 * Collects a snapshot of the active editor, selection, visible text, and diagnostics.
 */
export function collectIdeContext(
  editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor
): IdeContextPayload {
  const workspaceName = vscode.workspace.name ?? null;

  if (!editor) {
    return {
      activeFile: null,
      languageId: 'plaintext',
      selection: null,
      visibleRangeText: '',
      diagnostics: [],
      workspaceName,
      timestamp: Date.now(),
    };
  }

  const activeFile = vscode.workspace.asRelativePath(editor.document.uri, false);

  if (isSensitiveFilePath(activeFile)) {
    return {
      activeFile,
      languageId: editor.document.languageId,
      selection: null,
      visibleRangeText: '[REDACTED: sensitive file]',
      diagnostics: [],
      workspaceName,
      timestamp: Date.now(),
    };
  }

  return {
    activeFile,
    languageId: editor.document.languageId,
    selection: extractSelection(editor),
    visibleRangeText: extractVisibleRangeText(editor),
    diagnostics: extractDiagnostics(editor.document.uri),
    workspaceName,
    timestamp: Date.now(),
  };
}

export interface ContextWatcherOptions {
  getDebounceMs: () => number;
  isLiveSyncEnabled: () => boolean;
  onContext: (payload: IdeContextPayload) => void;
}

/**
 * Watches active editor, selection, visible range, and diagnostics changes,
 * emitting debounced IdeContextPayload snapshots when live sync is enabled.
 */
export class IdeContextWatcher implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private debounceTimer: NodeJS.Timeout | undefined;

  constructor(private readonly options: ContextWatcherOptions) {
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (!this.options.isLiveSyncEnabled()) {
          return;
        }
        this.clearTimer();
        this.options.onContext(collectIdeContext(editor));
      }),
      vscode.window.onDidChangeTextEditorSelection((event) => {
        if (!this.options.isLiveSyncEnabled()) {
          return;
        }
        if (event.textEditor === vscode.window.activeTextEditor) {
          this.scheduleEmit();
        }
      }),
      vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
        if (!this.options.isLiveSyncEnabled()) {
          return;
        }
        if (event.textEditor === vscode.window.activeTextEditor) {
          this.scheduleEmit();
        }
      }),
      vscode.languages.onDidChangeDiagnostics((event) => {
        if (!this.options.isLiveSyncEnabled()) {
          return;
        }
        const activeUri = vscode.window.activeTextEditor?.document.uri.toString();
        if (!activeUri) {
          return;
        }
        const affectsActive = event.uris.some((uri) => uri.toString() === activeUri);
        if (affectsActive) {
          this.scheduleEmit();
        }
      })
    );
  }

  private scheduleEmit(): void {
    this.clearTimer();
    const delay = Math.max(50, this.options.getDebounceMs());
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = undefined;
      if (this.options.isLiveSyncEnabled()) {
        this.options.onContext(collectIdeContext());
      }
    }, delay);
  }

  private clearTimer(): void {
    if (this.debounceTimer !== undefined) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
  }

  public dispose(): void {
    this.clearTimer();
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables.length = 0;
  }
}
