# Politique de Confidentialité — ONEBOX

Conformément à la **Section 11.3 du Cahier des charges ONEBOX**, ce document détaille la manière dont sont traitées les informations numériques.

---

## 1. Principes Fondamentaux

1. **Local-first absolu** : Vos informations (notes, liens, documents, images) sont stockées exclusivement sur votre machine locale dans une base SQLite et un dossier applicatif dédié.
2. **Aucune télémétrie** : ONEBOX n'intègre aucun traceur, aucun pixel d'analyse ni mesure d'audience masquée.
3. **Zéro publicité & Zéro revente** : Aucune donnée utilisateur n'est vendue, louée ou partagée avec des tiers.
4. **Pas d'IA obligatoire** : Le fonctionnement central de ONEBOX (capture, indexation, recherche, organisation) ne transmet aucune bribe de texte à des services d'IA distants.

---

## 2. Inventaire des Données Traitées

| Type de donnée | Finalité | Emplacement de stockage |
| :--- | :--- | :--- |
| **Notes & Textes** | Prise de note personnelle | `data/onebox.db` (table `note_contents`) |
| **Liens web** | Enregistrement de signets | `data/onebox.db` (table `link_contents`) |
| **Fichiers & Images** | Conservation de pièces jointes | `data/attachments/` avec somme SHA-256 |
| **Tags & Catégories** | Organisation transversale | `data/onebox.db` (tables `tags`, `item_tags`) |
| **Préférences** | Thème et langue choisis | `data/onebox.db` (table `app_settings`) |

---

## 3. Droits de l'Utilisateur : Exportation et Suppression

- **Droit d'exportation intégrale** : L'utilisateur peut à tout instant exporter 100% de ses données au format ouvert standard (JSON, Markdown, CSV, ZIP).
- **Droit à l'effacement** : La suppression définitive d'un élément dans la Corbeille purge instantanément son contenu de la base SQLite et supprime physiquement le fichier associé du disque dur.

