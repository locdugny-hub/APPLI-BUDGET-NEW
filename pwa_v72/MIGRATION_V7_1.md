# Migration Budget v7.1

## Principe

Cette version distingue automatiquement les mois **Réalisés**, **En cours** et **Prévisionnels**. Un onglet futur peut déjà exister et être prérempli sans fausser les KPI du Dashboard.

Au 10/09/2026, le comportement attendu est :
- Septembre 2026 : En cours et comptabilisé ;
- Octobre, Novembre, Décembre 2026 : Prévisionnels et non comptabilisés ;
- Janvier, Février, Mars 2027 : Prévisionnels et non comptabilisés.

Le passage d’un mois de Prévisionnel à En cours se fait automatiquement avec la date, sans modification de formule ni de code.

## Migration recommandée

1. Conserver une copie de sauvegarde du Google Sheet actuel et de la PWA actuelle.
2. Importer `Suivi_Budgetaire_Perenne_v4_1.xlsx` dans Google Drive et le convertir en Google Sheets natif.
3. Vérifier la présence de `Synthèse globale`, `Modèle mois`, `Index Mois`, `Index Catégories`, `Référentiel catégories` et `Saisies App`.
4. Vérifier dans `Index Mois` que les mois futurs ont le statut `Prévisionnel`.
5. Vérifier que le `Modèle mois` contient bien la base préremplie issue de Décembre 2026.
6. Déployer la PWA v7.1.
7. Dans les réglages de la PWA, renseigner l’ID du nouveau Google Sheet.
8. Ouvrir le Dashboard et vérifier qu’il s’arrête automatiquement au mois courant.

## Fonctionnement quotidien

Les mois futurs préparés restent navigables dans la vue `Mois`. Tu peux donc continuer à préparer des onglets à l’avance ou les laisser tels quels. Le Dashboard ne les compte pas tant que leur mois n’est pas arrivé.

Si un mois futur n’existe pas, une saisie datée sur ce mois peut déclencher sa création depuis `Modèle mois` après confirmation. Comme le modèle est prérempli, le nouveau mois démarre avec la base habituelle, puis tu peux l’ajuster.

## Test conseillé

1. Contrôler le Dashboard 2026 : Octobre à Décembre doivent afficher 0 dans la vue réalisée.
2. Ouvrir directement Octobre 2026 dans `Mois` : les montants préremplis doivent toujours être présents.
3. Contrôler `Index Mois` : Octobre 2026 doit être `Prévisionnel`.
4. Sur une copie de test, créer Janvier 2028 depuis la PWA.
5. Vérifier que Janvier 2028 reprend le modèle prérempli mais n’entre pas dans le Dashboard tant que 2028 n’est pas arrivé.

## Important

Les montants futurs ne sont pas supprimés. Ils sont uniquement exclus du périmètre **réalisé**. Cela permet de conserver une base budgétaire de préparation sans mélanger prévision et suivi courant.
