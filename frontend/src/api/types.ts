// src/api/types.ts

// =========================
// Helpers génériques
// =========================
export type Id = number | string;

export type ApiNullable<T> = T | null | undefined;

export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

// =========================
// COMPTA — Imports CSV
// =========================
export type ImportCsvResponse = {
  import_id: number;
  hash_unique?: string;
  encoding?: string;
  delimiter?: string;
  nb_lignes?: number;
  nb_crees?: number;
  nb_ignores?: number;
  nb_ignores_doublons?: number;
  nb_ignores_invalides?: number;
  detail?: string | Record<string, unknown>;
};

export type ReleveImport = {
  id: number;
  copropriete?: number;
  fichier?: string | null;
  fichier_nom?: string | null;
  hash_unique?: string | null;
  encoding?: string | null;
  delimiter?: string | null;
  nb_lignes?: number | null;
  nb_crees?: number | null;
  nb_ignores?: number | null;
  created_at?: string | null;
  created_by?: number | string | null;
};

// =========================
// COMPTA — Lignes importées
// =========================
export type ReleveLigne = {
  id: number;
  releve_import?: number;
  copropriete?: number;
  statut?: string;
  date_operation?: string;
  date_valeur?: string | null;
  libelle?: string;
  reference?: string;
  sens?: "CREDIT" | "DEBIT" | string;
  montant?: string | number;
  solde?: string | null;
  rapprochement?: unknown | null;
  created_at?: string;
};

export type Suggestion = {
  type_cible?: string;
  cible_id?: number;
  score?: number;
  reason?: string;
  label?: string;
  montant?: string | number;
  date?: string;
  payload?: unknown;
} & Record<string, unknown>;

// =========================
// COMPTA — Mouvements
// =========================
export type MouvementItem = {
  id: number;
  copropriete?: number;
  compte?: number;
  sens: "CREDIT" | "DEBIT" | string;
  montant: string | number;
  date_operation: string;
  reference?: string | null;
  libelle?: string | null;
  note?: string | null;
  is_rapproche?: boolean;
  created_at?: string;
  rapprochement_id?: number | null;
  releve_ligne_id?: number | null;
  releve_import_id?: number | null;
};

export type ComptaDashboardTotals = {
  revenus?: number | null;
  depenses?: number | null;
  solde?: number | null;
  total_credit?: number | null;
  total_debit?: number | null;
  nb_non_rapproches?: number | null;
  series_days?: number | null;
};

export type ComptaDashboardSeriesPoint = {
  date: string;
  credit?: number;
  debit?: number;
  net?: number;
  cumul_net?: number;
};

export type ComptaDashboardResponse = {
  totaux?: ComptaDashboardTotals;
  comptes?: unknown[];
  series?: ComptaDashboardSeriesPoint[];
};

export type RapproStats = Record<string, unknown>;

// =========================
// RH — Référentiels
// =========================
export type RoleEmploye =
  | "GARDIEN"
  | "AGENT_ENTRETIEN"
  | "EMPLOYE"
  | "ASSISTANT"
  | "COMPTABLE"
  | "TECHNICIEN"
  | "RESPONSABLE"
  | "SYNDIC"
  | string;

export type TypeContrat = "CDI" | "CDD" | string;

// =========================
// RH — Employés
// =========================
export type EmployeStatut = "ACTIF" | "INACTIF" | "SUSPENDU" | string;

export type Employe = {
  id: number;
  copropriete?: number;
  nom: string;
  prenoms: string;
  role: RoleEmploye;
  telephone?: string | null;
  email?: string | null;
  date_embauche?: string | null;
  salaire_base?: number | null;
  statut: EmployeStatut;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type EmployePayload = {
  nom: string;
  prenoms: string;
  role: RoleEmploye;
  telephone?: string | null;
  email?: string | null;
  date_embauche?: string | null;
  salaire_base?: number | null;
  statut?: EmployeStatut;
  notes?: string | null;
};

// =========================
// RH — Contrats
// =========================
export type ContratStatut = "ACTIF" | "TERMINE" | "BROUILLON" | string;

/**
 * Cas possibles côté API :
 * - employe = number
 * - employe = objet enrichi
 * - employe_detail = objet enrichi (si le backend évolue plus tard)
 */
export type ContratEmploye = {
  id: number;
  employe: number | Employe;
  employe_detail?: Employe | null;
  type_contrat: TypeContrat;
  date_debut: string;
  date_fin?: string | null;
  salaire_mensuel?: number | null;
  statut: ContratStatut;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ContratEmployePayload = {
  employe: number;
  type_contrat: TypeContrat;
  date_debut: string;
  date_fin?: string | null;
  salaire_mensuel?: number | null;
  statut?: ContratStatut;
  notes?: string | null;
};