import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import chokidar, { FSWatcher } from 'chokidar';

const CHUNK = 64 * 1024;
const INITIAL_LINES = 2000;

export const DEFAULT_LOG_PATH = '/var/log/lmwrap/lmwrap.log';

export type TailerError = { code: string; message: string };

async function readLastLines(filePath: string, maxLines: number): Promise<string[]> {
  const fd = await fs.promises.open(filePath, 'r');
  try {
    const stat = await fd.stat();
    let position = stat.size;
    let buffer = Buffer.alloc(0);
    let lineCount = 0;

    while (position > 0 && lineCount <= maxLines) {
      const readSize = Math.min(CHUNK, position);
      position -= readSize;
      const chunk = Buffer.alloc(readSize);
      await fd.read(chunk, 0, readSize, position);
      buffer = Buffer.concat([chunk, buffer]);
      lineCount = 0;
      for (const byte of buffer) {
        if (byte === 0x0a) lineCount++;
      }
    }

    const text = buffer.toString('utf8');
    const lines = text.split('\n');
    if (lines.length && lines[lines.length - 1] === '') lines.pop();
    return lines.slice(-maxLines);
  } finally {
    await fd.close();
  }
}

export class LogTailer extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private offset = 0;
  private reading = false;
  private pendingChange = false;
  private remainder = '';

  constructor(public readonly filePath: string) {
    super();
  }

  async start(): Promise<{ initial: string[]; path: string }> {
    await this.stop();

    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(this.filePath);
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException;
      const payload: TailerError = {
        code: e.code ?? 'EUNKNOWN',
        message: e.message,
      };
      this.emit('error', payload);
      return { initial: [], path: this.filePath };
    }

    let initial: string[] = [];
    try {
      initial = await readLastLines(this.filePath, INITIAL_LINES);
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException;
      this.emit('error', { code: e.code ?? 'EUNKNOWN', message: e.message });
      return { initial: [], path: this.filePath };
    }

    this.offset = stat.size;
    this.remainder = '';

    const dir = path.dirname(this.filePath);
    const base = path.basename(this.filePath);
    this.watcher = chokidar.watch(this.filePath, {
      ignoreInitial: true,
      awaitWriteFinish: false,
      persistent: true,
      cwd: dir,
    });
    void base;

    this.watcher.on('change', () => this.handleChange());
    this.watcher.on('add', () => this.handleRotation());
    this.watcher.on('unlink', () => this.handleRotation());
    this.watcher.on('error', (err) => {
      const e = err as NodeJS.ErrnoException;
      this.emit('error', { code: e.code ?? 'EUNKNOWN', message: e.message });
    });

    return { initial, path: this.filePath };
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    this.offset = 0;
    this.remainder = '';
    this.reading = false;
    this.pendingChange = false;
  }

  private handleRotation(): void {
    this.offset = 0;
    this.remainder = '';
    this.emit('rotated');
    this.handleChange();
  }

  private handleChange(): void {
    if (this.reading) {
      this.pendingChange = true;
      return;
    }
    this.reading = true;
    this.pendingChange = false;
    this.readNew()
      .catch((err: NodeJS.ErrnoException) => {
        this.emit('error', { code: err.code ?? 'EUNKNOWN', message: err.message });
      })
      .finally(() => {
        this.reading = false;
        if (this.pendingChange) this.handleChange();
      });
  }

  private async readNew(): Promise<void> {
    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(this.filePath);
    } catch (err) {
      throw err;
    }

    if (stat.size < this.offset) {
      this.offset = 0;
      this.remainder = '';
    }
    if (stat.size === this.offset) return;

    const stream = fs.createReadStream(this.filePath, {
      start: this.offset,
      end: stat.size - 1,
      encoding: 'utf8',
    });

    let buf = this.remainder;
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk) => {
        buf += chunk;
        let nl = buf.indexOf('\n');
        while (nl !== -1) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          this.emit('line', line);
          nl = buf.indexOf('\n');
        }
      });
      stream.on('end', () => resolve());
      stream.on('error', (err) => reject(err));
    });

    this.remainder = buf;
    this.offset = stat.size;
  }
}
