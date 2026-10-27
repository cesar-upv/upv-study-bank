#!/usr/bin/env node
import { createServer } from 'vite';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { z } from 'zod';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { validateUnitPackage } = await server.ssrLoadModule('/src/domain/content/package-validator.ts');
  const { UnitPackageSchema, QuestionSchema } = await server.ssrLoadModule('/src/domain/content/types.ts');
  const { questionRegistry } = await server.ssrLoadModule('/src/domain/content/question-registry.ts');
  const schema = z.toJSONSchema(UnitPackageSchema);
  schema.$id = 'https://study-bank.local/schemas/unit-package.schema.json';
  schema.title = 'Banco de Estudio — unit-package v1';
  schema.properties.questions.items = { oneOf: Object.entries(questionRegistry).map(([type, contract]) => z.toJSONSchema(QuestionSchema.extend({ type: z.literal(type), payload: contract.payload }))) };
  if (process.argv.includes('--schema')) {
    await writeFile('content/unit-package.schema.json', JSON.stringify(schema, null, 2) + '\n');
    console.log('Esquema actualizado: content/unit-package.schema.json');
  } else {
    const paths = process.argv.slice(2);
    if (!paths.length) for (const dir of ['content', 'templates']) for (const file of await readdir(dir)) if (file.endsWith('.unit-package.json') || file === 'unit-package.json') paths.push(`${dir}/${file}`);
    for (const path of paths) {
      const raw = await readFile(path, 'utf8');
      const result = validateUnitPackage(JSON.parse(raw), raw);
      if (!result.valid) { console.error(path, result.errors); process.exitCode = 1; }
      else console.log(`✓ ${path}: ${result.data.questions.length} preguntas`);
    }
  }
} finally { await server.close(); }
