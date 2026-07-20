/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import {
  extractChatGPTAssets,
  extractClaudeAssets,
  extractGeminiAssetsFromDOM,
  ensureExtension,
  safeFilename,
} from './assets';

describe('extractClaudeAssets', () => {
  it('pulls artifact bodies from tool_use artifacts create', () => {
    const data = {
      chat_messages: [
        {
          sender: 'assistant',
          content: [
            { type: 'text', text: 'here is a doc' },
            {
              type: 'tool_use',
              name: 'artifacts',
              input: {
                id: 'art-1',
                command: 'create',
                title: 'Dashboard Spec',
                type: 'text/markdown',
                content: '# Spec\n\nHello world',
              },
            },
          ],
        },
      ],
    };

    const assets = extractClaudeAssets('chat-1', data);
    expect(assets).toHaveLength(1);
    expect(assets[0]).toMatchObject({
      kind: 'artifact',
      filename: 'Dashboard Spec.md',
      text: '# Spec\n\nHello world',
      platform: 'claude',
    });
  });

  it('keeps the latest update for the same artifact id', () => {
    const data = {
      chat_messages: [
        {
          sender: 'assistant',
          content: [
            {
              type: 'tool_use',
              name: 'artifacts',
              input: {
                id: 'art-1',
                command: 'create',
                title: 'Notes',
                type: 'text/markdown',
                content: 'v1',
              },
            },
          ],
        },
        {
          sender: 'assistant',
          content: [
            {
              type: 'tool_use',
              name: 'artifacts',
              input: {
                id: 'art-1',
                command: 'update',
                title: 'Notes',
                type: 'text/markdown',
                content: 'v2 final',
              },
            },
          ],
        },
      ],
    };

    const assets = extractClaudeAssets('chat-1', data);
    expect(assets).toHaveLength(1);
    expect(assets[0]?.text).toBe('v2 final');
  });

  it('collapses same filename from different artifact ids', () => {
    const data = {
      chat_messages: [
        {
          sender: 'assistant',
          content: [
            {
              type: 'tool_use',
              name: 'artifacts',
              input: {
                id: 'art-a',
                command: 'create',
                title: 'scout-india-negotiation',
                type: 'text/html',
                language: 'html',
                content: '<html>v1</html>',
              },
            },
          ],
        },
        {
          sender: 'assistant',
          content: [
            {
              type: 'tool_use',
              name: 'artifacts',
              input: {
                id: 'art-b',
                command: 'create',
                title: 'scout-india-negotiation',
                type: 'text/html',
                language: 'html',
                content: '<html>v2 longer content wins</html>',
              },
            },
          ],
        },
      ],
    };

    const assets = extractClaudeAssets('chat-1', data);
    expect(assets).toHaveLength(1);
    expect(assets[0]?.filename.toLowerCase()).toContain('scout-india-negotiation');
    expect(assets[0]?.text).toContain('v2 longer');
  });

  it('captures attachment extracted text and create_file content', () => {
    const data = {
      chat_messages: [
        {
          sender: 'human',
          attachments: [
            {
              id: 'a1',
              file_name: 'brief.pdf',
              file_type: 'application/pdf',
              extracted_content: 'brief body',
            },
          ],
          content: [],
        },
        {
          sender: 'assistant',
          content: [
            {
              type: 'tool_use',
              name: 'create_file',
              input: {
                path: '/mnt/user-data/outputs/report.py',
                content: 'print("hi")\n',
              },
            },
          ],
        },
      ],
    };

    const assets = extractClaudeAssets('chat-1', data);
    expect(assets.some((a) => a.filename === 'brief.pdf.txt' || a.filename.startsWith('brief'))).toBe(
      true,
    );
    expect(assets.some((a) => a.filename === 'report.py' && a.text?.includes('print'))).toBe(true);
  });
});

describe('extractChatGPTAssets', () => {
  it('resolves image_asset_pointer file ids to download urls', () => {
    const data = {
      mapping: {
        n1: {
          message: {
            author: { role: 'assistant' },
            content: {
              content_type: 'multimodal_text',
              parts: [
                {
                  content_type: 'image_asset_pointer',
                  asset_pointer: 'file-service://file-ABC123xyz',
                  width: 1024,
                  height: 1024,
                },
              ],
            },
          },
        },
      },
    };

    const assets = extractChatGPTAssets('c1', data);
    expect(assets).toHaveLength(1);
    expect(assets[0]?.kind).toBe('image');
    expect(assets[0]?.source).toContain('/backend-api/files/file-ABC123xyz/download');
    expect(assets[0]?.filename).toContain('1024x1024');
  });

  it('extracts long fenced code blocks as code assets', () => {
    const long = 'x'.repeat(450);
    const data = {
      mapping: {
        n1: {
          message: {
            author: { role: 'assistant' },
            content: {
              content_type: 'text',
              parts: [`here\n\`\`\`python\n${long}\n\`\`\`\n`],
            },
          },
        },
      },
    };

    const assets = extractChatGPTAssets('c1', data);
    expect(assets.some((a) => a.kind === 'code' && a.filename.endsWith('.py'))).toBe(true);
  });

  it('reads metadata attachments', () => {
    const data = {
      mapping: {
        n1: {
          message: {
            author: { role: 'user' },
            content: { content_type: 'text', parts: ['see file'] },
            metadata: {
              attachments: [{ id: 'file-ATT1', name: 'notes.docx', mime_type: 'application/docx' }],
            },
          },
        },
      },
    };

    const assets = extractChatGPTAssets('c1', data);
    expect(assets[0]).toMatchObject({
      kind: 'document',
      filename: 'notes.docx',
      source: expect.stringContaining('file-ATT1'),
    });
  });
});

describe('extractGeminiAssetsFromDOM', () => {
  it('collects generated-looking images and download links', () => {
    document.body.innerHTML = `
      <img src="https://lh3.googleusercontent.com/abc" alt="sunset beach" width="400" height="300" />
      <img src="data:image/svg+xml,<svg></svg>" alt="icon" />
      <a href="https://storage.googleapis.com/x/file.pdf" download="report.pdf">dl</a>
    `;
    // jsdom images report 0 natural size — still include googleusercontent urls
    const assets = extractGeminiAssetsFromDOM('g1', document);
    expect(assets.some((a) => a.kind === 'image' && a.source.includes('googleusercontent'))).toBe(
      true,
    );
    expect(assets.some((a) => a.filename === 'report.pdf')).toBe(true);
  });
});

describe('filename helpers', () => {
  it('sanitizes and ensures extensions', () => {
    expect(safeFilename('a/b:c?.md')).toBe('a-b-c-.md');
    expect(ensureExtension('notes', 'md')).toBe('notes.md');
    expect(ensureExtension('notes.md', 'md')).toBe('notes.md');
  });
});
