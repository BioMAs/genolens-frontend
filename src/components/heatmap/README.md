# Heatmap Component - Documentation

## 📁 Structure modulaire

Le composant Heatmap a été complètement refactorisé dans `/frontend/src/components/heatmap/` avec une structure modulaire pour une meilleure maintenabilité et extensibilité.

```
frontend/src/components/heatmap/
├── index.ts                    # Point d'entrée - export le composant principal
├── types.ts                    # Types TypeScript et interfaces
├── heatmapConfig.ts            # Configurations et constantes
├── useHeatmapData.ts           # Custom hook pour la récupération des données
├── HeatmapPlot.tsx             # Composant principal (orchestrateur)
├── HeatmapControls.tsx         # Barre de contrôles et paramètres
├── HeatmapVisualization.tsx    # Rendu Plotly (heatmap + LogFC sidebar)
└── HeatmapModal.tsx            # Modal plein écran
```

## ✨ Nouvelles fonctionnalités

### 1. **Layout en pleine largeur**
- La heatmap occupe désormais toute la largeur disponible (au lieu de 50%)
- Hauteur fixe de **700px** garantit un affichage complet dans la card
- Volcano Plot déplacé en dessous pour maximiser l'espace de visualisation

### 2. **Contrôles améliorés**
- Interface intuitive avec dropdown pour sélectionner le nombre de gènes
- Panel de paramètres avancés collapsible :
  - Méthode de clustering (Ward, Complete, Average, Single)
  - Métrique de distance (Euclidean, Correlation, Manhattan)
  - Options de clustering pour gènes et échantillons
- Descriptions contextuelles pour chaque option

### 3. **Mode plein écran**
- Bouton "Maximize2" dans les contrôles
- Modal responsive avec hauteur adaptative (85% viewport height)
- Navigation au clavier (ESC pour fermer)
- Préservation de l'état des paramètres

### 4. **Export haute résolution**
- Bouton d'export avec menu déroulant (PNG/SVG)
- Résolution 3x pour PNG (équivalent 300 DPI)
- Dimensions optimisées : 1600×1050px
- Nommage automatique : `heatmap_[comparison]_[genes]_[date].[format]`

### 5. **Tooltips enrichis**
- Affichage complet au survol :
  - Nom du gène (gene_id)
  - Échantillon
  - Expression relative (normalisée)
  - LogFC du gène
  - padj (p-value ajustée)
- Format élégant avec style personnalisé

### 6. **Patterns d'expression visuels**
- Séparateur visuel entre gènes UP et DOWN (ligne pointillée)
- Annotations "UP" et "DOWN" sur les côtés
- Clustering séparé pour meilleure distinction des patterns
- Colorbar optimisée avec labels explicites

### 7. **Responsive design**
- Breakpoints adaptatifs :
  - Mobile (< 640px) : 500px hauteur
  - Tablette (640-1024px) : 600px hauteur
  - Desktop (> 1024px) : 700px hauteur
- Layout fluide avec overflow contrôlé

## 🎨 Corrections appliquées

### CSS invalides corrigés
- ❌ `min-h-125` → ✅ `h-125` (500px)
- ❌ `h-150` → ✅ `h-175` (700px)
- ❌ `flex-shrink-0` → ✅ `shrink-0`

### Dimensionnement Plotly
- Hauteur fixe ajoutée dans `layout.height`
- Marges optimisées pour labels complets
- Synchronisation parfaite entre main heatmap et LogFC sidebar

## 📊 Utilisation

### Import
```tsx
import HeatmapPlot from '@/components/heatmap';
```

### Props
```tsx
interface HeatmapPlotProps {
  degDataset: Dataset;           // Dataset des DEGs
  matrixDataset: Dataset;         // Dataset de la matrice d'expression
  sampleIds?: string[];           // IDs échantillons (optionnel)
  comparisonName?: string;        // Nom de la comparaison
}
```

