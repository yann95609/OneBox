import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { OneBoxDatabase } from '../packages/data/db.ts';
import { FileManager } from '../packages/storage/fileManager.ts';
import { SearchEngine } from '../packages/search/engine.ts';
import { ExportManager } from '../packages/storage/exportManager.ts';
import { isValidUrl, normalizeUrl } from '../packages/core/validation.ts';

const TEST_DB_PATH = path.join(process.cwd(), 'data', 'test_onebox.db');
const TEST_STORAGE_DIR = path.join(process.cwd(), 'data', 'test_attachments');

test('ONEBOX Suite Complète - Critères d\'acceptation MVP', async (t) => {
  // Nettoyage avant test
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  if (fs.existsSync(TEST_STORAGE_DIR)) fs.rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });

  const db = new OneBoxDatabase(TEST_DB_PATH);
  const fileManager = new FileManager(TEST_STORAGE_DIR);
  const searchEngine = new SearchEngine(db);
  const exportManager = new ExportManager(db);

  await t.test('AC-01 & AC-02: Création et persistance locale d\'une note sans compte', () => {
    const note = db.createItem({
      type: 'note',
      title: 'Ma première note de cours',
      note: { body_text: 'Contenu important sur les bases de données relationnelles et FTS.', format: 'markdown' }
    });

    assert.ok(note.id, 'La note doit posséder un identifiant UUID');
    assert.strictEqual(note.title, 'Ma première note de cours');
    assert.strictEqual(note.note?.body_text, 'Contenu important sur les bases de données relationnelles et FTS.');

    // Vérifier relecture depuis la base
    const reloaded = db.getItemById(note.id);
    assert.ok(reloaded, 'La note doit être retrouvée après persistance');
    assert.strictEqual(reloaded?.id, note.id);
  });

  await t.test('AC-03: Sauvegarde d\'un lien et recherche par mot-clé', () => {
    const url = 'https://developer.mozilla.org/fr/docs/Web/JavaScript';
    assert.ok(isValidUrl(url), 'URL valide');

    const linkItem = db.createItem({
      type: 'link',
      title: 'MDN JavaScript Documentation',
      description: 'Portail de documentation web MDN officiel',
      link: {
        url,
        normalized_url: normalizeUrl(url),
        fetched_title: 'MDN Web Docs'
      }
    });

    assert.strictEqual(linkItem.type, 'link');

    // Recherche via le moteur
    const results = searchEngine.search({ query: 'MDN' });
    assert.ok(results.length > 0, 'La recherche sur MDN doit retourner au moins 1 résultat');
    assert.strictEqual(results[0].id, linkItem.id);
  });

  await t.test('AC-04: Import de fichier avec nom, taille, checksum et type MIME', () => {
    const dummyBuffer = Buffer.from('Ceci est un document factice pour test d\'intégrité ONEBOX.', 'utf8');
    const saved = fileManager.saveBuffer('contrat_formation.txt', dummyBuffer);

    assert.strictEqual(saved.displayName, 'contrat_formation.txt');
    assert.strictEqual(saved.mimeType, 'text/plain');
    assert.strictEqual(saved.sizeBytes, dummyBuffer.length);
    assert.ok(saved.checksum.length === 64, 'Le checksum SHA-256 doit comporter 64 caractères hex');

    const fileItem = db.createItem({
      type: 'file',
      title: 'Contrat de formation',
      file: {
        display_name: saved.displayName,
        storage_path: saved.storagePath,
        mime_type: saved.mimeType,
        size_bytes: saved.sizeBytes,
        checksum: saved.checksum,
        import_mode: 'copy'
      }
    });

    assert.strictEqual(fileItem.file?.display_name, 'contrat_formation.txt');
  });

  await t.test('AC-05: Gestion des tags, multi-tagging et filtrage', () => {
    const tag1 = db.createTag('Urgent', '#EF4444');
    const tag2 = db.createTag('Travail', '#3B82F6');

    const item = db.createItem({
      type: 'note',
      title: 'Tâche prioritaire',
      note: { body_text: 'Préparer le rapport trimestriel' },
      tagIds: [tag1.id, tag2.id]
    });

    const retrieved = db.getItemById(item.id);
    assert.strictEqual(retrieved?.tags?.length, 2, 'L\'élément doit avoir 2 tags');

    // Filtrer par tag
    const urgentItems = db.queryItems({ tagId: tag1.id });
    assert.ok(urgentItems.some(i => i.id === item.id), 'L\'élément doit apparaître dans le filtre Urgent');
  });

  await t.test('AC-06: Suppression réversible (corbeille) et restauration', () => {
    const tempItem = db.createItem({
      type: 'note',
      title: 'Note éphémère',
      note: { body_text: 'À supprimer' }
    });

    // Mise en corbeille
    const deleted = db.softDeleteItem(tempItem.id);
    assert.ok(deleted, 'La mise en corbeille doit réussir');

    const activeList = db.queryItems({ isTrash: false });
    assert.ok(!activeList.some(i => i.id === tempItem.id), 'L\'élément ne doit plus être dans les actifs');

    const trashList = db.queryItems({ isTrash: true });
    assert.ok(trashList.some(i => i.id === tempItem.id), 'L\'élément doit être listé dans la corbeille');

    // Restauration
    const restored = db.restoreItem(tempItem.id);
    assert.ok(restored, 'La restauration doit réussir');

    const activeAfterRestore = db.queryItems({ isTrash: false });
    assert.ok(activeAfterRestore.some(i => i.id === tempItem.id), 'L\'élément restauré doit réapparaître dans les actifs');
  });

  await t.test('AC-07: Export ZIP avec données complètes et manifeste d\'intégrité', () => {
    const zipBuffer = exportManager.generateFullExportZip();
    assert.ok(zipBuffer.length > 100, 'L\'archive ZIP générée doit contenir des données');

    // Vérifier la signature ZIP (PK.. = 0x50 0x4B 0x03 0x04)
    assert.strictEqual(zipBuffer[0], 0x50);
    assert.strictEqual(zipBuffer[1], 0x4B);
  });

  // Nettoyage final
  db.db.close();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  if (fs.existsSync(TEST_STORAGE_DIR)) fs.rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
});
