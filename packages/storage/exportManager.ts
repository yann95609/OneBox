import fs from 'node:fs';
import path from 'node:path';
import { OneBoxDatabase } from '../data/db.ts';
import { SimpleZipBuilder } from './zipBuilder.ts';
import { getUtcTimestamp } from '../core/validation.ts';

export class ExportManager {
  private db: OneBoxDatabase;

  constructor(db: OneBoxDatabase) {
    this.db = db;
  }

  public generateFullExportZip(): Buffer {
    const items = this.db.queryItems({}); // all active items
    const tags = this.db.getTags();
    const zip = new SimpleZipBuilder();

    const manifestFiles: Array<{
      id: string;
      title: string;
      type: string;
      checksum?: string;
      zip_path: string;
      size_bytes?: number;
    }> = [];

    // 1. Export JSON complet
    const exportData = {
      version: '1.0.0',
      exported_at: getUtcTimestamp(),
      total_items: items.length,
      items: items,
      tags: tags
    };
    zip.addFile('data/items.json', JSON.stringify(exportData, null, 2));

    // 2. Export CSV simple
    const csvHeader = 'id,type,title,created_at,tags,source\n';
    const csvRows = items.map(item => {
      const tagNames = (item.tags || []).map(t => t.name).join(';');
      const cleanTitle = (item.title || '').replace(/"/g, '""');
      const cleanSource = (item.source || '').replace(/"/g, '""');
      return `"${item.id}","${item.type}","${cleanTitle}","${item.created_at}","${tagNames}","${cleanSource}"`;
    }).join('\n');
    zip.addFile('data/items.csv', csvHeader + csvRows);

    // 3. Notes en fichiers Markdown séparés
    for (const item of items) {
      if (item.type === 'note' && item.note) {
        const safeName = item.title.replace(/[^a-zA-Z0-9_\-\u00C0-\u017F]/g, '_').slice(0, 40);
        const mdPath = `notes/${safeName}_${item.id.slice(0, 8)}.md`;
        const content = `# ${item.title}\n\n*Créé le : ${item.created_at}*\n*Tags : ${(item.tags || []).map(t => '#' + t.name).join(' ')}*\n\n---\n\n${item.note.body_text}\n`;
        zip.addFile(mdPath, content);
        manifestFiles.push({
          id: item.id,
          title: item.title,
          type: 'note',
          zip_path: mdPath
        });
      }

      // 4. Pièces jointes / Images
      if (item.file && item.file.storage_path) {
        try {
          if (fs.existsSync(item.file.storage_path)) {
            const fileBuf = fs.readFileSync(item.file.storage_path);
            const safeFileName = path.basename(item.file.storage_path);
            const zipPath = `attachments/${safeFileName}`;
            zip.addFile(zipPath, fileBuf);

            manifestFiles.push({
              id: item.id,
              title: item.title,
              type: item.type,
              checksum: item.file.checksum,
              zip_path: zipPath,
              size_bytes: fileBuf.length
            });
          }
        } catch (err) {
          console.error(`Impossible d'inclure le fichier ${item.file.storage_path} dans l'export:`, err);
        }
      }
    }

    // 5. Manifeste de vérification d'intégrité (AC-07)
    const manifest = {
      spec: 'ONEBOX-EXPORT-1.0',
      exported_at: getUtcTimestamp(),
      application: 'ONEBOX',
      manifest_entries: manifestFiles
    };
    zip.addFile('manifest.json', JSON.stringify(manifest, null, 2));

    return zip.toBuffer();
  }
}
