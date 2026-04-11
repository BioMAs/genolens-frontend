'use client';

import * as React from 'react';

/* ---------------------------------------------------------------
   Tabs — dependency-free, SciLicium-styled tab component.

   Usage:
     <Tabs value={tab} onValueChange={setTab}>
       <TabsList>
         <TabsTrigger value="overview">Overview</TabsTrigger>
         <TabsTrigger value="data">Data</TabsTrigger>
       </TabsList>
       <TabsContent value="overview">…</TabsContent>
       <TabsContent value="data">…</TabsContent>
     </Tabs>
--------------------------------------------------------------- */

interface TabsContextValue {
  value: string;
  onValueChange: (val: string) => void;
}

const TabsContext = React.createContext<TabsContextValue>({
  value: '',
  onValueChange: () => {},
});

// ── Root ──────────────────────────────────────────────────────

interface TabsProps {
  value: string;
  onValueChange: (val: string) => void;
  children: React.ReactNode;
  className?: string;
}

function Tabs({ value, onValueChange, children, className = '' }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

// ── List (the tab bar) ────────────────────────────────────────

interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

function TabsList({ children, className = '' }: TabsListProps) {
  return (
    <div
      role="tablist"
      className={`flex items-end gap-0.5 ${className}`}
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      {children}
    </div>
  );
}

// ── Trigger ───────────────────────────────────────────────────

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

function TabsTrigger({ value, children, className = '', disabled = false }: TabsTriggerProps) {
  const { value: activeValue, onValueChange } = React.useContext(TabsContext);
  const isActive = activeValue === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      disabled={disabled}
      onClick={() => !disabled && onValueChange(value)}
      className={[
        'relative px-4 pb-2.5 pt-2 text-sm font-medium transition-colors select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:rounded-t',
        'disabled:pointer-events-none disabled:opacity-40',
        isActive
          ? 'text-brand-teal-dark'
          : 'hover:text-[var(--text-primary)]',
        className,
      ].join(' ')}
      style={{
        color: isActive ? 'var(--sl-teal-dark)' : 'var(--text-secondary)',
      }}
    >
      {children}

      {/* Active indicator line */}
      <span
        className="absolute bottom-0 left-0 right-0 rounded-t-sm transition-all duration-200"
        style={{
          height: '2px',
          background: isActive ? 'var(--sl-teal)' : 'transparent',
        }}
      />
    </button>
  );
}

// ── Content ───────────────────────────────────────────────────

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

function TabsContent({ value, children, className = '' }: TabsContentProps) {
  const { value: activeValue } = React.useContext(TabsContext);
  if (activeValue !== value) return null;

  return (
    <div role="tabpanel" className={`animate-fade-up ${className}`}>
      {children}
    </div>
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
