import type { OneBoxDatabase } from '../data/db.ts';
import type { Item, SearchQuery, SearchResultItem } from '../core/types.ts';

export class SearchEngine {
  private db: OneBoxDatabase;

  constructor(db: OneBoxDatabase) {
    this.db = db;
  }

  public search(params: SearchQuery): SearchResultItem[] {
    const items = this.db.queryItems(params);
    const q = params.query ? params.query.trim().toLowerCase() : '';

    return items.map(item => {
      let snippet = '';

      if (q && q.length > 0) {
        // Recherche d'extrait pertinent
        const noteText = item.note ? item.note.body_text : '';
        const descText = item.description || '';
        const combined = `${item.title} — ${descText} — ${noteText}`;
        const lower = combined.toLowerCase();
        const idx = lower.indexOf(q);

        if (idx !== -1) {
          const start = Math.max(0, idx - 40);
          const end = Math.min(combined.length, idx + q.length + 60);
          snippet = (start > 0 ? '...' : '') + combined.slice(start, end).trim() + (end < combined.length ? '...' : '');
        }
      }

      if (!snippet) {
        if (item.type === 'note' && item.note) {
          snippet = item.note.body_text.slice(0, 100);
        } else if (item.description) {
          snippet = item.description.slice(0, 100);
        } else if (item.type === 'link' && item.link) {
          snippet = item.link.url;
        } else if (item.file) {
          snippet = `${item.file.display_name} (${Math.round(item.file.size_bytes / 1024)} Ko)`;
        }
      }

      return {
        ...item,
        snippet
      };
    });
  }

  public rebuildIndex(): void {
    this.db.rebuildFullIndex();
  }
}
