import { readdir } from 'node:fs/promises';
import path from 'node:path';

// All regular files under `root`, as paths relative to it with forward slashes. Missing root → empty list.
export async function listFiles(root: string): Promise<string[]> {
  const result: string[] = [];
  async function walk(directory: string, prefix: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) await walk(path.join(directory, entry.name), relative);
      else if (entry.isFile()) result.push(relative);
    }
  }
  await walk(root, '');
  return result.sort();
}

// The only files the application's photo storage writes: `<id[0:2]>/<uuid>.<variant>.webp`.
export const PHOTO_FILE = /^([0-9a-f]{2})\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(display|thumb)\.webp$/;
export const PHOTO_VARIANTS = ['display', 'thumb'] as const;

export function photoFileName(id: string, variant: (typeof PHOTO_VARIANTS)[number]): string {
  return `${id.slice(0, 2)}/${id}.${variant}.webp`;
}
