'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export interface ChatInitialContext {
  projectId: string;
  datasetId: string;
  comparisonName?: string | null;
}

interface ChatModeContextType {
  chatMode: boolean;
  initialContext: ChatInitialContext | null;
  toggleChatMode: () => void;
  setChatMode: (value: boolean) => void;
  /** Enter chat mode with a pre-selected project/dataset/comparison context. */
  openChatWith: (ctx: ChatInitialContext) => void;
}

const ChatModeContext = createContext<ChatModeContextType | undefined>(undefined);

const STORAGE_KEY = 'chatMode';

/**
 * Global "chat mode" toggle. When enabled, the whole app is replaced by a
 * full-screen ChatGPT-style assistant (see AppFrame). Persisted to localStorage,
 * mirroring ThemeContext.
 */
export function ChatModeProvider({ children }: { children: React.ReactNode }) {
  const [chatMode, setChatModeState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });
  const [initialContext, setInitialContext] = useState<ChatInitialContext | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, chatMode ? 'true' : 'false');
    }
  }, [chatMode]);

  const setChatMode = (value: boolean) => {
    setChatModeState(value);
    if (!value) setInitialContext(null);
  };
  const toggleChatMode = () => setChatModeState((v) => !v);
  const openChatWith = (ctx: ChatInitialContext) => {
    setInitialContext(ctx);
    setChatModeState(true);
  };

  return (
    <ChatModeContext.Provider
      value={{ chatMode, initialContext, toggleChatMode, setChatMode, openChatWith }}
    >
      {children}
    </ChatModeContext.Provider>
  );
}

export function useChatMode() {
  const context = useContext(ChatModeContext);
  if (context === undefined) {
    throw new Error('useChatMode must be used within a ChatModeProvider');
  }
  return context;
}
