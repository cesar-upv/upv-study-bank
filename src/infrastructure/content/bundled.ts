import type { UnitPackage } from '@/domain/content/types';

const modules = import.meta.glob('../../../content/*.unit-package.json', { import: 'default' });
let pending: Promise<UnitPackage[]> | undefined;

export function loadBundledPackages(): Promise<UnitPackage[]> {
  if (!pending) {
    pending = (async () => {
      const entries = Object.entries(modules);
      if (!entries.length) return [];
      const { validateUnitPackage } = await import('@/domain/content/package-validator');
      return Promise.all(entries.map(async ([path, load]) => {
        const result = validateUnitPackage(await load());
        if (!result.valid || !result.data) throw new Error(`Paquete inválido ${path}: ${JSON.stringify(result.errors)}`);
        return result.data;
      }));
    })().catch(error => { pending = undefined; throw error; });
  }
  return pending;
}
