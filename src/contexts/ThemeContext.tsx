'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
} from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Thème résolu depuis les sources du navigateur.
 *
 * ⚠️ Cette règle est écrite DEUX fois, et c'est inévitable : le script inline
 * du layout (`src/app/layout.tsx`, `THEME_BOOT_SCRIPT`) doit l'appliquer avant
 * que React n'existe — il tourne dès l'analyse du document, en tête du
 * `<body>`, pour poser la classe `dark` avant le premier paint. Toute
 * modification ici doit être reportée là-bas, sinon la couleur affichée avant
 * l'hydratation cesse de correspondre à l'état de React.
 */
function resolveTheme(): Theme {
  const saved = localStorage.getItem('theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// ── Le thème comme source externe ───────────────────────────────────────────
//
// `localStorage` et `prefers-color-scheme` sont un état hors de React :
// `useSyncExternalStore` est fait pour ça, et c'est lui qui rend le premier
// rendu client identique à celui du serveur. Un `useState` initialisé depuis
// ces sources rendait « dark » au premier rendu client là où le serveur avait
// rendu « light », et React signalait l'écart d'hydratation sur le bouton de
// thème de la sidebar, sur chaque page authentifiée.

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  // Une préférence système qui change, ou un autre onglet qui bascule le
  // thème : les deux doivent se refléter ici.
  const onStorage = (event: StorageEvent) => {
    if (event.key === 'theme') onChange();
  };
  media.addEventListener('change', onChange);
  window.addEventListener('storage', onStorage);

  return () => {
    listeners.delete(onChange);
    media.removeEventListener('change', onChange);
    window.removeEventListener('storage', onStorage);
  };
}

/** Instantané servi au serveur ET au rendu d'hydratation : toujours le même. */
function getServerSnapshot(): Theme {
  return 'light';
}

/**
 * Fournisseur de thème.
 *
 * La couleur ne clignote pas malgré ce premier rendu en « light » : le script
 * inline du layout a déjà posé la classe `dark` avant le premier paint. Le
 * CSS ne connaît que cette classe (`globals.css` n'utilise aucun
 * `prefers-color-scheme`), donc le thème visible est correct dès la première
 * image, indépendamment de l'état de React.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, resolveTheme, getServerSnapshot);
  const firstSync = useRef(true);

  useEffect(() => {
    // La première passe est sautée : la classe vient du script inline, et le
    // rendu d'hydratation vaut encore « light ». L'écraser ici rendrait le
    // flash de thème clair que tout ce dispositif existe pour supprimer.
    if (firstSync.current) {
      firstSync.current = false;
      return;
    }
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    localStorage.setItem('theme', newTheme);
    // La classe est posée tout de suite, sans attendre un rendu : la bascule
    // doit être instantanée à l'œil.
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    emit();
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
