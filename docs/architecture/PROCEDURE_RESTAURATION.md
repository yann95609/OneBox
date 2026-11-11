# Procédure de Sauvegarde et Restauration — ONEBOX

Document de référence technique conformément à la **Section 5.6 du Cahier des charges**.

---

## 1. Structure de l'Archive de Sauvegarde

L'export généré par ONEBOX produit une archive `.zip` au format standard documenté :

```text
onebox_export_<timestamp>.zip
├── manifest.json            # Fichier de contrôle reliant chaque élément et empreinte SHA-256
├── data/
│   ├── items.json           # Export JSON complet et typé de tous les éléments et tags
│   └── items.csv            # Export tabulaire compatible tableurs (Excel, LibreOffice)
├── notes/                   # Notes individuelles au format Markdown (.md)
│   ├── note_cours_01.md
│   └── compte_rendu.md
└── attachments/             # Pièces jointes physiques conservées
    ├── contrat.pdf
    └── schema.png
```

---

## 2. Procédure de Restauration

### A. Restauration Programmatique (via `RestoreManager`)
La classe `RestoreManager` (`packages/storage/restoreManager.ts`) permet de réimporter les données d'une archive ou d'un export JSON :

```typescript
import { OneBoxDatabase } from './packages/data/db.ts';
import { RestoreManager } from './packages/storage/restoreManager.ts';

const db = new OneBoxDatabase();
const restore = new RestoreManager(db);

// Restauration depuis les données JSON
const result = restore.restoreFromJson(backupJsonData);
console.log(`Éléments importés : ${result.importedItemsCount}`);
```

### B. Contrôle d'Intégrité
1. Vérification de la présence de `manifest.json`.
2. Correspondance des empreintes **SHA-256** pour chaque fichier présent dans `attachments/`.
3. Validation des dates au format ISO 8601 UTC.
