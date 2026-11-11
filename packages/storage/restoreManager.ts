/// <reference path="../../types/globals.d.ts" />
import type { OneBoxDatabase } from '../data/db.ts';
import type { Item, Tag } from '../core/types.ts';

export interface RestoreResult {
  success: boolean;
  importedItemsCount: number;
  importedTagsCount: number;
  errors: string[];
}

export class RestoreManager {
  private db: OneBoxDatabase;

  constructor(db: OneBoxDatabase) {
    this.db = db;
  }

  public restoreFromJson(jsonData: { version: string; items: Item[]; tags?: Tag[] }): RestoreResult {
    const result: RestoreResult = {
      success: true,
      importedItemsCount: 0,
      importedTagsCount: 0,
      errors: []
    };

    if (!jsonData || !Array.isArray(jsonData.items)) {
      result.success = false;
      result.errors.push('Format de fichier de sauvegarde invalide (clé "items" absente)');
      return result;
    }

    try {
      // 1. Importer ou retrouver les tags
      const tagMap = new Map<string, string>(); // ancient ID -> new ID
      if (Array.isArray(jsonData.tags)) {
        for (const t of jsonData.tags) {
          try {
            const created = this.db.createTag(t.name, t.color);
            tagMap.set(t.id, created.id);
            result.importedTagsCount++;
          } catch (err: any) {
            result.errors.push(`Tag "${t.name}": ${err?.message}`);
          }
        }
      }

      // 2. Importer les items
      for (const item of jsonData.items) {
        try {
          const mappedTagIds = (item.tags || []).map(t => tagMap.get(t.id) || t.id);

          this.db.createItem({
            type: item.type,
            title: item.title,
            description: item.description,
            source: item.source || 'Restauration sauvegarde',
            note: item.note ? {
              body_text: item.note.body_text,
              format: item.note.format
            } : undefined,
            link: item.link ? {
              url: item.link.url,
              normalized_url: item.link.normalized_url,
              fetched_title: item.link.fetched_title || undefined,
              fetched_description: item.link.fetched_description || undefined,
              preview_image: item.link.preview_image || undefined
            } : undefined,
            file: item.file ? {
              display_name: item.file.display_name,
              storage_path: item.file.storage_path,
              mime_type: item.file.mime_type,
              size_bytes: item.file.size_bytes,
              checksum: item.file.checksum,
              import_mode: item.file.import_mode
            } : undefined,
            tagIds: mappedTagIds
          });

          result.importedItemsCount++;
        } catch (err: any) {
          result.errors.push(`Élément "${item.title}": ${err?.message}`);
        }
      }
    } catch (err: any) {
      result.success = false;
      result.errors.push(`Erreur lors de la restauration: ${err?.message}`);
    }

    return result;
  }
}
