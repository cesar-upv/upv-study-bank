import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { vi } from 'vitest';

HTMLElement.prototype.scrollIntoView = vi.fn();

vi.mock('@/infrastructure/content/bundled', async () => {
  const { libraryPackages } = await import('./fixtures/packages');
  return { loadBundledPackages: async () => libraryPackages };
});

// jsdom omits dialog APIs; actual modality, inertness and focus are covered in Chromium.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); };
}
