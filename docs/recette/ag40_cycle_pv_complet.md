# Recette AG #40 — Cycle complet votes, résultats et PV

## Objectif

Valider le parcours complet d’une assemblée générale pilote depuis les présences et votes jusqu’à la clôture définitive de l’AG avec PV signé et verrouillé.

## Assemblée testée

- AG : AG #40
- Référence : AG-40
- Titre : AG pilote E2E — Budget et travaux
- Date : 28 juin 2026
- Lieu : Salle de réunion Résidence Pilote E2E
- Copropriété active : #24

## Données de participation

- Présences enregistrées : 3
- Votes enregistrés : 9
- Tantièmes présents : 550 / 1000
- Taux de présence : 55 %
- Quorum : atteint

## Résolutions validées

| Résolution | Résultat |
|---|---|
| R1 — Approbation du budget prévisionnel | Adoptée |
| R2 — Réfection de la peinture des parties communes | Adoptée |
| R3 — Autorisation de recouvrement des impayés | Adoptée |

## Points validés

- Les votes ont été enregistrés correctement.
- Les résultats ont été calculés.
- Les 3 résolutions ont été clôturées.
- Les KPI de la page Résolutions affichent :
  - Résolutions : 3
  - Adoptées : 3
  - Rejetées : 0
  - En attente : 0
  - Clôturées : 3
- Le PV a été archivé/généré.
- Le PV a été signé.
- Le PV a été verrouillé.
- L’assemblée a été clôturée.

## État documentaire final

- PV généré le : 14/06/2026 à 10:57
- PV signé le : 14/06/2026 à 10:59
- Signataire : Syndic Résidence Les Jardins d’Azur
- Verrouillage : Oui
- Fichier signé : `/media/ag/pv_signed/PV-AG-00040-SIGNE.pdf`

## État final attendu

| Élément | État |
|---|---|
| AG #40 | Clôturée |
| Résolutions | 3 adoptées |
| Présences | 3 |
| Votes | 9 |
| Quorum | Atteint |
| PV | Signé et verrouillé |
| Git | Propre après recette runtime |

## Observation produit

Le parcours fonctionne techniquement, mais il reste trop manuel pour un syndic non technicien.

Points à améliorer dans le prochain sprint :

1. Calcul automatique du résultat après vote.
2. Affichage clair du résultat provisoire.
3. Clarification du libellé “Archiver le PV”.
4. Assistant de cycle AG : Présences → Votes → Résultats → PV → Signature → Verrouillage → Clôture.
5. Blocage du PV si des résolutions sont encore en attente.

## Conclusion

La recette AG #40 est validée de bout en bout. Le module AG est fonctionnel sur le scénario complet, mais le prochain sprint doit améliorer la lisibilité et automatiser les transitions visibles pour le syndic.
