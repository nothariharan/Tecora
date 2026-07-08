import type { Chat, HealthState, Message, Platform } from '@/src/core/types';

// shared contract for claude / chatgpt / gemini.
// adapters stay thin: read from intercepted json, act via the site's own ui.
// queueing, rate limits, safety gates live outside this interface.
export interface Adapter {
  id: Platform;
  matches(url: URL): boolean;

  capabilities: {
    archive: boolean;
    delete: boolean;
    rename: boolean;
    exportMessages: boolean;
  };

  listChats(): Promise<Chat[]>;
  getMessages(chatId: string): Promise<Message[]>;
  currentAccount(): Promise<string | null>;

  archive(chatId: string): Promise<void>;
  delete(chatId: string): Promise<void>;
  openChat(chatId: string): void;
  health(): Promise<HealthState>;
}
