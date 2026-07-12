import React, { createContext, useContext } from 'react';
import type { Chat } from '@/src/core/types';

// one exporter for the whole panel so progress/errors surface in a single place.
export interface ExportApi {
  busy: boolean;
  exportChats: (chats: Chat[], label: string, single?: boolean) => void | Promise<void>;
}

const ExportContext = createContext<ExportApi | null>(null);

export function ExportProvider({
  value,
  children,
}: {
  value: ExportApi;
  children: React.ReactNode;
}) {
  return <ExportContext.Provider value={value}>{children}</ExportContext.Provider>;
}

export function useExport(): ExportApi {
  const ctx = useContext(ExportContext);
  if (!ctx) throw new Error('useExport must be used within ExportProvider');
  return ctx;
}
