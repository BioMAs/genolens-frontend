import ProjectNav from '@/components/project/ProjectNav';

/**
 * Le layout des routes d'un projet : la barre du projet au-dessus de la page.
 *
 * Composant serveur : il ne fait que lire l'id (en Next 16, `params` est une
 * promesse) et le passer a `ProjectNav`. C'est `ProjectNav`, client, qui lit
 * l'URL et se rend invisible hors des routes de projet — le layout, lui, ne sait
 * pas sur quelle sous-route il est. Un layout persiste d'une page a l'autre : la
 * barre ne se remonte pas quand on change d'onglet.
 */
export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <>
      <ProjectNav projectId={id} />
      {children}
    </>
  );
}
