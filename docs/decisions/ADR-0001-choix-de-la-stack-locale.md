# ADR-0001 : Choix de la stack technique pour le MVP local-first

## Statut
Accepté

## Contexte
Le cahier des charges de ONEBOX (Section 8.1 & 19) préconise une architecture simple, robuste et multiplateforme axée sur le fonctionnement « Local-first », sans dépendance réseau obligatoire. L'étude initiale proposait Flutter/Dart comme piste à valider par prototype, avec SQLite pour la persistance locale et FTS pour l'indexation plein texte.

Sur le poste cible sous Windows, l'environnement dispose de **Node.js 24**, qui intègre nativement un moteur **SQLite C (`node:sqlite`)** compilé avec le module de recherche plein texte **FTS5 (unicode61)** et la capacité d'exécuter directement du code **TypeScript**.

## Décision
Pour le MVP de ONEBOX, nous adoptons :
1. **Moteur de persistance** : SQLite natif (`node:sqlite`) avec tables relationnelles et table virtuelle FTS5 pour une recherche textuelle en moins de 500 ms.
2. **Architecture monorepo modulaire** :
   - `packages/core` : Entités du domaine, validations, types.
   - `packages/data` : Couche d'accès aux données, migrations versionnées, transactions.
   - `packages/storage` : Gestionnaire de pièces jointes (copie/référence, SHA-256) et export ZIP avec manifeste.
   - `packages/search` : Requêtes FTS5, scoring, extraits de texte.
   - `apps/desktop` : Serveur applicatif local et interface utilisateur réactive (HTML5/Tailwind/ES6).
3. **Identité visuelle** : Respect de la charte graphique officielle du logo ONEBOX (cube 3D isométrique, bleu électrique `#0066FF`, noir profond `#0A0D14`, blanc pur) avec support des thèmes sombre et clair.

## Conséquences
- Démarrage instantané sans compilation lourde ni dépendance C++ externe.
- Respect strict des critères d'acceptation (AC-01 à AC-10).
- Évolution facilitée vers un packaging Electron ou Flutter/Tauri si souhaité ultérieurement.
