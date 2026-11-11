# Foire Aux Questions (FAQ) — ONEBOX

## 1. Généralités & Fonctionnement

### Qu'est-ce que ONEBOX ?
ONEBOX est un logiciel libre et personnel conçu pour capturer, organiser et retrouver vos notes, liens, documents et images depuis un espace unique, sans dépendre du cloud.

### Pourquoi ONEBOX est-il « Local-first » ?
Le principe du *Local-first* garantit que vos données restent stockées sur votre appareil physique. Vous pouvez utiliser ONEBOX sans aucune connexion Internet, sans risque d'indisponibilité de serveur ni de fuite de données distantes.

### Faut-il créer un compte pour utiliser ONEBOX ?
Non. Le MVP de ONEBOX ne requiert aucun compte utilisateur, aucun identifiant, ni mot de passe. L'application est utilisable dès son installation.

---

## 2. Capture & Recherche

### Quel est le temps moyen pour capturer une note ou un lien ?
L'interface de ONEBOX est conçue pour permettre une capture en moins de 10 secondes grâce aux boutons d'ajout direct `+ Note`, `+ Lien`, et `+ Fichier / Image`.

### Comment fonctionne la recherche instantanée ?
ONEBOX intègre un index plein texte SQLite **FTS5** (Full-Text Search) qui analyse le texte de vos notes, les titres, les descriptions et les étiquettes en direct, tout en gérant les minuscules/majuscules et les accents grâce au tokenizer Unicode.

### Que faire si l'index de recherche semble désynchronisé ?
Un bouton **« ↺ Reconstruire l'index »** est accessible directement dans l'entête de l'application pour régénérer l'index FTS5 à partir des tables sources en cas de besoin.

---

## 3. Sauvegardes & Restauration

### Où sont stockées mes pièces jointes et images ?
Vos pièces jointes sont conservées dans le dossier local `data/attachments/` avec calcul d'une empreinte d'intégrité **SHA-256** pour chaque fichier.

### Comment sauvegarder mes données ?
Cliquez sur le bouton **« Sauvegarder / Exporter »** dans la barre latérale. Une archive ZIP est générée immédiatement, contenant vos métadonnées (`items.json`, `items.csv`), un manifeste de contrôle (`manifest.json`), vos notes au format Markdown et vos documents originaux.
