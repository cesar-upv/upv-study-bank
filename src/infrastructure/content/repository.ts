import { Subject, UnitManifest, UnitPackage, Lesson, Question, Answer } from '@/domain/content/types';
import { parseLessonMarkdown } from '@/domain/content/parser';
import { loadBundledPackages } from './bundled';
import { db, StoredPackage } from '@/infrastructure/persistence/db';

export class ContentRepository {
  private parsedLessonsCache = new Map<string, { source: UnitPackage['lessons']; lessons: Lesson[] }>();

  // Resolve module I/O before opening an IndexedDB write transaction.
  async prepareBundledContent(): Promise<void> { await loadBundledPackages(); }

  private cachePackageLessons(pkg: UnitPackage) {
    const key = `${pkg.subject.id}:${pkg.unit.id}`;
    const cached = this.parsedLessonsCache.get(key);
    if (cached && cached.source.length === pkg.lessons.length && cached.source.every((lesson, index) => lesson.path === pkg.lessons[index].path && lesson.markdown === pkg.lessons[index].markdown)) return cached.lessons;
    const lessons: Lesson[] = pkg.lessons.map((l) => parseLessonMarkdown(l.path, l.markdown));
    this.parsedLessonsCache.set(key, { source: pkg.lessons.map(({ path, markdown }) => ({ path, markdown })), lessons });
    return lessons;
  }

  async getAllPackages(): Promise<UnitPackage[]> {
    const packages = new Map((await loadBundledPackages()).map(pkg => [JSON.stringify([pkg.subject.id, pkg.unit.id]), pkg]));
    const stored = await db.importedPackages.toArray();
    for (const item of stored) {
      packages.set(JSON.stringify([item.subjectId, item.unitId]), item.pkg);
    }
    return [...packages.values()];
  }

  async getSubjects(): Promise<Subject[]> {
    const all = await this.getAllPackages();
    const map = new Map<string, Subject>();
    for (const pkg of all) {
      if (!map.has(pkg.subject.id)) {
        map.set(pkg.subject.id, {
          ...pkg.subject,
          unit_ids: [...pkg.subject.unit_ids],
        });
      } else {
        // Merge unit_ids
        const existing = map.get(pkg.subject.id)!;
        for (const uId of pkg.subject.unit_ids) {
          if (!existing.unit_ids.includes(uId)) {
            existing.unit_ids.push(uId);
          }
        }
      }
    }
    return Array.from(map.values());
  }

  async getSubject(subjectId: string): Promise<Subject | undefined> {
    const subjects = await this.getSubjects();
    return subjects.find((s) => s.id === subjectId);
  }

  async getUnitPackage(subjectId: string, unitId: string): Promise<UnitPackage | undefined> {
    const stored = await db.importedPackages.get(`${subjectId}:${unitId}`);
    if (stored) {
      return stored.pkg;
    }
    return (await loadBundledPackages()).find(pkg => pkg.subject.id === subjectId && pkg.unit.id === unitId);
  }

  async getUnit(subjectId: string, unitId: string): Promise<UnitManifest | undefined> {
    const pkg = await this.getUnitPackage(subjectId, unitId);
    return pkg?.unit;
  }

  async getLessons(subjectId: string, unitId: string): Promise<Lesson[]> {
    const pkg = await this.getUnitPackage(subjectId, unitId);
    if (!pkg) return [];
    return this.cachePackageLessons(pkg);
  }

  async getLesson(subjectId: string, unitId: string, topicId: string): Promise<Lesson | undefined> {
    const lessons = await this.getLessons(subjectId, unitId);
    return lessons.find((l) => l.frontmatter.topic_id === topicId);
  }

  async getQuestions(subjectId: string, unitId: string): Promise<Question[]> {
    const pkg = await this.getUnitPackage(subjectId, unitId);
    return pkg?.questions || [];
  }

  async getAnswers(subjectId: string, unitId: string): Promise<Answer[]> {
    const pkg = await this.getUnitPackage(subjectId, unitId);
    return pkg?.answers || [];
  }

  async saveImportedPackage(pkg: UnitPackage): Promise<void> {
    const { validateUnitPackage } = await import('@/domain/content/package-validator');
    const validation = validateUnitPackage(pkg);
    if (!validation.valid) throw new Error(validation.errors.map(e => `${e.path}: ${e.message}`).join('\n'));
    const validated = validation.data!;
    const id = `${validated.subject.id}:${validated.unit.id}`;
    await this.prepareBundledContent();
    // Keep the revision check and write in one transaction, including across tabs.
    await db.transaction('rw', db.importedPackages, async () => {
      const current = await this.getUnitPackage(validated.subject.id, validated.unit.id);
      if (current && validated.unit.revision < current.unit.revision) throw new Error('No se puede importar una revisión anterior a la instalada.');
      const stored: StoredPackage = {
        id,
        subjectId: validated.subject.id,
        unitId: validated.unit.id,
        pkg: validated,
        importedAt: new Date().toISOString(),
      };
      await db.importedPackages.put(stored);
    });
    this.parsedLessonsCache.delete(id);
  }

  async deleteImportedPackage(subjectId: string, unitId: string): Promise<void> {
    const id = `${subjectId}:${unitId}`;
    await db.importedPackages.delete(id);
    this.parsedLessonsCache.delete(id);
  }
}

export const contentRepo = new ContentRepository();
