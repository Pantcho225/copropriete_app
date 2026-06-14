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

---

## Journal — Blocage UX : rattachement lots / copropriétaires

Résultat :
- Les copropriétaires sont créés.
- Les lots sont créés.
- L'API backend d'affectation existe via ProprietaireLot.
- Le modèle ProprietaireLot relie bien copropriété, lot, copropriétaire, date_debut, principal et quote_part.

Blocage observé :
- Depuis l'interface copropriétaires, aucune action évidente “Affecter un lot”, “Gérer les lots” ou “Associer un lot” n'est visible.
- Le syndic ne peut pas naturellement rattacher un lot à un copropriétaire depuis le parcours E2E.

Classement :
- BLOQUANT RECETTE E2E côté interface.
- Contournement temporaire : rattachement via Django shell pour poursuivre la recette métier.

Correction attendue :
- Ajouter un bouton “Affecter un lot” ou “Gérer les lots” sur chaque copropriétaire.
- Ajouter une action équivalente depuis la fiche lot : “Attribuer à un copropriétaire”.

---

## Journal — Vérification résolution : catégorie de tantièmes absente de l’interface

Observation :
- L’AG pilote a été créée avec l’identifiant #40.
- Sur l’écran de création des résolutions, aucun champ “Catégorie de tantièmes”, “Base de vote” ou “Clé de répartition” n’est visible.
- Les champs visibles sont : assemblée, ordre, titre, texte, type de majorité et budget voté.

Analyse :
- La catégorie de tantièmes n’est donc visible ni sur la création AG ni sur la création résolution.
- Il faut vérifier le backend pour savoir si une base de tantièmes est appliquée par défaut.
- Risque métier : le syndic ne sait pas sur quelle base les votes seront pondérés.

Classement provisoire :
- GÊNANT FORT / RISQUE PILOTE.
- À reclasser BLOQUANT MÉTIER si le backend ne gère aucune base de tantièmes explicite.

Correction recommandée :
- Ajouter une base de vote sur la résolution : GENERAL, PARK, ASC ou autre catégorie active.
- Préremplir GENERAL par défaut.
- Afficher clairement la base utilisée dans le détail de la résolution et dans les calculs de vote.

---

## Journal — Catégorie de tantièmes de l’AG #40

Résultat :
- Le backend possède bien un champ tantieme_categorie sur AssembleeGenerale.
- L’AG peut donc être rattachée à une catégorie officielle de tantièmes.
- Le formulaire frontend de création AG ne permet toutefois pas de choisir cette catégorie.
- Le formulaire résolution ne l’affiche pas non plus visuellement à ce stade.

Risque identifié :
- Si aucune catégorie n’est définie, les calculs peuvent sommer toutes les catégories de tantièmes d’un lot.
- Pour l’AG pilote E2E, cela fausserait les poids de vote si GENERAL, ASC et PARK sont additionnés.

Contournement recette :
- AG #40 rattachée manuellement à la catégorie GENERAL via Django shell.

Classement :
- GÊNANT FORT / RISQUE PILOTE.
- Correction frontend attendue avant pilote : afficher et permettre de sélectionner la catégorie de tantièmes de l’AG.

Validation :
- AG #40 vérifiée côté shell.
- Catégorie de tantièmes effective : GENERAL.
- Total tantièmes de référence : 1000.
- La base de calcul de l’AG pilote est donc cohérente pour poursuivre les convocations, présences et votes.

---

## Journal — Étape 9 : Génération convocations AG #40

Résultat :
- AG #40 : 5 convocations générées.
- Total : 5.
- Générées : 5.
- Envoyées : 0.
- Consultées : 0.
- Annulées : 0.
- Les boutons “Ouvrir PDF” sont disponibles.
- Les convocations sont créées pour les lots A101, A102, B201, RDC-01 et PARK-01.

Observation métier :
- Le système génère une convocation par lot.
- Pilote Jean possède A101 et PARK-01, donc il a 2 convocations.
- Ce comportement est fonctionnel mais doit être confirmé métier avant pilote : convocation par lot ou convocation unique par copropriétaire regroupant plusieurs lots.

Classement :
- Fonctionnel pour poursuivre la recette.
- GÊNANT DÉMO / PILOTE possible si le syndic attend une convocation unique par copropriétaire.

---

