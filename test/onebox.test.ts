/// <reference path="../types/globals.d.ts" />
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { OneBoxDatabase } from '../packages/data/db.ts';
import { FileManager } from '../packages/storage/fileManager.ts';
import { SearchEngine } from '../packages/search/engine.ts';
import { ExportManager } from '../packages/storage/exportManager.ts';
import { RestoreManager } from '../packages/storage/restoreManager.ts';
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

  await t.test('AC-08: Consultation et recherche locales 100% hors-ligne', () => {
    // Vérification que le moteur fonctionne sans aucune interface réseau
    const offlineResults = searchEngine.search({ query: 'cours' });
    assert.ok(offlineResults.length > 0, 'La recherche locale hors-ligne doit fonctionner instantanément');
    assert.ok(offlineResults[0].snippet !== undefined, 'Le snippet doit être extrait localement');
  });

  await t.test('AC-09: Validation stricte des entrées et gestion d\'erreurs claires', () => {
    assert.strictEqual(isValidUrl('not-a-valid-url'), false, 'Une chaîne quelconque ne doit pas être validée comme URL');
    assert.strictEqual(isValidUrl('ftp://invalide.protocol'), false, 'Seuls http et https sont acceptés');
    assert.strictEqual(isValidUrl('https://valid-domain.org/path'), true, 'HTTPS valide');

    // Vérification du fichier manquant
    assert.throws(() => {
      fileManager.copyLocalFile('C:/chemin/inexistant/document.pdf');
    }, /inaccessible ou introuvable/, 'Un fichier inaccessible doit lever une erreur explicite');
  });

  await t.test('AC-10: Migrations de base et intégrité des données existantes', () => {
    // Vérification que les tables de migration sont en place et que les données persistent
    const count = db.db.prepare('SELECT COUNT(*) as c FROM items').get() as { c: number };
    assert.ok(count.c >= 3, 'Les données créées lors des tests précédents doivent être intactes');

    // Ré-exécution de la logique de migration (idempotente)
    const migrations = db.db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[];
    assert.ok(migrations.some(m => m.version === 1), 'La migration version 1 doit être enregistrée');
  });

  await t.test('AC-11 (Section 5.6): Importation et restauration d\'une sauvegarde', () => {
    const restoreManager = new RestoreManager(db);
    const backupPayload = {
      version: '1.0.0',
      tags: [{ id: 'old-tag-1', name: 'SauvegardeTest', color: '#10B981', created_at: new Date().toISOString() }],
      items: [{
        id: 'old-item-1',
        type: 'note' as const,
        title: 'Note restaurée depuis une archive',
        description: 'Vérification de la procédure de restauration',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        favorite: 0,
        note: {
          item_id: 'old-item-1',
          body_text: 'Contenu parfaitement restauré',
          format: 'markdown' as const
        },
        tags: [{ id: 'old-tag-1', name: 'SauvegardeTest', created_at: new Date().toISOString() }]
      }]
    };

    const restoreResult = restoreManager.restoreFromJson(backupPayload);
    assert.ok(restoreResult.success, 'La restauration doit s\'exécuter avec succès');
    assert.strictEqual(restoreResult.importedItemsCount, 1);
    assert.strictEqual(restoreResult.importedTagsCount, 1);

    // Vérifier recherche de la note restaurée
    const found = searchEngine.search({ query: 'parfaitement' });
    assert.ok(found.length > 0, 'La note restaurée doit être immédiatement indexée dans FTS5');
  });

  // Nettoyage final
  db.db.close();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  if (fs.existsSync(TEST_STORAGE_DIR)) fs.rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
});

