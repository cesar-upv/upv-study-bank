import { test as base, expect } from '@playwright/test';
import { libraryPackages } from '../fixtures/packages';

export const test = base.extend({
  page: async ({ page }, use) => {
    // The running dev server may include local courses; tests use synthetic data only.
    await page.route('**/src/infrastructure/content/bundled.ts*', route => route.fulfill({ contentType: 'application/javascript', body: 'export async function loadBundledPackages() { return []; }' }));
    await page.goto('/');
    await page.evaluate(async packages => {
      const path = '/src/infrastructure/persistence/db.ts';
      const { db } = await import(/* @vite-ignore */ path);
      await db.importedPackages.bulkPut(packages.map(pkg => ({ id: `${pkg.subject.id}:${pkg.unit.id}`, subjectId: pkg.subject.id, unitId: pkg.unit.id, pkg, importedAt: new Date().toISOString() })));
    }, libraryPackages);
    await use(page);
  },
});
export { expect };
export type { Page } from '@playwright/test';
