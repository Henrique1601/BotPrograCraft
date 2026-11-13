"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextAggregator = void 0;
const SEVERITY_ORDER = {
    error: 0,
    warning: 1,
    info: 2,
    hint: 3,
};
const DEFAULT_MAX_VISIBLE_CHARS = 6000;
const DEFAULT_MAX_SELECTION_CHARS = 2000;
const DEFAULT_MAX_DIAGNOSTICS = 20;
function truncateText(text, maxChars) {
    if (text.length <= maxChars) {
        return { text, truncated: false };
    }
    return {
        text: `${text.slice(0, maxChars)}\n... [truncated ${text.length - maxChars} chars]`,
        truncated: true,
    };
}
function estimateBase64Bytes(base64) {
    const len = base64.length;
    if (len === 0)
        return 0;
    const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((len * 3) / 4) - padding);
}
function formatDiagnostic(diag) {
    const line = diag.line + 1;
    const col = diag.character !== undefined ? `:${diag.character + 1}` : '';
    const source = diag.source ? `[${diag.source}] ` : '';
    const code = diag.code !== undefined ? ` (${String(diag.code)})` : '';
    return `- ${diag.severity.toUpperCase()} L${line}${col} ${source}${diag.message}${code}`;
}
/**
 * Aggregates live IDE editor state and latest screen-capture frame metadata
 * into a structured snapshot and prompt-ready text summary.
 */
class ContextAggregator {
    ideContext = null;
    screenFrame = null;
    maxVisibleChars;
    maxSelectionChars;
    maxDiagnostics;
    constructor(options = {}) {
        this.maxVisibleChars = options.maxVisibleChars ?? DEFAULT_MAX_VISIBLE_CHARS;
        this.maxSelectionChars = options.maxSelectionChars ?? DEFAULT_MAX_SELECTION_CHARS;
        this.maxDiagnostics = options.maxDiagnostics ?? DEFAULT_MAX_DIAGNOSTICS;
    }
    updateIdeContext(payload) {
        this.ideContext = payload;
    }
    updateScreenFrame(frame) {
        this.screenFrame = frame;
    }
    clearIdeContext() {
        this.ideContext = null;
    }
    clearScreenFrame() {
        this.screenFrame = null;
    }
    clearAll() {
        this.ideContext = null;
        this.screenFrame = null;
    }
    getIdeContext() {
        return this.ideContext;
    }
    getLatestScreenFrame() {
        return this.screenFrame;
    }
    getScreenFrameMetadata(now = Date.now()) {
        if (!this.screenFrame)
            return null;
        return {
            mimeType: this.screenFrame.mimeType,
            width: this.screenFrame.width,
            height: this.screenFrame.height,
            timestamp: this.screenFrame.timestamp,
            sourceId: this.screenFrame.sourceId,
            sourceName: this.screenFrame.sourceName,
            approxBytes: estimateBase64Bytes(this.screenFrame.dataBase64),
            ageMs: Math.max(0, now - this.screenFrame.timestamp),
        };
    }
    getSnapshot(now = Date.now()) {
        const screenFrameMetadata = this.getScreenFrameMetadata(now);
        const updatedAt = Math.max(this.ideContext?.timestamp ?? 0, this.screenFrame?.timestamp ?? 0) || null;
        return {
            ideContext: this.ideContext,
            screenFrame: this.screenFrame,
            screenFrameMetadata,
            formattedText: this.formatContext(now),
            updatedAt,
        };
    }
    formatContext(now = Date.now()) {
        const parts = [];
        if (this.ideContext) {
            const ctx = this.ideContext;
            const ideLines = [
                '### IDE Context',
                `- Workspace: ${ctx.workspaceName ?? 'unknown'}`,
                `- Active File: ${ctx.activeFile ?? 'none'}`,
                `- Language: ${ctx.languageId || 'plaintext'}`,
                `- Captured At: ${new Date(ctx.timestamp).toISOString()}`,
            ];
            if (ctx.diagnostics.length > 0) {
                const sorted = [...ctx.diagnostics].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
                const shown = sorted.slice(0, this.maxDiagnostics);
                ideLines.push(`- Diagnostics (${ctx.diagnostics.length} total, showing ${shown.length}):`);
                for (const diag of shown) {
                    ideLines.push(`  ${formatDiagnostic(diag)}`);
                }
            }
            else {
                ideLines.push('- Diagnostics: none');
            }
            if (ctx.selection && !ctx.selection.isEmpty && ctx.selection.text.length > 0) {
                const startLine = ctx.selection.range.start.line + 1;
                const endLine = ctx.selection.range.end.line + 1;
                const { text: selText } = truncateText(ctx.selection.text, this.maxSelectionChars);
                ideLines.push(`- Selection (L${startLine}-L${endLine}):`);
                ideLines.push('```' + (ctx.languageId || '') + '\n' + selText + '\n```');
            }
            else {
                ideLines.push('- Selection: none');
            }
            if (ctx.visibleRangeText.trim().length > 0) {
                const { text: visibleText } = truncateText(ctx.visibleRangeText, this.maxVisibleChars);
                ideLines.push('- Visible Editor Code:');
                ideLines.push('```' + (ctx.languageId || '') + '\n' + visibleText + '\n```');
            }
            else {
                ideLines.push('- Visible Editor Code: (empty)');
            }
            parts.push(ideLines.join('\n'));
        }
        else {
            parts.push('### IDE Context\n- No active IDE context received yet.');
        }
        const frameMeta = this.getScreenFrameMetadata(now);
        if (frameMeta) {
            const sourceLabel = frameMeta.sourceName ?? frameMeta.sourceId ?? 'default screen';
            parts.push([
                '### Screen Frame Metadata',
                `- Source: ${sourceLabel}`,
                `- Resolution: ${frameMeta.width}x${frameMeta.height}`,
                `- Format: ${frameMeta.mimeType} (~${frameMeta.approxBytes} bytes)`,
                `- Age: ${frameMeta.ageMs}ms (captured ${new Date(frameMeta.timestamp).toISOString()})`,
            ].join('\n'));
        }
        else {
            parts.push('### Screen Frame Metadata\n- No screen frame captured.');
        }
        return parts.join('\n\n');
    }
}
exports.ContextAggregator = ContextAggregator;
//# sourceMappingURL=contextAggregator.js.map