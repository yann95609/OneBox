# Architecture Technique de ONEBOX

## 1. Vue d'ensemble

ONEBOX est conçu selon le paradigme **Local-First**, où l'appareil de l'utilisateur est la source de vérité absolue.

```
+-----------------------------------------------------------+
|                    Interface Utilisateur                  |
|          (apps/desktop/public/index.html & assets)        |
+-----------------------------+-----------------------------+
                              | REST API (HTTP Local)
+-----------------------------v-----------------------------+
|               Serveur Local & Couche Métier               |
|            (apps/desktop/server.ts & packages/core)       |
+--------------+-----------------------------+--------------+
               |                             |
+--------------v---------------+ +-----------v--------------+
|       Stockage & Fichiers    | |     Persistance & Index  |
|      (packages/storage)      | |      (packages/data)     |
| - data/attachments/          | | - SQLite (data/onebox.db)|
| - Checksums SHA-256          | | - SQLite FTS5 (Index)    |
| - Export ZIP & Manifeste     | | - Migrations versionnées |
+------------------------------+ +--------------------------+
```

## 2. Modèle de données & Schéma relationnel (Section 9.1)

- **`items`** : Entité racine (UUID, type, titre, description, dates UTC, état de corbeille `deleted_at`, source, favori).
- **`note_contents`** : Contenu textuel riche / Markdown lié à un item de type `note`.
- **`link_contents`** : URL originale, URL normalisée, métadonnées web.
- **`file_attachments`** : Nom d'affichage, chemin sur disque, type MIME, taille en octets, empreinte SHA-256, mode de stockage (`copy` vs `reference`).
- **`tags`** et **`item_tags`** : Système de classification transverse sans hiérarchie obligatoire.
- **`items_fts`** : Table virtuelle SQLite FTS5 pour la recherche instantanée multicritères.

## 3. Conformité aux Exigences Fonctionnelles

- **F-001 à F-007 (Capture)** : Saisie instantanée de Notes, Liens et Fichiers/Images en moins de 10 secondes.
- **F-010 à F-014 (Organisation)** : Multi-tagging, filtrage dynamique par tag, type et état, vue des éléments non classés.
- **FTS Recherche (Section 5.3)** : Indexation plein texte, tolérance aux accents et minuscules/majuscules via `unicode61`.
- **Suppression & Restauration (Section 5.5)** : Corbeille logique réversible, suppression définitive avec purge des fichiers orphelins.
- **Export & Manifeste (Section 5.6)** : Exportation en un clic d'une archive ZIP contenant `manifest.json`, `items.json`, `items.csv`, notes au format Markdown et pièces jointes.
