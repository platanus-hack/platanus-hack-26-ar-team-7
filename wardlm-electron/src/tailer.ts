import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import chokidar, { FSWatcher } from 'chokidar';
import { LOG_PATH } from './paths';

const CHUNK = 64 * 1024;
const INITIAL_LINES = 2000;
const MAX_INITIAL_BYTES = 8 * 1024 * 1024;
const MAX_LINE_BYTES = 1 * 1024 * 1024;

export const DEFAULT_LOG_PATH = LOG_PATH;

export type TailerError = { code: string; message: string };

async function countFileLines(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let count = 0;
    let trailingByte = 0x0a;
    const stream = fs.createReadStream(filePath, { highWaterMark: CHUNK });
    stream.on('data', (chunk: Buffer) => {
      for (let i = 0; i < chunk.length; i++) {
        if (chunk[i] === 0x0a) count++;
      }
      if (chunk.length > 0) trailingByte = chunk[chunk.length - 1];
    });
    stream.on('end', () => {
      if (trailingByte !== 0x0a) count++;
      resolve(count);
    });
    stream.on('error', reject);
  });
}

async function readLastLines(
  filePath: string,
  maxLines: number,
): Promise<{ lines: string[]; size: number; remainder: string }> {
  const fd = await fs.promises.open(filePath, 'r');
  try {
    const stat = await fd.stat();
    let position = stat.size;
    let buffer = Buffer.alloc(0);
    let lineCount = 0;

    while (
      position > 0 &&
      lineCount <= maxLines &&
      stat.size - position < MAX_INITIAL_BYTES
    ) {
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
    const remainder = lines.pop() ?? '';
    return { lines: lines.slice(-maxLines), size: stat.size, remainder };
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
  private epoch = 0;

  constructor(public readonly filePath: string) {
    super();
  }

  async start(): Promise<{ initial: string[]; totalLines: number; path: string; error: TailerError | null }> {
    await this.stop();

    try {
      await fs.promises.stat(this.filePath);
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException;
      const payload: TailerError = {
        code: e.code ?? 'EUNKNOWN',
        message: e.message,
      };
      return { initial: [], totalLines: 0, path: this.filePath, error: payload };
    }

    let initial: string[] = [];
    let size = 0;
    let remainder = '';
    let totalLines = 0;
    try {
      const tail = await readLastLines(this.filePath, INITIAL_LINES);
      initial = tail.lines;
      size = tail.size;
      remainder = tail.remainder;
      totalLines = await countFileLines(this.filePath);
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException;
      const payload: TailerError = { code: e.code ?? 'EUNKNOWN', message: e.message };
      return { initial: [], totalLines: 0, path: this.filePath, error: payload };
    }

    this.offset = size;
    this.remainder = remainder;

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

    this.handleChange();

    return { initial, totalLines, path: this.filePath, error: null };
  }

  async stop(): Promise<void> {
    this.epoch++;
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
    const epoch = this.epoch;
    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(this.filePath);
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === 'ENOENT') return;
      throw err;
    }
    if (this.epoch !== epoch) return;

    if (stat.size < this.offset) {
      this.offset = 0;
      this.remainder = '';
      this.emit('rotated');
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
        if (this.epoch !== epoch) {
          stream.destroy();
          return;
        }
        buf += chunk;
        let nl = buf.indexOf('\n');
        while (nl !== -1) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          this.emit('line', line);
          nl = buf.indexOf('\n');
        }
        if (buf.length > MAX_LINE_BYTES) {
          this.emit('line', buf);
          buf = '';
        }
      });
      stream.on('close', () => resolve());
      stream.on('end', () => resolve());
      stream.on('error', (err) => reject(err));
    });

    if (this.epoch !== epoch) return;
    this.remainder = buf;
    this.offset = stat.size;
  }
}
