# Spécification du Schéma SQLite & Migrations — ONEBOX

Conformément à la **Section 9 du Cahier des charges ONEBOX**, ce document détaille le modèle relationnel, les contraintes d'intégrité et la gestion des migrations versionnées.

---

## 1. Schéma Relationnel

### Table `schema_migrations`
Trace les versions de schéma appliquées.
```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);
```

### Table `items` (Entité Racine)
Entité centrale stockant les métadonnées universelles.
```sql
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,                 -- UUID v4
  type TEXT NOT NULL CHECK(type IN ('note', 'link', 'file', 'image')),
  title TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,            -- ISO 8601 UTC
  updated_at TEXT NOT NULL,            -- ISO 8601 UTC
  deleted_at TEXT,                     -- NULL si actif, date ISO si en corbeille
  source TEXT,                         -- Origine (ex: 'Saisie utilisateur', 'Web', 'Import local')
  favorite INTEGER NOT NULL DEFAULT 0  -- 0 ou 1
);

CREATE INDEX idx_items_created_at ON items(created_at DESC);
CREATE INDEX idx_items_deleted_at ON items(deleted_at);
CREATE INDEX idx_items_type ON items(type);
```

### Table `note_contents` (Contenu des Notes)
```sql
CREATE TABLE IF NOT EXISTS note_contents (
  item_id TEXT PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
  body_text TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'plain' CHECK(format IN ('plain', 'markdown'))
);
```

### Table `link_contents` (Contenu des Liens Web)
```sql
CREATE TABLE IF NOT EXISTS link_contents (
  item_id TEXT PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  fetched_title TEXT,
  fetched_description TEXT,
  preview_image TEXT
);
```

### Table `file_attachments` (Pièces Jointes & Images)
```sql
CREATE TABLE IF NOT EXISTS file_attachments (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  checksum TEXT NOT NULL,              -- SHA-256
  import_mode TEXT NOT NULL DEFAULT 'copy' CHECK(import_mode IN ('copy', 'reference'))
);
```

### Tables `tags` et `item_tags` (Classification Transverse)
```sql
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  color TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS item_tags (
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, tag_id)
);
```

### Table Virtuelle `items_fts` (Index SQLite FTS5)
```sql
CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
  item_id UNINDEXED,
  title,
  description,
  body_text,
  tags,
  tokenize = 'unicode61 remove_diacritics 2'
);
```

---

## 2. Cycle de Vie Transactionnel d'un Élément (Section 9.3)

```text
Capture (Note, Lien, Fichier)
  │
  ▼
Validation (F-007)
  │
  ▼
Persistance SQLite (Transaction BEGIN ... COMMIT)
  │
  ├── Insertion dans items
  ├── Insertion dans table spécialisée (note_contents / link_contents / file_attachments)
  ├── Association des tags (item_tags)
  │
  ▼
Indexation FTS5 (items_fts)
  │
  ▼
Consultation / Modification (F-006)
  │
  ▼
Mise en Corbeille (deleted_at renseigné)
  │
  ├── Restauration (deleted_at = NULL)
  └── Suppression définitive (DELETE cascade + purge fichier physique)
```
