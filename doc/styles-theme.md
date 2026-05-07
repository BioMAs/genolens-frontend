# Styles & Thème - GenoLens Frontend

## Vue d'ensemble

Le design system GenoLens (SciLicium) utilise **Tailwind CSS v4** avec des variables CSS custom pour le theming light/dark. Les couleurs brand sont définies dans `globals.css`.

---

## Design Tokens

### Couleurs Brand SciLicium

| Token | Light Mode | Dark Mode | Usage |
|---|---|---|---|
| `--sl-teal` | `#42e2ba` | `#42e2ba` (static) | Couleur principale, accents |
| `--sl-teal-dark` | `#34b596` | `#34b596` | Boutons hover, liens |
| `--sl-teal-light` | `#edfaf6` | `rgba(66, 226, 186, 0.09)` | Backgrounds subtils |
| `--sl-teal-muted` | `#c8f0e5` | `rgba(66, 226, 186, 0.14)` | Borders, outlines |
| `--sl-purple` | `#5d5892` | `#5d5892` (static) | Couleur secondaire |
| `--sl-purple-dark` | `#4a4576` | `#4a4576` | Hover purple |
| `--sl-purple-light` | `#f0eff8` | `rgba(93, 88, 146, 0.12)` | Backgrounds subtils |
| `--sl-red` | `#ff5f5f` | `#ff5f5f` (static) | Erreurs, négatif |
| `--sl-red-light` | `#fff2f2` | `rgba(255, 95, 95, 0.09)` | Backgrounds erreur |

### Échelle Neutre

```css
:root {
  --n-0:   #ffffff;   /* Blanc pur */
  --n-25:  #fafafa;
  --n-50:  #f6f7f8;
  --n-100: #edf0f3;
  --n-200: #dde2e8;
  --n-300: #c5cdd8;
  --n-400: #9baab8;
  --n-500: #6b7a8d;
  --n-600: #4a5568;
  --n-700: #2d3748;
  --n-800: #1a202c;   /* Texte principal light */
  --n-900: #0f1117;    /* Noir */
}

.dark {
  --n-0:   #0c1018;   /* Fond dark */
  --n-25:  #131720;
  --n-50:  #1a1f2e;
  --n-100: #222838;
  --n-200: #2d3550;
}
```

### Sémantique (Light Mode)

| Token | Valeur | Usage |
|---|---|---|
| `--background` | `var(--n-0)` | Fond de page |
| `--text-primary` | `var(--n-800)` | Texte principal |
| `--text-secondary` | `var(--n-500)` | Texte secondaire |
| `--text-muted` | `var(--n-400)` | Texte discret |
| `--border` | `var(--n-200)` | Borders principales |
| `--border-subtle` | `var(--n-100)` | Borders subtiles |
| `--surface` | `var(--n-0)` | Fond des cartes/surfaces |
| `--surface-secondary` | `var(--n-50)` | Surfaces secondaires |
| `--hover-overlay` | `var(--n-50)` | Hover states |

### Sémantique (Dark Mode)

| Token | Valeur | Usage |
|---|---|---|
| `--background` | `#0c1018` | Fond de page dark |
| `--text-primary` | `#dde4ee` | Texte principal |
| `--text-secondary` | `#8898ae` | Texte secondaire |
| `--border` | `#1f2840` | Borders principales |
| `--surface` | `#131720` | Fond des cartes/surfaces |

---

## Tailwind CSS v4 - Configuration

### Registration des tokens (`globals.css`)

```css
@theme inline {
  /* Fonts */
  --font-sans:    var(--font-dm-sans);
  --font-display: var(--font-syne);
  --font-mono:    var(--font-geist-mono);

  /* Brand colors */
  --color-brand-teal:         var(--sl-teal);
  --color-brand-teal-dark:    var(--sl-teal-dark);
  --color-brand-teal-light:   var(--sl-teal-light);
  --color-brand-purple:       var(--sl-purple);
  --color-brand-red:          var(--sl-red);

  /* Semantic aliases */
  --color-surface:            var(--surface);
  --color-app-bg:             var(--app-bg);
}
```