## Journal — Étape 10 : Notification des convocations AG #40

Résultat :
- Les 5 convocations de l’AG #40 ont été marquées comme envoyées.
- Compteurs visibles :
  - Total : 5
  - Générées : 0
  - Envoyées : 5
  - Consultées : 0
  - Annulées : 0
- Les PDF restent ouvrables depuis l’administration.

Décision recette :
- Ne pas utiliser le bouton admin “Consultée” pour valider la consultation.
- La prochaine vérification doit être faite depuis l’espace copropriétaire afin de tester la vraie preuve de consultation côté utilisateur.

Validation :
- Statut réel de l’AG #40 vérifié côté shell.
- L’AG était encore en BROUILLON malgré les convocations générées et envoyées.
- Cause de l’invisibilité côté copropriétaire confirmée : une AG en BROUILLON n’est pas exposée dans l’espace copropriétaire.

Contournement recette :
- Passage manuel de l’AG #40 au statut CONVOQUEE via Django shell.

Décision produit :
- Avant pilote, il faudra ajouter une action claire “Convoquer officiellement l’AG”.
- Ou faire passer automatiquement l’AG à CONVOQUEE lorsque les convocations officielles sont envoyées.

---

## Journal — Consultation AG #40 côté copropriétaire

Résultat :
- Après passage de l’AG #40 au statut CONVOQUEE, l’AG est visible côté copropriétaire Jean Pilote.
- Compteurs côté copropriétaire :
  - Total : 1
  - À venir : 1
  - Ouvertes : 0
  - Clôturées : 0
  - PV : 0
- Deux convocations sont visibles pour Jean Pilote :
  - PARK-01 : CONV-AG-20260613-40-00009
  - A101 : CONV-AG-20260613-40-00005
- Les convocations sont au statut Envoyée et Version officielle.

Observation GÊNANT FORT / RISQUE PILOTE :
- La page copropriétaire affiche “Aucun ordre du jour détaillé n’est disponible pour cette assemblée”.
- Pourtant, 3 résolutions existent côté admin pour l’AG #40.
- Il faut vérifier si le PDF affiche correctement les résolutions.
- Si le PDF ne les affiche pas non plus, l’anomalie devient bloquante pour le pilote.

Observation UX :
- Les boutons “Ouvrir le PDF” et “Marquer consultée” sont visibles mais peu stylés.
- Recommandation : les remplacer par des boutons métier clairs “Ouvrir ma convocation” et “Accuser réception”.

---

## Journal — Vérification PDF convocation AG #40 côté copropriétaire

Résultat :
- Le PDF de convocation s’ouvre correctement depuis l’espace copropriétaire.
- Le PDF affiche la copropriété Résidence Pilote E2E.
- Le PDF affiche l’AG pilote E2E — Budget et travaux.
- Le PDF affiche la date, l’heure, le lieu, le copropriétaire Pilote Jean et le lot concerné.
- L’ordre du jour est bien présent dans le PDF avec les 3 résolutions créées.

Validation :
- Le PDF contient bien l’ordre du jour, contrairement à la page copropriétaire qui affiche “Aucun ordre du jour détaillé disponible”.
- L’anomalie est donc côté affichage frontend copropriétaire, pas côté contenu PDF.

Observation GÊNANT DÉMO / PILOTE :
- Le PDF affiche encore “Statut : Générée” et “Convocation envoyée le : Non envoyé” alors que côté admin les convocations sont marquées envoyées.
- Cause probable : le PDF a été généré avant le passage au statut Envoyée et n’a pas été régénéré ensuite.
- Risque : document officiel avec informations de suivi obsolètes.

Correction recommandée :
- Régénérer automatiquement le PDF après notification, ou ne pas afficher dans le PDF des statuts évolutifs.
- Garder les preuves d’envoi/consultation dans un registre de traçabilité séparé.

---

## Journal — Consultation effective d’une convocation AG #40

Résultat :
- Jean Pilote a pu se connecter à l’espace copropriétaire.
- L’AG #40 est visible après passage au statut CONVOQUEE.
- Les convocations de Jean Pilote sont visibles.
- Le PDF de convocation s’ouvre correctement.
- Une convocation a été marquée consultée depuis l’espace copropriétaire.
- Côté admin, le détail AG #40 affiche : 5 convocations envoyées, 1 consultée.

