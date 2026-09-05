import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

type Level = 'info' | 'warn' | 'error';

let logFile: string | null = null;

function target(): string {
  if (logFile) return logFile;
  const dir = app.getPath('logs');
  mkdirSync(dir, { recursive: true });
  logFile = join(dir, 'lyric-veil.log');
  return logFile;
}

function write(level: Level, scope: string, message: string, detail?: unknown): void {
  const line = detail === undefined ? '' : ` ${safeDetail(detail)}`;
  const record = `${new Date().toISOString()} ${level.toUpperCase()} [${scope}] ${message}${line}\n`;
  try {
    appendFileSync(target(), record, 'utf8');
  } catch {
    // A logger that throws takes the app down with it. Losing a line is the better failure.
  }
  if (level !== 'info') {
    const emit = level === 'warn' ? console.warn : console.error;
    emit(record.trimEnd());
  }
}

function safeDetail(detail: unknown): string {
  if (detail instanceof Error) return `${detail.name}: ${detail.message}`;
  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

export function createLogger(scope: string) {
  return {
    info: (message: string, detail?: unknown) => write('info', scope, message, detail),
    warn: (message: string, detail?: unknown) => write('warn', scope, message, detail),
    error: (message: string, detail?: unknown) => write('error', scope, message, detail),
  };
}
