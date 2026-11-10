export type ItemType = 'note' | 'link' | 'file' | 'image';

export interface Item {
  id: string; // UUID
  type: ItemType;
  title: string;
  description?: string | null;
  created_at: string; // ISO 8601 UTC
  updated_at: string; // ISO 8601 UTC
  deleted_at?: string | null; // NULL if active, ISO date if in trash
  source?: string | null;
  favorite: number; // 0 or 1
  tags?: Tag[];
  note?: NoteContent | null;
  link?: LinkContent | null;
  file?: FileAttachment | null;
}

export interface NoteContent {
  item_id: string;
  body_text: string;
  format: 'plain' | 'markdown';
}

export interface LinkContent {
  item_id: string;
  url: string;
  normalized_url: string;
  fetched_title?: string | null;
  fetched_description?: string | null;
  preview_image?: string | null;
}

export interface FileAttachment {
  id: string;
  item_id: string;
  display_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  checksum: string; // SHA-256
  import_mode: 'copy' | 'reference';
}

export interface Tag {
  id: string;
  name: string;
  color?: string | null;
  created_at: string;
}

export interface ItemTag {
  item_id: string;
  tag_id: string;
}

export interface AppSettings {
  key: string;
  value: string;
  updated_at: string;
}

export interface SearchQuery {
  query?: string;
  type?: ItemType | 'all';
  tagId?: string;
  isTrash?: boolean;
  unclassifiedOnly?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

export interface SearchResultItem extends Item {
  snippet?: string;
  matchScore?: number;
}
