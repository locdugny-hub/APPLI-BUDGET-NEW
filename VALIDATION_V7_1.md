# Validation v7.1

## Contrôles effectués

- JavaScript validé avec `node --check`.
- Aucune borne d’année fixe réintroduite.
- Le Dashboard PWA filtre désormais les onglets après le mois courant.
- Les onglets futurs restent accessibles dans la vue Mois.
- `Index Mois` utilise un indicateur automatique selon l’année/mois courant.
- `Index Catégories` applique le même indicateur aux lignes de catégories.
- Le Top 10 et les agrégats de catégories utilisent uniquement les lignes réalisées.
- Le récapitulatif annuel peut être prolongé par la PWA lorsqu’une nouvelle année est ajoutée.
- Le `Modèle mois` reprend la base de Décembre 2026 afin de préserver le fonctionnement de préremplissage habituel.

## Valeurs de contrôle au 10/09/2026

Pour 2026, seuls Janvier à Septembre sont comptabilisés :
- Entrées : 98 347,00 €
- Sorties : 89 614,50 €
- Solde : 8 732,50 €

Cumul réalisé depuis le début :
- Entrées : 279 712,46 €
- Sorties : 242 632,15 €
- Solde : 37 080,31 €

Les 6 onglets futurs existants sont identifiés comme prévisionnels : Octobre à Décembre 2026 et Janvier à Mars 2027.

## Point non exécutable hors de ton environnement Google

La création réelle d’un onglet et l’écriture via ton OAuth Google Sheets doivent être testées après déploiement, car elles nécessitent ton Google Drive et tes autorisations.
