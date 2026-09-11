import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Garde de géométrie.
 *
 * Douze rayons, six hauteurs de contrôle et un rythme vertical sans pas
 * régulier ne sont pas apparus d'un coup : ils se sont accumulés une classe à
 * la fois, chacune défendable seule. Un codemod les ramène à quatre, trois et
 * sept — et rien n'empêche la dérive de recommencer dès le prochain écran.
 *
 * Ce test est ce qui l'empêche. Il est volontairement bête et rapide : un glob,
 * une expression régulière, une liste d'exceptions EXPLICITE. Une exception
 * ajoutée est un choix visible en revue, pas une érosion silencieuse.
 */

/** `readdirSync` recursif plutot que `globSync` : ce dernier existe a
 *  l'execution mais n'est pas declare dans les types de node:fs. */
const SOURCES: string[] = readdirSync('src', { recursive: true, encoding: 'utf8' })
  .map((f) => join('src', f))
  .filter((f) => f.endsWith('.tsx') && !f.includes('__tests__') && !f.endsWith('.test.tsx'));

/**
 * La portée `.auth-scope` a sa propre palette et sa propre géométrie, pour des
 * raisons documentées dans globals.css. Elle ne participe pas au système.
 */
const AUTH_SCOPE = /\/(auth)\/|^src\/app\/page\.tsx$/;

/**
 * Écrans de DONNÉES. Le rythme y reste serré à dessein : gonfler l'espacement
 * dans un tableau de gènes coûte des lignes visibles, ce qui contredit la
 * décision « chrome aérée, donnée dense ».
 */
const DATA_REGIME = [
  'DEGTable', 'GSEATable', 'GOEnrichmentTable', 'MethodStatsPanel',
  'SampleStatsTable', 'MetadataTable', 'ContrastScatter', 'SignatureScorePanel',
  'MultiComparisonVenn', 'DatasetExplorer', 'StringEnrichmentPanel',
  'AllComparisonsView', 'PPINetworkSection',
  '/comparison/explorer/', '/components/admin/', '/tools/dd/',
];

const isAuth = (f: string) => AUTH_SCOPE.test(f);
const isData = (f: string) => DATA_REGIME.some((frag) => f.includes(frag));

/**
 * Les attributs `className` d'un fichier, commentaires retirés.
 *
 * Le retrait des commentaires n'est pas cosmétique : un `className={cn(…)}`
 * peut contenir un commentaire expliquant précisément quelle classe a été
 * remplacée — et ce commentaire cite forcément la classe bannie. Sans ce
 * filtre, documenter une correction la ferait échouer.
 */
function attributes(source: string): string[] {
  return (source.match(/className=(?:"[^"]*"|\{`[^`]*`\}|\{[^{}]*\})/g) ?? []).map((attr) =>
    attr.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, ''),
  );
}

/** Les occurrences d'un motif dans les attributs className d'un fichier. */
function offenders(pattern: RegExp, filter: (f: string) => boolean) {
  const found: string[] = [];
  for (const file of SOURCES) {
    if (!filter(file)) continue;
    const source = readFileSync(file, 'utf8');
    for (const attr of attributes(source)) {
      for (const hit of attr.match(pattern) ?? []) {
        found.push(`${file}: ${hit}`);
      }
    }
  }
  return found;
}

describe('rayons — quatre, concentriques', () => {
  // sm 6 < control 10 < card 16 < pill. L'ensemble est dérivable : extérieur
  // moins retrait égale intérieur.
  it("n'utilise plus l'échelle de rayons de Tailwind", () => {
    const hits = offenders(
      /\brounded(?:-[trbl]{1,2})?-(?:md|lg|xl|2xl|3xl|full)\b/g,
      (f) => !isAuth(f),
    );
    expect(hits).toEqual([]);
  });

  it("n'utilise plus de rayon arbitraire", () => {
    const hits = offenders(/\brounded(?:-[trbl]{1,2})?-\[[^\]]+\]/g, (f) => !isAuth(f));
    expect(hits).toEqual([]);
  });
});

describe('hauteurs de contrôle — trois', () => {
  // 28 / 36 / 44. La dernière est aussi le minimum tactile.
  it("n'utilise plus de hauteur hors échelle sur un contrôle", () => {
    const hits: string[] = [];
    for (const file of SOURCES) {
      if (isAuth(file)) continue;
      const source = readFileSync(file, 'utf8');
      // Seuls les fichiers qui portent un contrôle sont concernés : `h-8` sert
      // aussi aux avatars et aux tuiles d'icône, où la hauteur ne dit rien
      // d'un contrôle.
      if (!/<(?:button|input|select|textarea)\b/.test(source)) continue;
      for (const attr of attributes(source)) {
        // Une hauteur égale à une largeur est une tuile carrée, pas un contrôle.
        if (/\bh-(\d+)\b[^"`]*\bw-\1\b|\bw-(\d+)\b[^"`]*\bh-\2\b/.test(attr)) continue;
        for (const hit of attr.match(/\bh-(?:8|10|12)\b/g) ?? []) {
          hits.push(`${file}: ${hit}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});

describe('rythme vertical — sept valeurs', () => {
  // 1 2 3 4 6 8 12. Les demi-pas sont la signature d'un réglage à la main.
  it("n'utilise plus de demi-pas d'espacement dans la chrome", () => {
    const hits = offenders(
      /\b-?(?:gap|gap-x|gap-y|space-x|space-y|mb|mt|ml|mr)-(?:0\.5|1\.5|2\.5|3\.5|5|7|9|10|11)\b/g,
      (f) => !isAuth(f) && !isData(f),
    );
    expect(hits).toEqual([]);
  });
});

describe('palette', () => {
  it("n'utilise plus l'échelle de gris de Tailwind dans la chrome", () => {
    // Le reste appartient à la pile de revue explicite de l'itération 1
    // (bg-gray-200 sur des pistes de jauge, text-gray-300 déjà clair-sur-sombre).
    const hits = offenders(
      /\b(?:text|border|divide|ring)-gray-(?:400|500|600|700|800|900)\b/g,
      (f) => !isAuth(f),
    );
    expect(hits).toEqual([]);
  });

  it("n'utilise plus indigo, purple ni violet comme couleur de chrome", () => {
    // Un seul accent interactif. Ces teintes ne subsistent que dans les
    // fichiers de graphiques, où elles sont de la DONNÉE.
    const hits = offenders(
      /\b(?:text|bg|border|ring)-(?:indigo|purple|violet)-\d{2,3}\b/g,
      (f) => !isAuth(f) && !/Plot|Chart|Graph|Viz|Radar|Scatter|Heatmap/.test(f),
    );
    expect(hits).toEqual([]);
  });
});
