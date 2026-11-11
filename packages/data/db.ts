import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { Item, NoteContent, LinkContent, FileAttachment, Tag, SearchQuery } from '../core/types.ts';
import { getUtcTimestamp } from '../core/validation.ts';

export class OneBoxDatabase {
  public db: DatabaseSync;

  constructor(dbPath?: string) {
    const finalPath = dbPath || path.join(process.cwd(), 'data', 'onebox.db');
    const dir = path.dirname(finalPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new DatabaseSync(finalPath);
    this.initPragmas();
    this.migrate();
  }

  private initPragmas() {
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA journal_mode = WAL;');
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const applied = this.db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[];
    const appliedVersions = new Set(applied.map(a => a.version));

    if (!appliedVersions.has(1)) {
      this.db.exec(`
        -- Table des éléments principaux
        CREATE TABLE IF NOT EXISTS items (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL CHECK(type IN ('note', 'link', 'file', 'image')),
          title TEXT NOT NULL,
          description TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          source TEXT,
          favorite INTEGER NOT NULL DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_items_deleted_at ON items(deleted_at);
        CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);

        -- Contenu des notes
        CREATE TABLE IF NOT EXISTS note_contents (
          item_id TEXT PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
          body_text TEXT NOT NULL,
          format TEXT NOT NULL DEFAULT 'plain' CHECK(format IN ('plain', 'markdown'))
        );

        -- Contenu des liens
        CREATE TABLE IF NOT EXISTS link_contents (
          item_id TEXT PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
          url TEXT NOT NULL,
          normalized_url TEXT NOT NULL,
          fetched_title TEXT,
          fetched_description TEXT,
          preview_image TEXT
        );

        -- Fichiers et images
        CREATE TABLE IF NOT EXISTS file_attachments (
          id TEXT PRIMARY KEY,
          item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
          display_name TEXT NOT NULL,
          storage_path TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          size_bytes INTEGER NOT NULL,
          checksum TEXT NOT NULL,
          import_mode TEXT NOT NULL DEFAULT 'copy' CHECK(import_mode IN ('copy', 'reference'))
        );

        -- Tags
        CREATE TABLE IF NOT EXISTS tags (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE COLLATE NOCASE,
          color TEXT,
          created_at TEXT NOT NULL
        );

        -- Relations Items <-> Tags
        CREATE TABLE IF NOT EXISTS item_tags (
          item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
          tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
          PRIMARY KEY (item_id, tag_id)
        );

        -- Paramètres de l'application
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        -- Table virtuelle FTS5 pour recherche plein texte
        CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
          item_id UNINDEXED,
          title,
          description,
          body_text,
          tags,
          tokenize = 'unicode61 remove_diacritics 2'
        );
      `);

      this.db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(1, getUtcTimestamp());
    }
  }

  // Transaction helper
  public runTransaction<T>(action: () => T): T {
    this.db.exec('BEGIN TRANSACTION;');
    try {
      const result = action();
      this.db.exec('COMMIT;');
      return result;
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  // --- Indexation FTS ---
  public updateFtsIndex(itemId: string) {
    const item = this.getItemById(itemId);
    this.db.prepare('DELETE FROM items_fts WHERE item_id = ?').run(itemId);

    if (!item || item.deleted_at) {
      return;
    }

    const noteText = item.note ? item.note.body_text : '';
    const tagsText = item.tags ? item.tags.map(t => t.name).join(' ') : '';
    const descText = item.description || '';

    this.db.prepare(`
      INSERT INTO items_fts (item_id, title, description, body_text, tags)
      VALUES (?, ?, ?, ?, ?)
    `).run(item.id, item.title, descText, noteText, tagsText);
  }

  public rebuildFullIndex() {
    this.runTransaction(() => {
      this.db.exec('DELETE FROM items_fts;');
      const activeItems = this.db.prepare("SELECT id FROM items WHERE deleted_at IS NULL").all() as { id: string }[];
      for (const row of activeItems) {
        this.updateFtsIndex(row.id);
      }
    });
  }

  // --- Gestion des Éléments (Items) ---
  public createItem(data: {
    type: 'note' | 'link' | 'file' | 'image';
    title: string;
    description?: string | null;
    source?: string | null;
    note?: { body_text: string; format?: 'plain' | 'markdown' };
    link?: { url: string; normalized_url: string; fetched_title?: string; fetched_description?: string; preview_image?: string };
    file?: { display_name: string; storage_path: string; mime_type: string; size_bytes: number; checksum: string; import_mode?: 'copy' | 'reference' };
    tagIds?: string[];
  }): Item {
    return this.runTransaction(() => {
      const id = randomUUID();
      const now = getUtcTimestamp();

      this.db.prepare(`
        INSERT INTO items (id, type, title, description, created_at, updated_at, deleted_at, source, favorite)
        VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 0)
      `).run(id, data.type, data.title, data.description || null, now, now, data.source || null);

      if (data.note) {
        this.db.prepare(`
          INSERT INTO note_contents (item_id, body_text, format)
          VALUES (?, ?, ?)
        `).run(id, data.note.body_text, data.note.format || 'markdown');
      }

      if (data.link) {
        this.db.prepare(`
          INSERT INTO link_contents (item_id, url, normalized_url, fetched_title, fetched_description, preview_image)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, data.link.url, data.link.normalized_url, data.link.fetched_title || null, data.link.fetched_description || null, data.link.preview_image || null);
      }

      if (data.file) {
        const fileId = randomUUID();
        this.db.prepare(`
          INSERT INTO file_attachments (id, item_id, display_name, storage_path, mime_type, size_bytes, checksum, import_mode)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(fileId, id, data.file.display_name, data.file.storage_path, data.file.mime_type, data.file.size_bytes, data.file.checksum, data.file.import_mode || 'copy');
      }

      if (data.tagIds && data.tagIds.length > 0) {
        for (const tagId of data.tagIds) {
          this.db.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)').run(id, tagId);
        }
      }

      this.updateFtsIndex(id);
      return this.getItemById(id)!;
    });
  }

  public getItemById(id: string): Item | null {
    const raw = this.db.prepare('SELECT * FROM items WHERE id = ?').get(id) as any;
    if (!raw) return null;

    const tags = this.db.prepare(`
      SELECT t.* FROM tags t
      INNER JOIN item_tags it ON it.tag_id = t.id
      WHERE it.item_id = ?
      ORDER BY t.name ASC
    `).all(id) as Tag[];

    const note = this.db.prepare('SELECT * FROM note_contents WHERE item_id = ?').get(id) as NoteContent | undefined;
    const link = this.db.prepare('SELECT * FROM link_contents WHERE item_id = ?').get(id) as LinkContent | undefined;
    const file = this.db.prepare('SELECT * FROM file_attachments WHERE item_id = ?').get(id) as FileAttachment | undefined;

    return {
      ...raw,
      favorite: raw.favorite ? 1 : 0,
      tags: tags || [],
      note: note || null,
      link: link || null,
      file: file || null
    };
  }

  public updateItem(id: string, updates: {
    title?: string;
    description?: string | null;
    favorite?: boolean;
    noteBody?: string;
    tagIds?: string[];
  }): Item | null {
    return this.runTransaction(() => {
      const existing = this.getItemById(id);
      if (!existing) return null;

      const now = getUtcTimestamp();
      const newTitle = updates.title !== undefined ? updates.title : existing.title;
      const newDesc = updates.description !== undefined ? updates.description : existing.description;
      const newFav = updates.favorite !== undefined ? (updates.favorite ? 1 : 0) : existing.favorite;

      this.db.prepare(`
        UPDATE items
        SET title = ?, description = ?, favorite = ?, updated_at = ?
        WHERE id = ?
      `).run(newTitle, newDesc, newFav, now, id);

      if (updates.noteBody !== undefined && existing.note) {
        this.db.prepare(`
          UPDATE note_contents
          SET body_text = ?
          WHERE item_id = ?
        `).run(updates.noteBody, id);
      }

      if (updates.tagIds !== undefined) {
        this.db.prepare('DELETE FROM item_tags WHERE item_id = ?').run(id);
        for (const tagId of updates.tagIds) {
          this.db.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)').run(id, tagId);
        }
      }

      this.updateFtsIndex(id);
      return this.getItemById(id);
    });
  }

  public softDeleteItem(id: string): boolean {
    const now = getUtcTimestamp();
    const res = this.db.prepare('UPDATE items SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL').run(now, now, id);
    this.updateFtsIndex(id);
    return res.changes > 0;
  }

  public restoreItem(id: string): boolean {
    const now = getUtcTimestamp();
    const res = this.db.prepare('UPDATE items SET deleted_at = NULL, updated_at = ? WHERE id = ? AND deleted_at IS NOT NULL').run(now, id);
    this.updateFtsIndex(id);
    return res.changes > 0;
  }

  public hardDeleteItem(id: string): { success: boolean; filePathsToDelete: string[] } {
    return this.runTransaction(() => {
      const files = this.db.prepare('SELECT storage_path, import_mode FROM file_attachments WHERE item_id = ?').all(id) as { storage_path: string; import_mode: string }[];
      const filesToDelete = files.filter(f => f.import_mode === 'copy').map(f => f.storage_path);

      this.db.prepare('DELETE FROM items_fts WHERE item_id = ?').run(id);
      const res = this.db.prepare('DELETE FROM items WHERE id = ?').run(id);
      return {
        success: res.changes > 0,
        filePathsToDelete: filesToDelete
      };
    });
  }

  // --- Tags ---
  public createTag(name: string, color?: string | null): Tag {
    const cleanName = name.trim();
    const existing = this.db.prepare('SELECT * FROM tags WHERE name = ? COLLATE NOCASE').get(cleanName) as Tag | undefined;
    if (existing) {
      return existing;
    }
    const tag: Tag = {
      id: randomUUID(),
      name: cleanName,
      color: color || '#007BFF',
      created_at: getUtcTimestamp()
    };
    this.db.prepare('INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)').run(tag.id, tag.name, tag.color, tag.created_at);
    return tag;
  }

  public getTags(): (Tag & { count: number })[] {
    return this.db.prepare(`
      SELECT t.*, COUNT(it.item_id) as count
      FROM tags t
      LEFT JOIN item_tags it ON it.tag_id = t.id
      LEFT JOIN items i ON i.id = it.item_id AND i.deleted_at IS NULL
      GROUP BY t.id
      ORDER BY t.name ASC
    `).all() as any;
  }

  public renameTag(id: string, newName: string): boolean {
    const res = this.db.prepare('UPDATE tags SET name = ? WHERE id = ?').run(newName.trim(), id);
    this.rebuildFullIndex();
    return res.changes > 0;
  }

  public deleteTag(id: string): boolean {
    const res = this.db.prepare('DELETE FROM tags WHERE id = ?').run(id);
    this.rebuildFullIndex();
    return res.changes > 0;
  }

  // --- Paramètres ---
  public getSetting(key: string, defaultValue = ''): string {
    const row = this.db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row ? row.value : defaultValue;
  }

  public setSetting(key: string, value: string): void {
    const now = getUtcTimestamp();
    this.db.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(key, value, now);
  }

  // --- Liste & Recherche filtrée ---
  public queryItems(params: SearchQuery): Item[] {
    const conditions: string[] = [];
    const sqlParams: any[] = [];

    // Poubelle ou actif
    if (params.isTrash) {
      conditions.push('i.deleted_at IS NOT NULL');
    } else {
      conditions.push('i.deleted_at IS NULL');
    }

    // Type filter
    if (params.type && params.type !== 'all') {
      conditions.push('i.type = ?');
      sqlParams.push(params.type);
    }

    // Tag filter
    if (params.tagId) {
      conditions.push('EXISTS (SELECT 1 FROM item_tags it WHERE it.item_id = i.id AND it.tag_id = ?)');
      sqlParams.push(params.tagId);
    }

    // Non classés (aucun tag)
    if (params.unclassifiedOnly) {
      conditions.push('NOT EXISTS (SELECT 1 FROM item_tags it WHERE it.item_id = i.id)');
    }

    // Date range
    if (params.dateFrom) {
      conditions.push('i.created_at >= ?');
      sqlParams.push(params.dateFrom);
    }
    if (params.dateTo) {
      conditions.push('i.created_at <= ?');
      sqlParams.push(params.dateTo);
    }

    // Recherche FTS si terme fourni
    let ftsJoin = '';
    let orderBy = 'i.created_at DESC';

    if (params.query && params.query.trim().length > 0) {
      // Préparation du terme pour SQLite FTS5 (échappement de guillemets)
      const cleanTerm = params.query.trim().replace(/"/g, '""');
      ftsJoin = 'INNER JOIN items_fts fts ON fts.item_id = i.id';
      conditions.push('items_fts MATCH ?');
      sqlParams.push(`"${cleanTerm}"*`);
      orderBy = 'fts.rank, i.created_at DESC';
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT DISTINCT i.id
      FROM items i
      ${ftsJoin}
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT 200
    `;

    const rows = this.db.prepare(sql).all(...sqlParams) as { id: string }[];
    return rows.map(r => this.getItemById(r.id)!).filter(Boolean);
  }
}

