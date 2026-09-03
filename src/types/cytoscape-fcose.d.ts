/**
 * `cytoscape-fcose` ships no types.
 *
 * It is registered once through `cytoscape.use()` and never called directly, so a layout
 * extension is all the surface that needs declaring.
 */
declare module 'cytoscape-fcose' {
  import type { Ext } from 'cytoscape';
  const fcose: Ext;
  export default fcose;
}
