# Recette E2E client pilote

Sprint : copropriété, tantièmes, lots, copropriétaires, AG, convocation, présence, procuration, vote, PV.

## Objectif

Valider que le SaaS peut gérer un parcours complet syndic + copropriétaire sans intervention technique.

## Règle de classement

- BLOQUANT : empêche de continuer.
- GÊNANT DÉMO / PILOTE : compréhensible difficilement ou risqué en présentation.
- AMÉLIORATION PLUS TARD : utile mais non bloquant.

## Étapes de recette

1. État technique initial
2. Création copropriété pilote
3. Création catégories de tantièmes
4. Création lots
5. Création copropriétaires
6. Création accès copropriétaire
7. Création AG
8. Création résolutions
9. Génération convocations
10. Génération PDF convocations
11. Consultation côté copropriétaire
12. Présence
13. Procuration
14. Vote copropriétaire
15. Suivi syndic
16. Clôture AG
17. Génération / signature / verrouillage PV
18. Consultation PV côté copropriétaire

## Journal de recette

### 1. État technique initial

À compléter.

### 2. Copropriété pilote

Nom prévu : Résidence Pilote E2E

À compléter.

### 3. Anomalies bloquantes

À compléter.

### 4. Anomalies gênantes démo / pilote

À compléter.

### 5. Améliorations plus tard

À compléter.

### 6. Décision finale

À compléter : prêt démo / prêt pilote / non prêt pilote.

---

## Journal — Étape 2 : Création copropriété pilote

Résultat :
- Copropriété créée avec succès.
- Nom : Résidence Pilote E2E.
- Identifiant plateforme : #24.
- Téléphone et email de contact non renseignés, affichés correctement à “—”.

Observation GÊNANT DÉMO / PILOTE :
- Après création et ouverture de la fiche #24, la sidebar affichait encore “Copropriété active #11”.
- Risque : créer ensuite les tantièmes, lots ou copropriétaires dans la copropriété #11 au lieu de #24.
- Action attendue : basculer explicitement le contexte actif sur “Résidence Pilote E2E #24” avant de continuer.
- Amélioration recommandée : après création d’une copropriété, proposer un bouton “Définir comme copropriété active” ou basculer automatiquement avec confirmation.

---

## Journal — Étape 3 : Création catégories de tantièmes

Résultat :
- Copropriété active correctement positionnée sur #24.
- 3 catégories créées : GENERAL, PARK, ASC.
- Page Tantièmes affiche 3 catégories actives.
- Valeurs saisies : 0, normal car aucun lot n’est encore créé.

Observation GÊNANT DÉMO / PILOTE :
- Le champ “Code” n’est pas assez clair pour l’utilisateur. Il devrait être renommé “Code catégorie” avec une aide du type : “Exemples : GENERAL, PARK, ASC”.
- Les libellés/descriptions peuvent être confondus pendant la saisie.
- Aucun bouton “Modifier” visible sur les catégories créées, seulement “Désactiver”.
- Risque : si une catégorie est mal libellée, le syndic ne peut pas corriger facilement depuis l’interface.

Correction recommandée :
- Ajouter une action “Modifier” sur chaque catégorie de tantièmes.
- Clarifier les aides de saisie.

---

## Journal — Étape 4 : Création des lots

Résultat :
- 5 lots créés dans la copropriété active #24.
- Lots visibles : A101, A102, B201, RDC-01, PARK-01.
- Les surfaces et nombres de pièces sont visibles.
- Les lots n’ont pas encore de tantièmes affectés, ce qui est normal à cette étape.
- Les lots n’ont pas encore de copropriétaire affecté.

Observation GÊNANT DÉMO / PILOTE :
- Les lots apparaissent au statut “Occupé” alors qu’aucun propriétaire ni occupant n’est encore affecté.
- Risque : un syndic peut penser que le lot est déjà juridiquement occupé ou attribué.
- Correction recommandée : utiliser un statut plus clair avant affectation, par exemple “Disponible”, “Non affecté” ou “Actif”, ou clarifier la signification du statut.

---

## Journal — Étape 4 bis : Affectation des tantièmes

Résultat :
- 9 valeurs de tantièmes saisies.
- GENERAL : 5 lots, total 1000.
- ASC : 3 lots, total 600.
- PARK : 1 lot, total 100.
- Les valeurs métier sont cohérentes pour poursuivre la recette.

Observation GÊNANT DÉMO / PILOTE :
- Les codes sont corrects, mais les libellés/descriptions de PARK et ASC sont confus ou inversés.
- L’interface ne propose pas de bouton visible “Modifier” pour corriger une catégorie après création.
- Risque : confusion en démonstration ou en usage syndic réel.

Correction recommandée :
- Ajouter une action “Modifier” sur les catégories de tantièmes.
- Clarifier le champ “Code” en “Code catégorie”.
- Ajouter une aide de saisie : GENERAL = charges générales, PARK = parkings, ASC = ascenseur.

---

## Journal — Blocage : création accès copropriétaire

Résultat :
- Les copropriétaires ont été créés.
- L’action “Créer accès” déclenche une erreur backend.

Erreur observée :
- Endpoint : /api/owners/coproprietaires/<id>/create-user-access/
- Erreur : ValueError
- Message : temporary_password_hash et created_at ne sont pas des champs valides du modèle sauvegardé.

Classement :
- BLOQUANT RECETTE E2E.

Impact :
- Impossible de créer l’accès copropriétaire depuis l’interface.
- Impossible de poursuivre proprement le test côté copropriétaire : convocation, présence, procuration, vote, PV.

Correction attendue :
- Corriger l’action backend create_user_access pour ne sauvegarder que des champs réellement présents sur le modèle utilisateur.
- Prévoir une réponse API propre avec email, identifiant utilisateur et mot de passe temporaire si disponible.

---

## Journal — Correction bloquant création accès copropriétaire

Diagnostic :
- L’action create-user-access écrivait un champ temporaire inexistant sur UserSecurityProfile.
- Le modèle UserSecurityProfile ne contient pas temporary_password_created_at.
- La création d’accès copropriétaire échouait donc au moment de sauvegarder le profil sécurité.

Correction appliquée :
- Suppression de l’écriture temporary_password_created_at.
- Conservation de must_change_password=True.
- Sauvegarde limitée aux champs réels : must_change_password et updated_at.

Classement :
- BLOQUANT RECETTE E2E corrigé.
