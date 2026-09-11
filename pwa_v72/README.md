# Budget · Saisie — PWA Google Sheets (v7.1 pérenne)

Cette version est conçue pour fonctionner sans année maximum. Les onglets mensuels restent la source de vérité, la PWA détecte les onglets `Mois Année`, et le classeur utilise des index techniques pour que son Dashboard ne dépende plus d'une plage fixe 2024-2026.

## Nouveautés v7.1

### Gestion des mois préparés à l’avance

Les onglets futurs peuvent déjà contenir une base de revenus et dépenses fixes. Ils restent accessibles dans la vue **Mois**, mais ils ne sont pas intégrés aux calculs du Dashboard avant leur date. Le mois courant est inclus automatiquement.

Exemple au 10 septembre 2026 :
- Septembre 2026 : **En cours**, intégré au Dashboard ;
- Octobre à Décembre 2026 : **Prévisionnel**, exclus du réalisé ;
- Janvier à Mars 2027 : **Prévisionnel**, exclus du réalisé.

Le `Modèle mois` fourni reprend désormais une base préremplie issue de Décembre 2026, afin de conserver le fonctionnement habituel : partir d’une structure et de montants relativement stables, puis les ajuster au fil du mois.


- **Création des mois futurs depuis `Modèle mois`** : si une saisie vise un mois absent, la PWA propose de le créer, duplique le modèle, renomme l'onglet, applique les éventuels montants récurrents, puis l'ajoute immédiatement au suivi.
- **Aucune année maximum dans le code** : plus de boucle 2024-2026, plus de limite 2100 et aucune référence à B:AK / AL / AN pour faire fonctionner le Dashboard.
- **Index automatiques** : `Index Mois` alimente les KPI et le récapitulatif annuel du Google Sheet ; `Index Catégories` alimente les agrégats détaillés et le Top 10.
- **Catégories pérennes** : une catégorie créée avec « aussi pour les mois suivants » est également ajoutée à `Modèle mois`, donc elle existera dans les futurs mois créés.
- **Référentiel des catégories** : `Référentiel catégories` conserve la section, le type et permet d'activer un montant récurrent optionnel.
- **Synchronisation des mois créés manuellement** : au démarrage et lors d'une actualisation, la PWA complète les index si elle détecte un onglet mensuel qui n'y figure pas encore.
- Conservés : saisie rapide, historique, annulation, Pointage, Dashboard PWA, comparaison N-1, mode hors ligne, OAuth Google Sheets, PIN et Face ID / Touch ID.

## Classeur attendu

Utiliser le classeur fourni avec cette version :

`Suivi_Budgetaire_Perenne_v4.xlsx`

Après conversion en Google Sheets, les onglets techniques suivants doivent être présents :

- `Synthèse globale`
- `Modèle mois`
- `Index Mois`
- `Index Catégories`
- `Référentiel catégories`
- `Saisies App`
- les onglets mensuels (`Janvier 2024`, `Février 2024`, etc.)

Ne renomme pas les quatre onglets techniques sans modifier le code de la PWA.

## Fonctionnement d'une saisie

1. La date détermine le mois et l'année.
2. Si l'onglet existe, la PWA trouve la catégorie par son libellé et ajoute le montant dans la cellule correspondante.
3. Si l'onglet n'existe pas, la PWA demande confirmation pour le créer depuis `Modèle mois`.
4. La PWA ajoute une ligne dans `Saisies App`.
5. Les formules des index se recalculent automatiquement, donc le Dashboard Google Sheets suit la nouvelle période sans retouche manuelle.

Revenus : colonne B. Dépenses : colonne C.

## Montants récurrents optionnels

Dans `Référentiel catégories` :

- colonne **E - Récurrent ?** : mettre `TRUE` pour les lignes à préremplir dans chaque nouveau mois ;
- colonne **F - Montant récurrent** : indiquer le montant à appliquer.

Par défaut, toutes les lignes sont à `FALSE` pour éviter de recopier automatiquement des dépenses ponctuelles. La création d'un nouveau mois reste donc sûre tant que tu n'actives pas explicitement une récurrence.

## Installation Google Sheets

1. Fais une copie de sauvegarde de ton fichier actuel sur Google Drive.
2. Charge `Suivi_Budgetaire_Perenne_v4.xlsx` sur Drive.
3. Ouvre-le avec Google Sheets puis enregistre-le comme feuille Google Sheets native.
4. Récupère l'ID du nouveau Google Sheet dans son URL.
5. Dans la PWA : Réglages → remplace l'ID du Google Sheet par ce nouvel ID.
6. Conserve ton Client ID OAuth existant si l'URL de la PWA ne change pas.

Voir `MIGRATION_V7_1.md` pour la procédure détaillée et les tests.

## OAuth Google

La PWA utilise uniquement le scope :

`https://www.googleapis.com/auth/spreadsheets`

Il faut activer Google Sheets API dans Google Cloud et utiliser un OAuth Client ID de type Web application. L'URL Vercel / l'origine de la PWA doit rester dans les Authorized JavaScript origins.

## Déploiement

L'application reste 100 % statique, aucun serveur applicatif n'est nécessaire.

Sur Vercel : remplace tous les fichiers par ceux de ce dossier, notamment `app.js`, `index.html`, `sw.js` et `manifest.webmanifest`.

En local :

```bash
python3 -m http.server 5173
```

## Hors ligne

Les saisies effectuées hors ligne restent dans la file d'attente locale. Une création de nouveau mois nécessite toutefois une connexion réseau et une confirmation utilisateur. Une saisie en file d'attente visant un mois encore absent reste donc en attente jusqu'à ce que ce mois ait été créé en ligne.

## Sécurité

Le comportement PIN + WebAuthn / Face ID / Touch ID est conservé. Les paramètres OAuth et l'ID du Google Sheet restent stockés localement dans le navigateur / la PWA.

## Fichiers

- `index.html` : interface et styles
- `app.js` : logique Sheets, création de mois, index, saisie, Dashboard, catégories, offline, sécurité
- `sw.js` : service worker, cache v7
- `manifest.webmanifest` : manifeste PWA
- `MIGRATION_V7_1.md` : migration et tests
- icônes : `icon-180.png`, `icon-192.png`, `icon-512.png`


## v7.2 - Pilotage 360
- La saisie utilisateur reste inchangée.
- Chaque nouvelle ligne de `Saisies App` est enrichie en colonnes I:Q : sens, tag analytique, nature économique, récurrence, année, mois, montant signé, source de classement et réserve `Tag IA (futur)`.
- La classification actuelle est locale et déterministe, sans appel IA ni coût API.
- Le futur branchement Gemini pourra remplir `Tag IA (futur)` à partir de la note, sans modifier la catégorie d'origine ni l'écriture mensuelle.
