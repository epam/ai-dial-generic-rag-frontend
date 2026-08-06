import {
  AllCommunityModule,
  colorSchemeDark,
  ModuleRegistry,
  themeBalham,
} from 'ag-grid-community';

// ag-grid (v33+) requires modules to be registered once before any grid renders. The ui-kit's
// DialGrid used to do this internally; using ag-grid directly, we register the full community
// feature set ourselves (covers the Infinite Row Model, text filters, tooltips, auto-size, etc.).
ModuleRegistry.registerModules([AllCommunityModule]);

/**
 * DIAL dark theme for ag-grid, reproducing the look DialGrid applied. Values are
 * `var(--token, #fallback)` strings, so the grid uses the live DIAL theme variables when embedded
 * in DIAL Admin and the dark fallbacks standalone. This is the ag-grid Theming API — do NOT also
 * import the legacy `ag-grid-community/styles/*.css` (mixing the two triggers ag-grid error #239).
 */
export const dialGridTheme = themeBalham.withPart(colorSchemeDark).withParams({
  accentColor: 'var(--controls-bg-accent, #5C8DEA)',
  backgroundColor: 'var(--bg-layer-3, #1D2439)',
  oddRowBackgroundColor: 'var(--bg-layer-2, #161B2D)',
  selectedRowBackgroundColor: 'var(--bg-accent-primary-alpha, #7DA4FF26)',
  borderColor: 'var(--bg-layer-4, #242C42)',
  rowBorder: '1px solid var(--stroke-tertiary, #0C101D)',
  rowHoverColor: 'var(--bg-accent-primary-alpha, #7DA4FF26)',
  chromeBackgroundColor: 'var(--bg-layer-1, #0C101D)',
  foregroundColor: 'var(--text-primary, #EEF1F7)',
  headerTextColor: 'var(--text-secondary, #7F8792)',
  fontFamily: 'var(--theme-font, var(--font-inter))',
  borderRadius: 3,
  wrapperBorderRadius: 3,
  browserColorScheme: 'dark',
  spacing: 4,
  fontSize: 14,
  headerFontSize: 14,
  headerFontWeight: 600,
});
