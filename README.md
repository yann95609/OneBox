# ONEBOX

Espace numérique personnel pour capturer, organiser et retrouver ses informations.

![ONEBOX Logo](assets/logo.jpg)

## Vision & Principes

- **Simple** : Capture rapide en moins de 10 secondes (Note, Lien, Fichier, Image).
- **Local-first** : Fonctionnement 100% autonome et hors ligne avec stockage local SQLite et fichiers applicatifs.
- **Respect de la vie privée** : Aucune télémétrie par défaut, aucun compte requis pour le MVP.
- **Recherche performante** : Moteur plein texte SQLite FTS5 indexant titres, notes et métadonnées.
- **Export & Maîtrise** : Sauvegarde intégrale en formats ouverts (JSON, Markdown, archive avec manifeste).

## Structure du projet

- `apps/desktop` : Interface applicative desktop locale.
- `packages/core` : Entités du domaine, validations et règles métier.
- `packages/data` : Couche de persistance SQLite avec migrations et FTS5.
- `packages/storage` : Gestion locale des pièces jointes et calcul d'intégrité (SHA-256).
- `packages/search` : Moteur de recherche plein texte et filtres.
- `docs/` : Décisions d'architecture (ADR) et spécifications techniques.

## Démarrage rapide

```bash
npm install
npm start
```
