# Guide Développeur — ONEBOX

Ce document fournit aux développeurs et contributeurs toutes les informations techniques nécessaires pour étendre, maintenir et tester **ONEBOX**.

---

## 1. Environnement de Développement

### Prérequis
- **Node.js** version 22.5+ ou 24+ (intégrant le module natif `node:sqlite`).
- **npm** version 10+.
- **Git**.

### Installation & Lancement
```bash
# Cloner le dépôt
git clone <url-du-depot>
cd ONEBOX

# Exécuter les tests d'acceptation
npm test

# Lancer le serveur et l'interface locale
npm start
```
L'interface s'ouvre sur `http://localhost:3845`.

---

## 2. Structure Monorepo & Rôle des Paquets

```text
packages/
├── core/                  # Types TypeScript, validateurs, journalisation sécurisée (logger)
├── data/                  # Base SQLite locale (db.ts), migrations versionnées, triggers FTS5
├── search/                # Moteur de recherche FTS5 (engine.ts), extraction de snippets
└── storage/               # Gestionnaire de fichiers (fileManager.ts), export (exportManager.ts), restauration (restoreManager.ts)
apps/
└── desktop/               # Serveur HTTP local (server.ts) et interface web SPA (public/index.html)
```

---

## 3. Gestion de la Base de Données & Migrations (Section 9.2)

Toute modification du schéma SQL passe par la table `schema_migrations` dans `packages/data/db.ts` :

```typescript
// Exemple d'ajout d'une migration version 2
if (!appliedVersions.has(2)) {
  this.db.exec(`
    ALTER TABLE items ADD COLUMN pinned INTEGER DEFAULT 0;
  `);
  this.db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(2, getUtcTimestamp());
}
```

### Table Virtuelle FTS5
La recherche plein texte s'appuie sur la table virtuelle SQLite `items_fts` :
- Tokenizer : `unicode61 remove_diacritics 2` (insensible aux accents et à la casse).
- Champs indexés : `title`, `description`, `body_text`, `tags`.
- Mise à jour automatique : exécutée après chaque création/mise à jour d'item via `updateFtsIndex(itemId)`.

---

## 4. Tests Automatisés

Les tests sont rédigés à l'aide du module natif `node:test` dans `test/onebox.test.ts`.

Pour exécuter la suite de tests :
```bash
npm test
```

### Critères validés
- **AC-01 & AC-02** : Création locale sans compte et persistance après fermeture.
- **AC-03** : Enregistrement de lien et recherche par mot-clé.
- **AC-04** : Import de fichier avec métadonnées, taille et SHA-256.
- **AC-05** : Tags multiples et filtrage.
- **AC-06** : Cycle de vie corbeille (mise en corbeille et restauration).
- **AC-07** : Export ZIP complet avec fichier manifeste.
- **AC-08** : Fonctionnement 100% hors-ligne.
- **AC-09** : Validation des URL et gestion explicite des fichiers inaccessibles.
- **AC-10** : Préservation des données lors des migrations de schéma.
- **AC-11** : Importation et ré-indexation d'une sauvegarde.