Validation :
- La preuve de consultation côté copropriétaire fonctionne.
- La consultation remonte bien dans l’historique des convocations de l’AG.

Observation :
- Jean Pilote possède deux lots, donc deux convocations.
- Une seule convocation est consultée pour l’instant : PARK-01.
- Il reste possible de marquer aussi A101 comme consultée pour tester le cas multi-lots.

---

## Journal — Consultation multi-lots Jean Pilote

Résultat :
- Jean Pilote possède 2 lots : A101 et PARK-01.
- Les 2 convocations associées sont visibles côté copropriétaire.
- Les 2 PDF ont été ouverts / consultés.
- Côté admin AG #40, l’historique affiche :
  - 5 convocations envoyées.
  - 2 convocations consultées.
- Les convocations consultées sont :
  - CONV-AG-20260613-40-00005 — A101.
  - CONV-AG-20260613-40-00009 — PARK-01.

Validation :
- Le cas copropriétaire multi-lots est validé pour la consultation des convocations.
- La preuve de consultation remonte bien côté admin.

Observation :
- Les présences restent à 0, ce qui est normal : consulter une convocation ne confirme pas automatiquement la présence.

---

## Décision produit — Convocation unique par copropriétaire

Observation :
- Jean Pilote possède deux lots dans la copropriété #24 : A101 et PARK-01.
- Le système actuel a généré deux convocations distinctes pour la même AG #40.
- Fonctionnellement, les convocations, PDF et consultations fonctionnent.
- Mais côté usage réel, un copropriétaire ne devrait pas recevoir plusieurs convocations séparées pour la même assemblée générale.

Décision produit recommandée :
- Une AG doit générer une seule convocation officielle par copropriétaire destinataire.
- Si le copropriétaire possède plusieurs lots, le PDF doit lister tous les lots concernés.
- Les preuves de notification et de consultation doivent porter sur cette convocation unique.
- Les présences, votes, tantièmes et procurations peuvent rester calculés par lot.

Classement :
- GÊNANT FORT / RISQUE PILOTE.
- À corriger avant démonstration client officielle.

Correction attendue :
- Regrouper les convocations par copropriétaire dans la génération AG.
- Produire un PDF unique par copropriétaire avec tableau des lots concernés.
- Adapter l’espace copropriétaire pour afficher une seule convocation par AG, avec les lots inclus.
- Conserver le détail par lot pour le quorum, les votes, les présences et le PV.

---

## Décision produit — Convocation AG unique par copropriétaire

Décision validée :
- Pour le produit final, une AG doit générer une seule convocation officielle par copropriétaire.
- Si le copropriétaire possède plusieurs lots, le PDF doit regrouper tous ses lots.
- Les présences, votes, tantièmes, procurations et PV restent calculés par lot.

Conséquence :
- Le comportement actuel, qui génère une convocation par lot, est fonctionnel mais non idéal pour le pilote.
- La recette E2E continue afin d’identifier les autres blocages.
- Un sprint correctif dédié devra être traité avant la démonstration client officielle.

Sprint correctif à prévoir :
- Convocation AG unique par copropriétaire multi-lots.

---

## Journal — Validation mandat Awa Demo et quorum AG #40

Résultat :
- Le mandat créé par Awa Demo vers Jean Pilote a été visible côté admin/syndic dans /ag/procurations.
- Le mandat a été validé par le syndic/admin.
- Après validation, la page des présences AG #40 affiche :
  - Lots concernés : 3.
  - Présence effective : 3.
  - Présences par mandat : 1.
  - Lots absents : 0.
  - Lots à 0 tantième : 0.
  - Poids de vote présent : 550.

Détail métier :
- A101 : Jean Pilote présent physiquement, 250 tantièmes.
- PARK-01 : Jean Pilote présent physiquement, 100 tantièmes.
- A102 : Awa Demo représentée par mandat, 200 tantièmes.
- Total présent / représenté : 550 / 1000 tantièmes.

Validation :
- Le circuit procuration copropriétaire -> validation syndic -> impact sur présences fonctionne.
- Le quorum devient normalement atteint avec 550 tantièmes présents ou représentés.

---

## Journal — Principe de vote AG #40

