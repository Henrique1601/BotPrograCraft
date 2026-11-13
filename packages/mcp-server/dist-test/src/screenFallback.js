"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.captureWindowsScreenJpeg = captureWindowsScreenJpeg;
const node_child_process_1 = require("node:child_process");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const node_util_1 = require("node:util");
const stateReader_1 = require("./stateReader");
const execFileAsync = (0, node_util_1.promisify)(node_child_process_1.execFile);
const POWERSHELL_CAPTURE_SCRIPT = [
    'Add-Type -AssemblyName System.Windows.Forms',
    'Add-Type -AssemblyName System.Drawing',
    '$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds',
    '$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height',
    '$graphics = [System.Drawing.Graphics]::FromImage($bitmap)',
    'try {',
    '  $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)',
    '  $bitmap.Save($env:BPC_OUT_JPG, [System.Drawing.Imaging.ImageFormat]::Jpeg)',
    '} finally {',
    '  $graphics.Dispose()',
    '  $bitmap.Dispose()',
    '}',
    '$ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()',
    '@{ width = $bounds.Width; height = $bounds.Height; timestamp = $ts } | ConvertTo-Json -Compress | Set-Content -Path $env:BPC_OUT_META -Encoding UTF8',
].join('; ');
async function runPowerShellCapture(jpgPath, metaPath, timeoutMs) {
    await execFileAsync('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        POWERSHELL_CAPTURE_SCRIPT,
    ], {
        timeout: timeoutMs,
        env: {
            ...process.env,
            BPC_OUT_JPG: jpgPath,
            BPC_OUT_META: metaPath,
        },
    });
}
/**
 * Captures the primary Windows screen as a JPEG into `<home>/latest-frame.jpg`
 * and writes `<home>/latest-frame.meta.json`, returning the resulting frame snapshot.
 */
async function captureWindowsScreenJpeg(options = {}) {
    if (!options.execCapture && process.platform !== 'win32') {
        return null;
    }
    const home = (0, stateReader_1.getBotPrograCraftHome)(options.homeDir);
    fs.mkdirSync(home, { recursive: true });
    const jpgPath = path.join(home, 'latest-frame.jpg');
    const metaPath = path.join(home, 'latest-frame.meta.json');
    const timeoutMs = options.timeoutMs ?? 10_000;
    if (options.execCapture) {
        await options.execCapture(jpgPath, metaPath);
    }
    else {
        await runPowerShellCapture(jpgPath, metaPath, timeoutMs);
    }
    return (0, stateReader_1.readLatestFrame)(home);
}
//# sourceMappingURL=screenFallback.js.map