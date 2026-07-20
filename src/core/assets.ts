// harvest-on-export asset model. adapters pull what each platform exposes;
// zip packing lives in zip-export.ts. bytes travel as base64 across the bus.

import type { Platform } from './types';

export type AssetKind = 'artifact' | 'image' | 'document' | 'file' | 'code';

export interface ChatAsset {
  id: string;
  chatId: string;
  platform: Platform;
  kind: AssetKind;
  filename: string;
  mimeType?: string;
  source: string;
  // utf-8 text when available (artifacts, extracted uploads)
  text?: string;
  // binary payload as base64 (images, pdfs, sandbox downloads)
  base64?: string;
  // why we couldn't fetch bytes — still listed in MISSING.md
  missingReason?: string;
  messageIndex?: number;
}

export interface AssetManifestEntry {
  filename: string;
  kind: AssetKind;
  source: string;
  status: 'included' | 'missing';
  missingReason?: string;
  bytes?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function extensionForMime(mime: string | undefined, fallback = 'bin'): string {
  if (!mime) return fallback;
  const map: Record<string, string> = {
    'text/markdown': 'md',
    'text/plain': 'txt',
    'text/html': 'html',
    'text/csv': 'csv',
    'application/json': 'json',
    'application/pdf': 'pdf',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'application/javascript': 'js',
    'text/javascript': 'js',
    'text/typescript': 'ts',
    'text/x-python': 'py',
  };
  if (map[mime]) return map[mime]!;
  if (mime.includes('/')) {
    const part = mime.split('/')[1];
    if (part && /^[a-z0-9.+-]+$/i.test(part)) return part.split('+')[0] || fallback;
  }
  return fallback;
}

export function extensionForLanguage(language: string | undefined): string | null {
  if (!language) return null;
  const lang = language.toLowerCase();
  const map: Record<string, string> = {
    markdown: 'md',
    md: 'md',
    javascript: 'js',
    js: 'js',
    typescript: 'ts',
    ts: 'ts',
    python: 'py',
    py: 'py',
    html: 'html',
    css: 'css',
    json: 'json',
    svg: 'svg',
    plaintext: 'txt',
    text: 'txt',
    java: 'java',
    go: 'go',
    rust: 'rs',
    ruby: 'rb',
    php: 'php',
    c: 'c',
    cpp: 'cpp',
    csharp: 'cs',
    sql: 'sql',
    yaml: 'yml',
    yml: 'yml',
    xml: 'xml',
    shell: 'sh',
    bash: 'sh',
  };
  return map[lang] ?? null;
}

export function safeFilename(name: string, fallback = 'file'): string {
  const cleaned = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return cleaned || fallback;
}

export function ensureExtension(filename: string, ext: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(`.${ext.toLowerCase()}`)) return filename;
  if (filename.includes('.')) return filename;
  return `${filename}.${ext}`;
}

function dedupeKey(asset: ChatAsset): string {
  // same filename in one chat = same file (tool_use + wiggle often collide)
  return `${asset.chatId}:${asset.filename.toLowerCase()}`;
}

function assetScore(asset: ChatAsset): number {
  let score = 0;
  if (asset.base64) score += 4;
  if (asset.text) score += 2 + Math.min(asset.text.length, 50_000) / 50_000;
  if (asset.missingReason) score -= 3;
  if (typeof asset.messageIndex === 'number') score += asset.messageIndex / 10_000;
  return score;
}

export function dedupeAssets(assets: ChatAsset[]): ChatAsset[] {
  const byKey = new Map<string, ChatAsset>();
  for (const asset of assets) {
    const key = dedupeKey(asset);
    const existing = byKey.get(key);
    if (!existing || assetScore(asset) >= assetScore(existing)) {
      byKey.set(key, asset);
    }
  }
  return Array.from(byKey.values());
}

// --- Claude ---------------------------------------------------------------

function claudeMessages(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!isRecord(data)) return [];
  const arr = data['chat_messages'] ?? data['messages'];
  return Array.isArray(arr) ? arr : [];
}