### Utilisation dans les composants

```tsx
// Couleurs brand
<div className="text-brand-teal">Texte teal</div>
<button className="bg-brand-purple hover:bg-brand-purple-dark">
  Bouton purple
</button>

// Surfaces et borders
<div className="bg-surface border-border rounded-lg">Carte</div>
<div className="bg-app-bg">Fond application</div>

// Textes sémantiques
<p className="text-text-primary">Texte principal</p>
<span className="text-text-secondary">Texte secondaire</span>
```

---

## Polices

### Configuration (`app/layout.tsx`)

```tsx
const syne = Syne({
  variable: '--font-syne',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});
```

### Usage par typographie

| Élément | Police | Taille | Poids |
|---|---|---|---|
| **Titres (page-title)** | Syne | 1.375rem | 700 |
| **Section labels** | Syne | 0.6875rem | 700 (uppercase) |
| **Stat values** | Syne | 1.75rem | 700 |
| **Body text** | DM Sans | 0.9375rem | 400 |
| **Gene symbols** | Geist Mono | 0.8125rem | 600 |
| **Code/monospace** | Geist Mono | — | — |

### Classes Tailwind

```tsx
// Titres
<h1 className="page-title">Titre de page</h1>

// Section labels
<span className="section-title">LABEL</span>

// Statistiques
<div className="stat-value">42</div>

// Gene symbols (biological entities)
<span className="gene-symbol">TP53</span>

// Significance indicators
<span className="sig-positive">+2.5</span>  // Teal = positif/enrichi
<span className="sig-negative">-1.8</span>  // Red = négatif/déplété
```

---

## Dark Mode

### Activation

Le dark mode est activé via la classe `.dark` sur le `<html>` ou `<body>` :

```tsx
// ThemeContext.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({ isDark: false, toggle: () => {} });

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false);
  
  useEffect(() => {
    // Vérifier la préférence système ou localStorage
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || 
        (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }
  }, []);
  
  const toggle = () => {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
    setIsDark(!isDark);
  };
  
  return (
    <ThemeContext.Provider value={{ isDark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
```

### Transitions

Les transitions sont définies dans `globals.css` :

```css
body {
  transition: background-color 0.2s ease, color 0.15s ease;
}
```

---

## Composants UI - Patterns

### Cards

```tsx
// Card standard
<div className="gl-card p-4">
  Contenu de la carte
</div>

// Card interactive (hover effect)
<div className="gl-card gl-card-interactive cursor-pointer">
  Carte cliquable avec hover teal
</div>
```

### Buttons

```tsx
// Bouton primary (teal)
<button className="bg-brand-teal text-white px-4 py-2 rounded-lg">
  Primary
</button>

// Bouton secondary (purple)
<button className="bg-brand-purple text-white px-4 py-2 rounded-lg">
  Secondary
</button>

// Bouton ghost/outline
<button className="border border-border hover:bg-hover-overlay px-4 py-2 rounded-lg">
  Ghost
</button>
```

### Status Indicators

```tsx
// Status dots
<span className="status-dot success" />   // Teal = succès
<span className="status-dot warning" />   // Amber = attention
<span className="status-dot error" />     // Red = erreur
<span className="status-dot pending" />   // Gray = en attente

// Badges de signification biologique
<span className="sig-positive">+2.5</span>  // Enrichi/up-regulated
<span className="sig-negative">-1.8</span>  // Déplété/down-regulated
```

---

## Layout - App Shell

### Structure

