# Spécification Préliminaire : Synchronisation Future — ONEBOX

Conformément aux **Sections 10.2 et 10.3 du Cahier des charges ONEBOX**, cette note de cadrage fixe les principes et exigences strictes que devra respecter toute future synchronisation multi-appareils.

---

## 1. Principes Directeurs

1. **Local-first préservé** : L'appareil local demeure autonome et fonctionnel à 100 % sans réseau. La synchronisation est une fonction d'échange et non une dépendance d'exécution.
2. **Chiffrement de bout en bout (E2EE)** : Les contenus privés (notes, liens, métadonnées, documents) doivent être chiffrés sur l'appareil avant toute transmission réseau.
3. **Résolution déterministe des conflits** : Ne jamais écraser silencieusement une version concurrente d'une note ou d'un document.
4. **Horodatage logique (CRDT / Vector Clocks)** : Ne jamais présumer de la fiabilité absolue de l'horloge système d'un appareil client.

---

## 2. Modèle de Données Prévu pour la Réplication

Pour évoluer vers la synchronisation après le MVP :
- **Identifiants immuables** : Tous les items utilisent déjà des identifiants UUID v4 stables.
- **Historique des opérations** : Table `sync_operations` traçant les actions (`INSERT`, `UPDATE`, `DELETE`), le numéro de séquence logique (HLCC) et le `device_id`.
- **Révocation d'appareils** : Capacité de révoquer un appareil perdu ou volé sans compromettre la clé maîtresse des autres postes.

---

## 3. Positionnement par rapport au MVP

Conformément à la section 10.3 du cahier des charges, **le MVP se concentre exclusivement sur l'excellence de la capture et de la recherche locale**. La synchronisation ne sera déployée qu'après validation complète du socle local et des protocoles de chiffrement.