function artifactFromToolInput(
  chatId: string,
  input: Record<string, unknown>,
  index: number,
  messageIndex: number,
): ChatAsset | null {
  const command = asString(input['command']) ?? 'create';
  // prefer create; still take update/rewrite content when present (snapshot export)
  if (!['create', 'update', 'rewrite'].includes(command)) return null;

  const content = asString(input['content']);
  if (!content) return null;

  const title = asString(input['title']) ?? asString(input['id']) ?? `artifact-${index + 1}`;
  const type = asString(input['type']) ?? asString(input['artifact_type']) ?? 'text/plain';
  const language = asString(input['language']) ?? undefined;
  const ext =
    extensionForLanguage(language) ??
    extensionForMime(type, 'md');
  const filename = ensureExtension(safeFilename(title, `artifact-${index + 1}`), ext);
  const id = asString(input['id']) ?? asString(input['version_uuid']) ?? `claude-artifact-${index}`;

  return {
    id: `claude:${chatId}:${id}:${command}`,
    chatId,
    platform: 'claude',
    kind: type.startsWith('image/') ? 'image' : 'artifact',
    filename,
    mimeType: type,
    source: `tool_use:artifacts:${command}`,
    text: content,
    messageIndex,
  };
}

export function extractClaudeAssets(chatId: string, data: unknown): ChatAsset[] {
  const assets: ChatAsset[] = [];
  // keep latest content per artifact id when updates appear
  const byArtifactId = new Map<string, ChatAsset>();
  let counter = 0;

  claudeMessages(data).forEach((item, messageIndex) => {
    if (!isRecord(item)) return;

    const content = item['content'];
    if (Array.isArray(content)) {
      for (const block of content) {
        if (!isRecord(block)) continue;
        if (block['type'] !== 'tool_use') continue;
        const name = asString(block['name']);
        if (name !== 'artifacts' && name !== 'create_file') continue;
        const input = isRecord(block['input']) ? block['input'] : null;
        if (!input) continue;

        if (name === 'artifacts') {
          const asset = artifactFromToolInput(chatId, input, counter++, messageIndex);
          if (!asset) continue;
          const key = asString(input['id']) ?? asset.id;
          byArtifactId.set(key, asset);
          continue;
        }

        // create_file — sandbox-style file with inline content
        const fileContent = asString(input['content']) ?? asString(input['file_text']);
        const path = asString(input['path']) ?? asString(input['filename']) ?? `file-${counter + 1}.txt`;
        if (!fileContent) continue;
        const base = path.split('/').pop() || path;
        const filename = safeFilename(base, `file-${counter + 1}.txt`);
        assets.push({
          id: `claude:${chatId}:create_file:${counter++}`,
          chatId,
          platform: 'claude',
          kind: 'file',
          filename,
          source: 'tool_use:create_file',
          text: fileContent,
          messageIndex,
        });
      }
    }

    // uploaded attachments with extracted text
    const attachments = item['attachments'];
    if (Array.isArray(attachments)) {
      attachments.forEach((att, i) => {
        if (!isRecord(att)) return;
        const fileName = asString(att['file_name']) ?? asString(att['filename']) ?? `attachment-${i + 1}.txt`;
        const extracted = asString(att['extracted_content']);
        if (!extracted) {
          assets.push({
            id: `claude:${chatId}:att:${asString(att['id']) ?? i}`,
            chatId,
            platform: 'claude',
            kind: 'document',
            filename: safeFilename(fileName),
            mimeType: asString(att['file_type']) ?? undefined,
            source: 'message.attachments',
            missingReason: 'no extracted text available for this upload',
            messageIndex,
          });
          return;
        }
        assets.push({
          id: `claude:${chatId}:att:${asString(att['id']) ?? i}`,
          chatId,
          platform: 'claude',
          kind: 'document',
          filename: ensureExtension(safeFilename(fileName), 'txt'),
          mimeType: asString(att['file_type']) ?? 'text/plain',
          source: 'message.attachments',
          text: extracted,
          messageIndex,
        });
      });
    }

    // image / file previews
    const files = item['files'];
    if (Array.isArray(files)) {
      files.forEach((file, i) => {
        if (!isRecord(file)) return;
        const fileName =
          asString(file['file_name']) ??
          asString(file['filename']) ??
          `file-${i + 1}.bin`;
        const preview =
          (isRecord(file['preview_asset']) && asString(file['preview_asset']['url'])) ||
          asString(file['preview_url']) ||
          null;
        const fileUuid = asString(file['file_uuid']) ?? asString(file['id']);
        assets.push({
          id: `claude:${chatId}:file:${fileUuid ?? i}`,
          chatId,
          platform: 'claude',
          kind: 'image',
          filename: safeFilename(fileName),
          source: preview ?? (fileUuid ? `file_uuid:${fileUuid}` : 'message.files'),
          missingReason: preview || fileUuid ? undefined : 'no downloadable url on file entry',
          messageIndex,
        });
      });
    }
  });

  assets.push(...byArtifactId.values());
  return dedupeAssets(assets);
}

