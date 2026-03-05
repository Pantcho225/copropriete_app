export type ImportCsvResponse = {
  import_id: number;
  nb_lignes?: number;
  nb_crees?: number;
  nb_ignores?: number;
};

export type Paginated<T> = {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: T[];
};

export type ReleveLigne = {
  id: number;
  statut: string;
  date_operation: string;
  libelle: string;
  reference: string;
  sens: string;
  montant: string;
  rapprochement: any | null;
};

export type Suggestion = {
  type_cible: string;
  cible_id: number;
  score?: number;
  reason?: string;
};

export type RapproStats = Record<string, any>;