import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface FileStorage {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
}

/** Stores files on local disk. Swap for S3/Supabase Storage in production. */
export class LocalFileStorage implements FileStorage {
  private readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
  }

  private resolveKey(key: string): string {
    if (!/^[A-Za-z0-9-]{1,64}$/.test(key)) throw new Error("invalid storage key");
    return path.join(this.dir, key);
  }

  async put(key: string, data: Buffer): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.resolveKey(key), data);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolveKey(key));
  }
}