export function claudeFileDownloadUrl(orgId: string, fileUuid: string): string {
  return `https://claude.ai/api/organizations/${orgId}/files/${fileUuid}/download`;
}

// --- ChatGPT --------------------------------------------------------------

function chatgptNodes(data: unknown): unknown[] {
  if (!isRecord(data)) return [];
  const mapping = data['mapping'];
  if (!isRecord(mapping)) return [];
  return Object.values(mapping);
}

function fileIdFromPointer(pointer: string): string | null {
  const m =
    pointer.match(/file-service:\/\/(file-[A-Za-z0-9_-]+)/) ||
    pointer.match(/\/(file-[A-Za-z0-9_-]+)/) ||
    pointer.match(/^(file-[A-Za-z0-9_-]+)$/);
  return m?.[1] ?? null;
}

export function chatgptFileDownloadUrl(fileId: string): string {
  return `https://chatgpt.com/backend-api/files/${fileId}/download`;
}

export function extractChatGPTAssets(chatId: string, data: unknown): ChatAsset[] {
  const assets: ChatAsset[] = [];
  let counter = 0;

  chatgptNodes(data).forEach((node) => {
    if (!isRecord(node)) return;
    const message = node['message'];
    if (!isRecord(message)) return;
    const content = message['content'];
    if (!isRecord(content)) return;

    const contentType = asString(content['content_type']) ?? '';
    const parts = Array.isArray(content['parts']) ? content['parts'] : [];

    parts.forEach((part, partIndex) => {
      if (typeof part === 'string') {
        // fenced code blocks longer than a tweet — treat as optional code assets
        const fence = part.match(/```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/);
        if (fence && (fence[2]?.length ?? 0) >= 400) {
          const lang = fence[1] || 'txt';
          const ext = extensionForLanguage(lang) ?? 'txt';
          assets.push({
            id: `chatgpt:${chatId}:code:${counter++}`,
            chatId,
            platform: 'chatgpt',
            kind: 'code',
            filename: ensureExtension(safeFilename(`code-block-${counter}`, 'code'), ext),
            mimeType: 'text/plain',
            source: 'message.parts.code_fence',
            text: fence[2]!.trimEnd() + '\n',
          });
        }
        return;
      }

      if (!isRecord(part)) return;
      const partType = asString(part['content_type']) ?? contentType;

      if (
        partType === 'image_asset_pointer' ||
        partType === 'image' ||
        asString(part['asset_pointer'])
      ) {
        const pointer =
          asString(part['asset_pointer']) ??
          asString(part['url']) ??
          '';
        const fileId = pointer ? fileIdFromPointer(pointer) : null;
        const width = typeof part['width'] === 'number' ? part['width'] : null;
        const height = typeof part['height'] === 'number' ? part['height'] : null;
        const ext = 'png';
        const filename = ensureExtension(
          safeFilename(
            `image-${counter + 1}${width && height ? `-${width}x${height}` : ''}`,
            `image-${counter + 1}`,
          ),
          ext,
        );
        assets.push({
          id: `chatgpt:${chatId}:img:${fileId ?? pointer ?? partIndex}:${counter++}`,
          chatId,
          platform: 'chatgpt',
          kind: 'image',
          filename,
          mimeType: 'image/png',
          source: fileId
            ? chatgptFileDownloadUrl(fileId)
            : pointer || 'image_asset_pointer',
          missingReason: fileId || pointer.startsWith('http')
            ? undefined
            : 'could not resolve image download url',
        });
        return;
      }

      // some parts nest file refs
      const fileId =
        asString(part['file_id']) ??
        (asString(part['asset_pointer'])
          ? fileIdFromPointer(asString(part['asset_pointer'])!)
          : null);
      if (fileId && (partType.includes('file') || partType === 'audio_asset_pointer')) {
        const name =
          asString(part['filename']) ??
          asString(part['name']) ??
          `${fileId}.bin`;
        assets.push({
          id: `chatgpt:${chatId}:file:${fileId}`,
          chatId,
          platform: 'chatgpt',
          kind: 'file',
          filename: safeFilename(name),
          source: chatgptFileDownloadUrl(fileId),
        });
      }
    });

    // metadata attachments
    const metadata = message['metadata'];
    if (isRecord(metadata)) {
      const attachments = metadata['attachments'];
      if (Array.isArray(attachments)) {
        attachments.forEach((att) => {
          if (!isRecord(att)) return;
          const fileId = asString(att['id']) ?? asString(att['file_id']);
          const name = asString(att['name']) ?? asString(att['filename']) ?? fileId ?? `file-${counter++}`;
          if (!fileId) {
            assets.push({
              id: `chatgpt:${chatId}:meta:${name}`,
              chatId,
              platform: 'chatgpt',
              kind: 'document',
              filename: safeFilename(name),
              source: 'message.metadata.attachments',
              missingReason: 'attachment has no file id',
            });
            return;
          }
          assets.push({
            id: `chatgpt:${chatId}:meta:${fileId}`,
            chatId,
            platform: 'chatgpt',
            kind: 'document',
            filename: safeFilename(name),
            mimeType: asString(att['mime_type']) ?? undefined,
            source: chatgptFileDownloadUrl(fileId),
          });
        });
      }
    }
  });

  return dedupeAssets(assets);
}

// --- Gemini (DOM) ---------------------------------------------------------

export function extractGeminiAssetsFromDOM(
  chatId: string,
  root: ParentNode = document,
): ChatAsset[] {
  const assets: ChatAsset[] = [];
  let counter = 0;

  const imgs = Array.from(
    root.querySelectorAll(
      'img[src*="googleusercontent"], img[src*="ggpht"], img[src*="lh3."], img[src*="blob:"], img[alt*="Generated"]',
    ),
  ) as HTMLImageElement[];

  for (const img of imgs) {
    const src = img.currentSrc || img.src;
    if (!src || src.startsWith('data:image/svg')) continue;
    // skip tiny chrome icons
    if (img.naturalWidth > 0 && img.naturalWidth < 48 && img.naturalHeight < 48) continue;

    const alt = (img.alt || '').trim();
    const filename = ensureExtension(
      safeFilename(alt || `gemini-image-${counter + 1}`, `gemini-image-${counter + 1}`),
      'png',
    );
    assets.push({
      id: `gemini:${chatId}:img:${counter++}`,
      chatId,
      platform: 'gemini',
      kind: 'image',
      filename,
      mimeType: 'image/png',
      source: src,
    });
  }

  const links = Array.from(
    root.querySelectorAll('a[download], a[href*="blob:"], a[href*="googleusercontent"][href*="download"]'),
  ) as HTMLAnchorElement[];

  for (const a of links) {
    const href = a.href;
    if (!href) continue;
    const name =
      a.getAttribute('download') ||
      a.textContent?.trim() ||
      `gemini-file-${counter + 1}`;
    assets.push({
      id: `gemini:${chatId}:file:${counter++}`,
      chatId,
      platform: 'gemini',
      kind: 'document',
      filename: safeFilename(name, `gemini-file-${counter}`),
      source: href,
    });
  }

  return dedupeAssets(assets);
}

export function bytesFromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function base64FromBytes(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function assetPayloadBytes(asset: ChatAsset): Uint8Array | null {
  if (asset.base64) return bytesFromBase64(asset.base64);
  if (asset.text != null) return new TextEncoder().encode(asset.text);
  return null;
}
