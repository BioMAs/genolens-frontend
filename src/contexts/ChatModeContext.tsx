'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface ChatModeContextType {
  chatMode: boolean;
  toggleChatMode: () => void;
  setChatMode: (value: boolean) => void;
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, chatMode ? 'true' : 'false');
    }
  }, [chatMode]);

  const setChatMode = (value: boolean) => setChatModeState(value);
  const toggleChatMode = () => setChatModeState((v) => !v);

  return (
    <ChatModeContext.Provider value={{ chatMode, toggleChatMode, setChatMode }}>
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