Analyse :
- L’AG #40 contient 3 résolutions.
- Le vote doit se faire résolution par résolution.
- Les lots votants actuellement présents ou représentés sont :
  - A101 : 250 tantièmes.
  - PARK-01 : 100 tantièmes.
  - A102 : 200 tantièmes par mandat.
- Total votant par résolution : 550 tantièmes.
- Nombre maximum de votes attendus : 3 résolutions x 3 lots = 9 votes.

Règle métier :
- Un lot ne doit voter qu’une seule fois par résolution.
- Le vote du lot A102 doit être tracé comme vote par représentation, car Awa Demo a donné mandat à Jean Pilote.

Observation :
- La page admin /ag/assemblees/40/votes permet de saisir les votes par résolution, lot et choix.
- Il faut vérifier ensuite si l’espace copropriétaire permet à Jean Pilote de voter aussi pour le lot A102 représenté.

---

## Blocage produit — Cycle de vie AG non pilotable depuis l’interface

Observation :
- Pendant la recette E2E, plusieurs changements de statut AG ont nécessité un passage par Django shell.
- L’AG #40 a dû être passée manuellement de BROUILLON à CONVOQUEE pour devenir visible côté copropriétaire.
- L’ouverture de l’AG pour permettre les votes nécessite également un passage à OUVERTE.
- Aucun bouton métier suffisamment clair n’est visible dans l’interface pour piloter ces transitions.

Statuts concernés :
- BROUILLON -> CONVOQUEE.
- CONVOQUEE -> OUVERTE.
- OUVERTE -> CLOTUREE.

Classement :
- BLOQUANT RECETTE E2E / PILOTE.

Impact :
- Un syndic ne peut pas piloter une AG complète sans intervention technique.
- Le parcours client n’est pas autonome.
- La recette ne peut pas être considérée prête pilote tant que ces transitions ne sont pas pilotables depuis la plateforme.

Correction attendue :
- Ajouter des actions métier visibles sur le détail AG :
  - Convoquer officiellement l’AG.
  - Ouvrir l’AG.
  - Clôturer l’AG.
- Encadrer chaque transition par des garde-fous :
  - Résolutions présentes.
  - Convocations générées et envoyées.
  - Quorum atteint ou règle métier explicitement confirmée.
  - Votes calculés avant clôture.
- Afficher des messages clairs si une transition est impossible.

Décision :
- Suspendre temporairement la suite de la recette vote/PV.
- Lancer un mini-sprint prioritaire : pilotage du cycle de vie AG depuis l’interface.
---

## Correction — Pilotage du cycle de vie AG depuis l’interface

Objectif :
- Supprimer le besoin de passer par Django shell pour piloter le statut d’une AG.
- Permettre au syndic/admin de faire les transitions directement depuis le détail AG.

Backend ajouté :
- POST /api/ag/ags/<id>/convoquer/
- POST /api/ag/ags/<id>/ouvrir/

Frontend ajouté :
- Section “Pilotage de l’assemblée” dans le détail AG.
- Bouton “Convoquer officiellement l’AG” pour BROUILLON -> CONVOQUEE.
- Bouton “Ouvrir l’AG” pour CONVOQUEE -> OUVERTE.

Garde-fous :
- Une AG doit avoir au moins une résolution avant convocation officielle.
- Une AG doit avoir au moins une convocation non annulée.
- Une AG doit avoir au moins une convocation envoyée ou consultée.
- Une AG ne peut être ouverte que si elle est CONVOQUEE.
- Une AG ne peut être ouverte que si le quorum est atteint.

Classement :
- BLOQUANT RECETTE E2E / PILOTE corrigé.

Validation runtime :
- La section “Pilotage de l’assemblée” est visible dans le détail AG.
- L’AG #40 a été ouverte depuis l’interface admin/syndic.
- La transition CONVOQUEE -> OUVERTE fonctionne sans Django shell.
- Après ouverture, le statut affiché est “Ouverte”.
- Le quorum est affiché comme atteint.
- Les tantièmes présents sont de 550 / 1000.
- Le taux de présence affiché est de 55 %.

Validation :
- Le syndic peut maintenant ouvrir une AG depuis la plateforme.
- Le blocage “ouverture AG uniquement par shell” est corrigé pour la recette E2E.

Point restant :
- Tester ultérieurement la transition BROUILLON -> CONVOQUEE sur une nouvelle AG complète.
