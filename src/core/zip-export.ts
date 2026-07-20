import { zipSync } from 'fflate';
import type { Chat, Message } from './types';
import {
  type AssetManifestEntry,
  type ChatAsset,
  assetPayloadBytes,
  dedupeAssets,
  safeFilename,
} from './assets';
import { chatToMarkdown, slugify } from './export';

export interface ZipChatEntry {
  chat: Chat;
  messages: Message[];
  assets: ChatAsset[];
}

function uniquePath(used: Set<string>, path: string): string {
  if (!used.has(path)) {
    used.add(path);
    return path;
  }
  const dot = path.lastIndexOf('.');
  const stem = dot > 0 ? path.slice(0, dot) : path;
  const ext = dot > 0 ? path.slice(dot) : '';
  let i = 2;
  while (used.has(`${stem}-${i}${ext}`)) i++;
  const next = `${stem}-${i}${ext}`;
  used.add(next);
  return next;
}

export function buildExportZip(entries: ZipChatEntry[], label: string): {
  bytes: Uint8Array;
  included: number;
  missing: number;
} {
  const files: Record<string, Uint8Array> = {};
  const used = new Set<string>();
  let included = 0;
  let missing = 0;

  const root = `tecora-${slugify(label) || 'export'}`;
  const indexLines = [
    '# Tecora ZIP export',
    '',
    `Exported: ${new Date().toISOString()}`,
    `Chats: ${entries.length}`,
    '',
    'This bundle includes conversation markdown plus downloadable artifacts/files Tecora could reach. Missing items are listed in each chat folder.',
    '',
  ];

  for (const entry of entries) {
    const folder = uniquePath(
      used,
      `${root}/${safeFilename(slugify(entry.chat.title) || entry.chat.chatId, entry.chat.chatId)}`,
    );
    // folder path itself reserved; files use uniquePath under it
    used.add(folder);

    const mdPath = `${folder}/conversation.md`;
    files[mdPath] = new TextEncoder().encode(chatToMarkdown(entry.chat, entry.messages));
    used.add(mdPath);

    const manifest: AssetManifestEntry[] = [];
    const missingLines: string[] = [];
    // last line of defense — same title from tool_use + sandbox shouldn't double up
    const assets = dedupeAssets(entry.assets);

    for (const asset of assets) {
      const bytes = assetPayloadBytes(asset);
      const assetName = uniquePath(
        used,
        `${folder}/assets/${safeFilename(asset.filename, asset.id)}`,
      );

      if (bytes && bytes.length > 0 && !asset.missingReason) {
        files[assetName] = bytes;
        included++;
        manifest.push({
          filename: assetName.replace(`${folder}/`, ''),
          kind: asset.kind,
          source: asset.source,
          status: 'included',
          bytes: bytes.length,
        });
      } else {
        missing++;
        const reason = asset.missingReason || 'no payload available';
        missingLines.push(`- **${asset.filename}** (${asset.kind}) — ${reason}`);
        manifest.push({
          filename: asset.filename,
          kind: asset.kind,
          source: asset.source,
          status: 'missing',
          missingReason: reason,
        });
      }
    }

    const manifestPath = `${folder}/assets-manifest.json`;
    files[manifestPath] = new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`);
    used.add(manifestPath);

    if (missingLines.length > 0) {
      const missingPath = `${folder}/MISSING.md`;
      files[missingPath] = new TextEncoder().encode(
        [
          '# Missing assets',
          '',
          'Tecora could see these but could not include their bytes.',
          '',
          ...missingLines,
          '',
        ].join('\n'),
      );
      used.add(missingPath);
    }

    indexLines.push(
      `- **${entry.chat.title}** (${entry.chat.platform}) — ${entry.messages.length} messages, ${entry.assets.length} asset refs`,
    );
  }

  files[`${root}/README.md`] = new TextEncoder().encode(indexLines.join('\n') + '\n');

  const bytes = zipSync(files, { level: 6 });
  return { bytes, included, missing };
}

export function zipFilename(label: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return `tecora-${slugify(label)}-${day}.zip`;
}

export function downloadZip(filename: string, bytes: Uint8Array): void {
  // copy into a fresh ArrayBuffer — Uint8Array views can be SharedArrayBuffer-backed
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