### Exemple
```tsx
<HeatmapPlot
  degDataset={degDataset}
  matrixDataset={matrixDataset}
  sampleIds={relevantSamples}
  comparisonName="Treatment_vs_Control"
/>
```

## 🔧 Configuration

### Modifier les paramètres par défaut
Éditez `heatmapConfig.ts` :

```typescript
export const DEFAULT_HEATMAP_CONFIG: HeatmapConfig = {
  height: 700,                    // Hauteur en pixels
  mainMargin: { l: 120, r: 50, b: 150, t: 60 },
  colorscale: 'RdBu',            // Échelle de couleur
  zmin: -1,                       // Min expression normalisée
  zmax: 1,                        // Max expression normalisée
  // ...
};
```

### Ajouter des options Top N
Modifiez `TOP_N_OPTIONS` dans `heatmapConfig.ts` :

```typescript
export const TOP_N_OPTIONS: TopNOption[] = [
  { value: 50, label: 'Top 50 Genes', description: 'Rapide - Vue d\'ensemble' },
  // Ajoutez vos options...
];
```

## 🧪 Tests et validation

### Points de vérification
- [x] Affichage en 700px sans overflow
- [x] Mode plein écran fonctionnel
- [x] Export PNG/SVG avec les deux plots
- [x] Tooltips avec métadonnées complètes
- [x] Responsive sur mobile/tablette/desktop
- [x] Sélection des différents top N genes
- [x] Patterns UP/DOWN visuellement séparés

### Commandes de test
```bash
# Démarrer le serveur de développement
cd frontend
npm run dev

# Ouvrir la page de comparaison
# Naviguer vers : /projects/[id]/comparisons/[name]
```

## 📝 Notes techniques

### Performance
- Clustering backend évite le calcul client-side
- Hook personnalisé avec memoization
- Dynamic import de Plotly pour réduire le bundle
- Rendu conditionnel pour éviter les recalculs

### Architecture
- Séparation claire des responsabilités :
  - **HeatmapPlot** : Orchestration et état
  - **HeatmapControls** : UI des contrôles
  - **HeatmapVisualization** : Rendu Plotly pur
  - **HeatmapModal** : Gestion du modal
  - **useHeatmapData** : Logique métier et API
- Types TypeScript stricts pour type safety
- Configuration centralisée pour faciliter les modifications

### Dépendances
- `react-plotly.js` v2.6.0
- `plotly.js-dist-min` v3.3.1
- `lucide-react` (icons)
- Next.js 14+ (dynamic imports)

## 🔄 Migration depuis l'ancien composant

Les anciens fichiers ont été conservés en backup :
- `HeatmapPlot.tsx.backup`
- `HeatmapPlotMemo.tsx.backup`

Pour revenir à l'ancien composant (non recommandé) :
```bash
cd frontend/src/components
mv HeatmapPlot.tsx.backup HeatmapPlot.tsx
# Puis modifier l'import dans ComparisonDetail.tsx
```

## 🐛 Résolution de problèmes

### La heatmap ne s'affiche pas
- Vérifier que les datasets sont bien chargés
- Vérifier la console pour les erreurs API
- S'assurer que des DEGs significatifs existent (padj < 0.05)

### Export ne fonctionne pas
- Vérifier que Plotly est bien chargé (dynamic import)
- Ouvrir la console pour voir les erreurs
- S'assurer que le navigateur autorise le téléchargement

### Layout cassé
- Vérifier que Tailwind CSS est bien configuré
- S'assurer que les classes h-125, h-175 sont définies
- Vérifier les breakpoints responsive (sm:, lg:)

## 📚 Ressources

- [Plotly.js Documentation](https://plotly.com/javascript/)
- [React Plotly Documentation](https://plotly.com/javascript/react/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Next.js Dynamic Imports](https://nextjs.org/docs/advanced-features/dynamic-import)

---

**Dernière mise à jour :** 26 février 2026  
**Version :** 2.0.0  
**Auteur :** GenOLens Team
