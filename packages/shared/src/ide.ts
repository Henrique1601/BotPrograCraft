/**
 * Zero-based line and character position in a text document.
 */
export interface IdePosition {
  line: number;
  character: number;
}

/**
 * Span between two positions in a text document.
 */
export interface IdeRange {
  start: IdePosition;
  end: IdePosition;
}

/**
 * Active text selection inside the IDE editor.
 */
export interface IdeSelection {
  text: string;
  range: IdeRange;
  isEmpty: boolean;
}

/**
 * Diagnostic severity levels normalized from IDE language servers.
 */
export type IdeDiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint';

/**
 * Single compiler, linter, or language-server diagnostic entry.
 */
export interface IdeDiagnostic {
  message: string;
  severity: IdeDiagnosticSeverity;
  line: number;
  character?: number;
  source?: string;
  code?: string | number;
}

/**
 * Snapshot of the user's current IDE editor state sent over the local bridge.
 */
export interface IdeContextPayload {
  activeFile: string | null;
  languageId: string;
  selection: IdeSelection | null;
  visibleRangeText: string;
  diagnostics: IdeDiagnostic[];
  workspaceName: string | null;
  timestamp: number;
}
