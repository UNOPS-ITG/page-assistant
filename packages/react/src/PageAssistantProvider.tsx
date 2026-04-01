import { createContext, useContext, type ReactNode } from 'react';
import type { PageAssistantAPI } from '@unopsitg/page-assistant-core';
import { usePageAssistantEngine, type PageAssistantEngineConfig } from './usePageAssistantEngine';
import { PageAssistantOverlay } from './PageAssistantOverlay';

const PageAssistantContext = createContext<PageAssistantAPI | null>(null);

export function usePageAssistant(): PageAssistantAPI {
  const ctx = useContext(PageAssistantContext);
  if (!ctx) {
    throw new Error('usePageAssistant must be used within PageAssistantProvider');
  }
  return ctx;
}

interface PageAssistantProviderProps extends PageAssistantEngineConfig {
  children: ReactNode;
}

export function PageAssistantProvider({ children, ...config }: PageAssistantProviderProps) {
  const engine = usePageAssistantEngine(config);
  return (
    <PageAssistantContext.Provider value={engine.api}>
      {children}
      <PageAssistantOverlay {...engine} />
    </PageAssistantContext.Provider>
  );
}
