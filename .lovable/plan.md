## Vue d'ensemble

Refactor important. Cinq chantiers liés:

1. **Erreur preview** (probablement liée au refactor — non bloquant pour Netlify)
2. Champ **Dimension** (texte libre) à la place de Hauteur/Largeur/Taille
3. Édition **inline du fichier DTF** côté client
4. **Fichier Excel par client agrégé** (onglet DTF + onglet Autres)
5. **Multi-produits** par commande (`commande_items`)
6. **Liste des commandes** sur la fiche client

---

## 1. Erreur preview Lovable

Cause probable: l'env preview ("Cloud Dev") utilise des credentials différents de Netlify. Tester les modifs sur l'URL publiée. Aucun changement de code auth — sinon Netlify casse aussi.

## 2. Migration DB

```sql
-- Table commande_items (multi-produits par commande)
CREATE TABLE commande_items (
  id uuid PK, commande_id uuid FK, position int,
  designation text, dimension text,        -- texte libre
  quantity int, unit_price numeric,
  total_ht numeric, tva_rate numeric, tva_amount numeric, total_ttc numeric,
  order_type_id uuid FK,                   -- type au niveau item (DTF ou autre)
  created_at timestamptz
);
-- RLS: même règles que commandes.
-- Conserver les colonnes existantes commandes.height_cm/width_cm/size_label/quantity/unit_price
-- pour compat: migrer chaque commande existante en 1 item, puis ces colonnes deviennent legacy.
```

`client_dtf_files` devient `client_files_excel` (1 fichier par client, 2 onglets):
```sql
ALTER TABLE client_dtf_files RENAME TO client_excel_files;
ALTER TABLE client_excel_files
  ADD COLUMN other_rows jsonb NOT NULL DEFAULT '[]';
-- rows reste = lignes DTF, other_rows = lignes non-DTF
```

## 3. UI commande nouvelle (`commandes.nouvelle.tsx`)

- Section "Client + commentaire" inchangée.
- Section "Produits" = liste de cartes; bouton **« + Ajouter un produit »**.
- Chaque carte: type, désignation, **dimension** (texte libre, remplace H/L/Taille), quantité, PU, TVA. HT/TTC recalculé live par item; total commande = somme.
- Suppression d'un item (sauf le dernier).
- À la soumission: créer `commandes` (totaux agrégés) + N `commande_items`.
- Pour chaque item: append au fichier Excel du client (onglet DTF si type=DTF, sinon onglet Autres).

## 4. Détail commande (`commandes.$id.tsx`)

- Affiche la liste des items au lieu d'un seul produit.
- Édition d'un item: dialog avec champ Dimension (texte). Recalcul HT/TTC = `quantity × unit_price` (pas de formule m² puisque dimension est texte).
- Marketing/super_admin peuvent ajouter/supprimer des items.

## 5. Fichier Excel client (2 onglets)

`documents.functions.ts`:
- `addToClientExcel({clientId, item, isDtf})` → crée/met à jour `client_excel_files`, ajoute la ligne dans `rows` (DTF) ou `other_rows`.
- Régénère un fichier `.xlsx` à 2 onglets:
  - **Onglet DTF**: Date, N° commande, Désignation, **Dimension**, Quantité, **ML** (= quantité, ou vide), PU, Total HT, puis section Avances + Reste.
  - **Onglet Autres commandes**: Date, N° commande, Type, Désignation, Dimension, Quantité, PU, Total HT.
- Remplace toutes les libellés `m²` par `ML`.
- `updateClientExcel({clientId, rows, otherRows, advances})` pour l'édition inline.

## 6. Édition inline DTF (`dtf-card.tsx` → `client-excel-card.tsx`)

- Tableau DTF avec champs éditables (input dans la cellule). Bouton « Enregistrer » par ligne ou debounce auto-save.
- Tableau Autres commandes idem.
- Bouton « + Ligne » pour ajout manuel.
- À chaque save: appel `updateClientExcel` qui régénère l'Excel.

## 7. Fiche client (`clients.$clientId.tsx`)

Ajouter une carte « Commandes » listant toutes les commandes du client (n°, date, type(s), statut, total TTC), chaque ligne = lien vers `/commandes/{id}`.

## 8. Vues impactées (compat)

- `commandes.index.tsx`, `bons-livraison.tsx`, `factures.tsx`, `devis.tsx`: lire `commandes.total_price/tva_amount` (déjà agrégés). OK sans changement.
- Les anciens documents PDF par commande continuent de fonctionner (lecture des items au lieu des champs commande pour la liste produits).

---

## Détails techniques

- **Pas de breaking pour Netlify**: aucun changement de config auth/env.
- Migration data: pour chaque `commandes` existante, insérer un `commande_items` correspondant à partir des colonnes legacy.
- Renommer `dtf-card.tsx` → `client-excel-card.tsx`, garder un re-export pour compat le temps de la migration.
- Stockage Excel: bucket `dtf-excel` réutilisé, chemin `clients/{clientId}.xlsx`.
- `xlsx-js-style`: 2 onglets via `XLSX.utils.book_append_sheet` deux fois.

---

## Ordre d'exécution

1. Migration DB (commande_items + rename + other_rows + backfill)
2. `documents.functions.ts`: nouveaux helpers Excel 2 onglets + serverFn d'update
3. Composant `client-excel-card.tsx` (édition inline)
4. `commandes.nouvelle.tsx` (multi-produits + dimension texte)
5. `commandes.$id.tsx` (liste items + édition)
6. `clients.$clientId.tsx` (carte Commandes)
7. Tester sur URL publiée

---

## Estimation taille

~8 fichiers modifiés + 1 migration + 1 nouveau composant. Refactor important — je le ferai en plusieurs passes courtes plutôt qu'un mega-commit.

Confirme et je lance la migration en premier.