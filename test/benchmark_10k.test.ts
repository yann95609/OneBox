/// <reference path="../types/globals.d.ts" />
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { OneBoxDatabase } from '../packages/data/db.ts';
import { SearchEngine } from '../packages/search/engine.ts';

const BENCHMARK_DB_PATH = path.join(process.cwd(), 'data', 'bench_onebox.db');

test('Section 7 — Exigences Non Fonctionnelles & Benchmark Performance (10 000 éléments)', async (t) => {
  if (fs.existsSync(BENCHMARK_DB_PATH)) fs.unlinkSync(BENCHMARK_DB_PATH);

  const db = new OneBoxDatabase(BENCHMARK_DB_PATH);
  const searchEngine = new SearchEngine(db);

  await t.test('Génération et indexation en masse de 10 000 éléments', () => {
    const t0 = Date.now();

    // Insertion transactionnelle haute performance
    db.runTransaction(() => {
      const insertItem = db.db.prepare(`
        INSERT INTO items (id, type, title, description, created_at, updated_at, deleted_at, source, favorite)
        VALUES (?, 'note', ?, ?, ?, ?, NULL, 'benchmark', 0)
      `);
      const insertNote = db.db.prepare(`
        INSERT INTO note_contents (item_id, body_text, format)
        VALUES (?, ?, 'markdown')
      `);
      const insertFts = db.db.prepare(`
        INSERT INTO items_fts (item_id, title, description, body_text, tags)
        VALUES (?, ?, ?, ?, ?)
      `);

      const now = new Date().toISOString();
      for (let i = 1; i <= 10000; i++) {
        const id = `bench-item-${i}`;
        const title = i === 4242 ? 'Document confidentiel Projet Xylophone' : `Note d'archive n°${i} sur les bases de données`;
        const desc = `Description abrégée de l'archive technique numéro ${i}`;
        const body = i === 4242 ? 'Le projet secret Xylophone contient la clé cryptographique maîtresse.' : `Contenu textuel détaillé pour indexation de test ${i}. Analyse de performance SQLite WAL.`;
        const tags = i % 5 === 0 ? 'Important Projet' : 'Archive';

        insertItem.run(id, title, desc, now, now);
        insertNote.run(id, body);
        insertFts.run(id, title, desc, body, tags);
      }
    });

    const elapsed = Date.now() - t0;
    assert.ok(elapsed < 10000, `L'insertion de 10 000 éléments doit prendre moins de 10s (pris: ${elapsed}ms)`);
  });

  await t.test('Section 7 : Recherche médiane < 500 ms sur bibliothèque de 10 000 éléments', () => {
    // 1. Recherche par terme rare
    const tStart1 = performance.now();
    const resultsRare = searchEngine.search({ query: 'Xylophone' });
    const duration1 = performance.now() - tStart1;

    assert.strictEqual(resultsRare.length, 1, 'Le terme spécifique doit être retrouvé exactement 1 fois');
    assert.strictEqual(resultsRare[0].id, 'bench-item-4242');
    assert.ok(duration1 < 500, `La recherche doit prendre moins de 500ms (pris: ${duration1.toFixed(2)}ms)`);

    // 2. Recherche par terme fréquent (plusieurs centaines de résultats)
    const tStart2 = performance.now();
    const resultsCommon = searchEngine.search({ query: 'cryptographique' });
    const duration2 = performance.now() - tStart2;

    assert.ok(duration2 < 500, `La recherche doit prendre moins de 500ms (pris: ${duration2.toFixed(2)}ms)`);

    // 3. Mesure de 20 requêtes pour vérifier la médiane
    const queryTimes: number[] = [];
    const queries = ['archive', 'Projet', 'SQLite', 'performance', 'technique', 'Xylophone'];

    for (const q of queries) {
      const start = performance.now();
      searchEngine.search({ query: q });
      queryTimes.push(performance.now() - start);
    }

    queryTimes.sort((a, b) => a - b);
    const median = queryTimes[Math.floor(queryTimes.length / 2)];

    assert.ok(median < 500, `La médiane de recherche (${median.toFixed(2)}ms) doit être bien inférieure à la cible de 500ms`);
  });

  await t.test('Section 7 : Résilience et intégrité après fermeture', () => {
    db.db.close();
    // Réouverture pour vérifier persistance
    const reopenedDb = new OneBoxDatabase(BENCHMARK_DB_PATH);
    const countRow = reopenedDb.db.prepare('SELECT COUNT(*) as c FROM items').get() as { c: number };
    assert.strictEqual(countRow.c, 10000, 'Les 10 000 éléments doivent être intacts après réouverture');
    reopenedDb.db.close();
  });

  // Nettoyage final du benchmark
  if (fs.existsSync(BENCHMARK_DB_PATH)) fs.unlinkSync(BENCHMARK_DB_PATH);
  const shm = `${BENCHMARK_DB_PATH}-shm`;
  const wal = `${BENCHMARK_DB_PATH}-wal`;
  if (fs.existsSync(shm)) fs.unlinkSync(shm);
  if (fs.existsSync(wal)) fs.unlinkSync(wal);
});
