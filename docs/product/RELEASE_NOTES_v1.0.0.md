# Notes de Version (Release Notes) — ONEBOX v1.0.0 (MVP)

**Date** : 10 novembre 2026  
**Statut** : Version de référence MVP (Minimum Viable Product)

---

## 1. Fonctionnalités Incluses

### Capture Rapide (< 10 secondes)
- **Notes** : Saisie rapide en texte brut ou format Markdown (`MVP-02`).
- **Liens web** : Enregistrement d'URL avec validation automatique, normalisation et aperçu (`MVP-03`).
- **Fichiers & Documents** : Importation locale sécurisée avec détection MIME et calcul d'empreinte **SHA-256** (`MVP-04`).
- **Images** : Prévisualisation visuelle intégrée dans les cartes et le volet de détail (`MVP-05`).

### Organisation & Recherche
- **Boîte de réception** : Vue chronologique avec badges dynamiques et vue des *Non classés* (`MVP-01`).
- **Tags multiples** : Création, renommage, suppression et filtrage direct par étiquette (`MVP-07`).
- **Moteur de recherche instantané** : Recherche plein texte SQLite **FTS5** insensible aux accents et à la casse avec extraction de snippets contextuels (`MVP-06`).
- **Filtres & Tri** : Filtrage combiné par type, tags, favoris et tri configurable (`MVP-08`).

### Cycle de Vie & Souveraineté des Données
- **Corbeille réversible** : Déplacement logique sans perte, restauration instantanée, et suppression définitive avec confirmation explicite (`MVP-09`).
- **Export ZIP complet** : Sauvegarde 100% autonome avec manifeste d'intégrité `manifest.json`, données `items.json`, `items.csv`, notes Markdown et documents sources (`MVP-10`).
- **Restauration de sauvegarde** : Réimportation sécurisée sans écrasement (`RestoreManager`).
- **Paramètres & I18n** : Commutation instantanée Thème Sombre / Thème Clair, sélection de langue (Français / English), et politique de confidentialité intégrée (`MVP-11`).

---

## 2. Limites Connues de la Version MVP (Section 4.2 & 18)

Conformément au périmètre validé dans le cahier des charges :
1. **Mono-utilisateur local** : Une seule bibliothèque par installation ; les profils multiples et la synchronisation cloud chiffrée font l'objet des phases ultérieures (Section 10).
2. **Extraction de texte PDF/DOCX (OCR)** : L'indexation FTS se concentre sur les titres, métadonnées, notes et tags ; l'OCR et l'extraction de corps de documents lourds seront introduits dans les prochaines versions.
3. **Application de bureau** : Accès direct via navigateur web local (`localhost`) et lanceur direct Windows. Les paquets d'installation natifs packagés (MSI/InnoSetup) seront validés en phase bêta.

