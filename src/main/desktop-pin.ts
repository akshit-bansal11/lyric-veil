import { execFile } from 'node:child_process';
import type { BrowserWindow } from 'electron';
import { createLogger } from './lib/logger';

const log = createLogger('desktop');

/**
 * Pin the overlay to the desktop itself, wallpaper-engine style.
 *
 * Win+D hides every top-level window, topmost or not; the only windows that
 * survive are children of the desktop. Re-parenting the overlay under the
 * window that owns the icon view (Progman on current Windows 11, a WorkerW on
 * older layouts) makes it part of the desktop: behind every other window,
 * above the icons, and untouched by Show Desktop.
 *
 * Electron exposes no way to do this, and the three user32 calls it needs are
 * not worth a native module. A PowerShell P/Invoke script, always present on
 * Windows, does the job in about a second, once per toggle.
 */

const USER32 = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class LV {
  [DllImport("user32.dll", SetLastError=true)] public static extern IntPtr FindWindow(string c, string w);
  [DllImport("user32.dll", SetLastError=true)] public static extern IntPtr FindWindowEx(IntPtr p, IntPtr a, string c, string w);
  [DllImport("user32.dll", SetLastError=true)] public static extern IntPtr SendMessageTimeout(IntPtr h, uint m, UIntPtr w, IntPtr l, uint f, uint t, out UIntPtr r);
  [DllImport("user32.dll", SetLastError=true)] public static extern IntPtr SetParent(IntPtr c, IntPtr p);
  [DllImport("user32.dll", SetLastError=true)] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);
  [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr h);
}
"@
`;

/** SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE | SWP_SHOWWINDOW */
const SWP_FLAGS = '0x0053';

function pinScript(hwnd: string): string {
  return `${USER32}
$target = [IntPtr]::new([Int64]${hwnd})
$progman = [LV]::FindWindow("Progman", [NullString]::Value)
if ($progman -eq [IntPtr]::Zero) { "FAIL no Progman"; exit 1 }

# PowerShell binds $null to a .NET string as "", which would search for a window
# titled ""; [NullString]::Value is the only way to pass a real null here.
# Ask the shell to make sure the desktop layering exists. Harmless when it already does.
[UIntPtr]$r = [UIntPtr]::Zero
[LV]::SendMessageTimeout($progman, 0x052C, [UIntPtr]::Zero, [IntPtr]::Zero, 0, 1000, [ref]$r) | Out-Null

# The window that owns the icon view is the desktop. Windows 11 24H2+ keeps it
# directly under Progman; older layouts put it in a top-level WorkerW.
$container = [IntPtr]::Zero
if ([LV]::FindWindowEx($progman, [IntPtr]::Zero, "SHELLDLL_DefView", [NullString]::Value) -ne [IntPtr]::Zero) {
  $container = $progman
} else {
  $ww = [IntPtr]::Zero
  while ($true) {
    $ww = [LV]::FindWindowEx([IntPtr]::Zero, $ww, "WorkerW", [NullString]::Value)
    if ($ww -eq [IntPtr]::Zero) { break }
    if ([LV]::FindWindowEx($ww, [IntPtr]::Zero, "SHELLDLL_DefView", [NullString]::Value) -ne [IntPtr]::Zero) { $container = $ww; break }
  }
}
if ($container -eq [IntPtr]::Zero) { "FAIL no desktop view"; exit 1 }

if ([LV]::SetParent($target, $container) -eq [IntPtr]::Zero) { "FAIL SetParent " + [Runtime.InteropServices.Marshal]::GetLastWin32Error(); exit 1 }
# Top of the desktop's own stack: above the icons, still under every real window.
[LV]::SetWindowPos($target, [IntPtr]::Zero, 0, 0, 0, 0, ${SWP_FLAGS}) | Out-Null
"OK"
`;
}

function unpinScript(hwnd: string): string {
  return `${USER32}
$target = [IntPtr]::new([Int64]${hwnd})
if ([LV]::GetParent($target) -eq [IntPtr]::Zero) { "OK already top-level"; exit 0 }
if ([LV]::SetParent($target, [IntPtr]::Zero) -eq [IntPtr]::Zero) { "FAIL SetParent " + [Runtime.InteropServices.Marshal]::GetLastWin32Error(); exit 1 }
"OK"
`;
}

function hwndOf(win: BrowserWindow): string {
  const handle = win.getNativeWindowHandle();
  // A pointer-sized little-endian integer: 8 bytes on x64, 4 on ia32.
  const value = handle.length >= 8 ? handle.readBigUInt64LE(0) : BigInt(handle.readUInt32LE(0));
  return value.toString();
}

function runPowerShell(script: string): Promise<string> {
  // -EncodedCommand sidesteps every quoting problem between Node, the Windows
  // command line and PowerShell: the script travels as base64 UTF-16LE.
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { windowsHide: true, timeout: 20_000 },
      (error, stdout, stderr) => {
        const out = stdout.trim();
        if (error && !out.startsWith('OK'))
          reject(new Error(out || stderr.trim() || error.message));
        else resolve(out);
      },
    );
  });
}

export async function pinToDesktop(win: BrowserWindow): Promise<boolean> {
  if (process.platform !== 'win32' || win.isDestroyed()) return false;
  try {
    const result = await runPowerShell(pinScript(hwndOf(win)));
    log.info(`pinned to desktop: ${result}`);
    return true;
  } catch (error) {
    log.warn('could not pin to desktop', error);
    return false;
  }
}

export async function unpinFromDesktop(win: BrowserWindow): Promise<boolean> {
  if (process.platform !== 'win32' || win.isDestroyed()) return false;
  try {
    const result = await runPowerShell(unpinScript(hwndOf(win)));
    log.info(`unpinned from desktop: ${result}`);
    return true;
  } catch (error) {
    log.warn('could not unpin from desktop', error);
    return false;
  }
}
