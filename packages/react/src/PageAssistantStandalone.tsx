import { forwardRef, useImperativeHandle } from 'react';
import type { PageAssistantAPI } from '@unopsitg/page-assistant-core';
import { usePageAssistantEngine, type PageAssistantEngineConfig } from './usePageAssistantEngine';
import { PageAssistantOverlay } from './PageAssistantOverlay';

export const PageAssistantStandalone = forwardRef<PageAssistantAPI, PageAssistantEngineConfig>(
  function PageAssistantStandalone(config, ref) {
    const engine = usePageAssistantEngine(config);
    useImperativeHandle(ref, () => engine.api, [engine.api]);
    return <PageAssistantOverlay {...engine} />;
  },
);