```css
.app-shell {
  display: flex;
  height: 100dvh;
  overflow: hidden;
}

.app-sidebar {
  width: var(--sidebar-width); /* 220px */
  background: var(--sidebar-bg);
  border-right: 1px solid var(--sidebar-border);
}

.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.app-topbar {
  height: var(--topbar-height); /* 52px */
  background: var(--topbar-bg);
  border-bottom: 1px solid var(--topbar-border);
}

.app-content {
  flex: 1;
  overflow-y: auto;
}
```

### Page Container

```tsx
<div className="page-container">
  {/* max-width: 1380px, padding: 1.75rem 1.5rem 3rem */}
  {children}
</div>
```

---

## Animations

### Keyframes (`globals.css`)

| Animation | Description | Durée |
|---|---|---|
| `fadeUp` | Fade in + slide up | 0.22s |
| `fadeIn` | Simple fade in | 0.18s |
| `slideInLeft` | Slide from left | 0.2s |
| `scaleIn` | Scale from 0.97 to 1 | 0.15s |
| `shimmer` | Skeleton loading | 1.6s infinite |

### Utilisation

```tsx
// Animations d'entrée
<div className="animate-fade-up">Contenu animé</div>
<div className="animate-fade-in">Fade in</div>
<div className="animate-slide-in">Slide from left</div>
<div className="animate-scale-in">Scale in</div>

// Skeleton loading
<div className="skeleton h-4 w-full" />
<div className="skeleton h-8 rounded-lg" />
```

---

## Plot Containers (Scientific Data)

### Style des plots

```tsx
<div className="plot-container">
  <h3 className="plot-title">Volcano Plot</h3>
  <p className="plot-subtitle">Log2FC vs -log10(p-value)</p>
  {/* Plot content */}
</div>
```

### Data Tables

```tsx
<table className="data-table">
  <thead>
    <tr>
      <th>Gene Symbol</th>
      <th>Log2FC</th>
      <th>P-value</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td className="gene-symbol">TP53</td>
      <td>+2.5</td>
      <td>1e-10</td>
    </tr>
  </tbody>
</table>
```

---

## Accessibilité

### Colorblind Toggle

Composant `ColorblindToggle` pour activer les palettes accessibles :

```tsx
import { ColorblindToggle } from '@/components/ui/ColorblindToggle';

<ColorblindToggle 
  isColorblindFriendly={isColorblind} 
  onToggle={(val) => setIsColorblind(val)} 
/>
```

### Focus Visible

```css
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--background), 0 0 0 4px var(--sl-teal);
}
```

### Selection

```css
::selection {
  background: rgba(66, 226, 186, 0.22);
  color: var(--text-primary);
}
```

---

## Scrollbars Custom

```css
::-webkit-scrollbar        { width: 5px; height: 5px; }
::-webkit-scrollbar-track  { background: transparent; }
::-webkit-scrollbar-thumb  {
  background: var(--n-300);
  border-radius: 99px;
}
.dark ::-webkit-scrollbar-thumb { background: var(--n-200); }
```

---

## Ajout d'une nouvelle couleur

### Étape 1 - Ajouter les variables CSS

```css
/* Dans globals.css, section :root */
--sl-new-color:    #xxxxxx;
--sl-new-color-dark:   #xxxxxx;
--sl-new-color-light:  #xxxxxx;
--sl-new-color-muted:  rgba(xxx, xxx, xxx, xx);

/* Dark mode overrides */
.dark {
  --sl-new-color-light:  rgba(xxx, xxx, xxx, xx);
  --sl-new-color-muted:  rgba(xxx, xxx, xxx, xx);
}
```

### Étape 2 - Register dans Tailwind @theme

```css
@theme inline {
  --color-brand-new-color:      var(--sl-new-color);
  --color-brand-new-color-dark: var(--sl-new-color-dark);
  --color-brand-new-color-light: var(--sl-new-color-light);
}
```

### Étape 3 - Utiliser dans les composants

```tsx
<div className="text-brand-new-color">Texte</div>
<button className="bg-brand-new-color hover:bg-brand-new-color-dark">
  Bouton
</button>
```