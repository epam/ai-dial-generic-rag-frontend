import { describe, expect, it } from 'vitest';

// Importing the module runs ModuleRegistry.registerModules(...) and builds the theme against real
// ag-grid; this smoke test fails if a theme param name or an ag-grid export is wrong.
import { dialGridTheme } from '@/components/grid/grid-theme';

describe('grid-theme', () => {
  it('builds the DIAL ag-grid theme and registers modules without throwing', () => {
    expect(dialGridTheme).toBeDefined();
  });
});
