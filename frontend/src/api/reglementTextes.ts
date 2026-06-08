// frontend/src/api/reglementTextes.ts
import api from "./axios";

export type ReglementTexteCategorie =
  | "REGLEMENT_COPROPRIETE"
  | "REGLEMENT_INTERIEUR"
  | "TEXTE_LOI"
  | "NOTE_SYNDIC"
  | "VIE_COMMUNE"
  | "CHARGES_COTISATIONS"
  | "ASSEMBLEES_GENERALES"
  | "TRAVAUX_ENTRETIEN"
  | "DOCUMENT_ADMINISTRATIF"
  | "AUTRE";

export type ReglementTexteStatut = "BROUILLON" | "PUBLIE" | "ARCHIVE";

export type ReglementTexteApplicable = {
  id: number;
  copropriete: number;
  copropriete_label: string;

  titre: string;
  categorie: ReglementTexteCategorie | string;
  categorie_label: string;
  resume: string;
  contenu: string;

  fichier: string | null;
  fichier_url: string;
  filename: string;

  statut: ReglementTexteStatut | string;
  statut_label: string;
  visible_coproprietaire: boolean;
  is_published_for_owner: boolean;

  ordre_affichage: number;

  publie_par: number | null;
  publie_par_label: string;
  date_publication: string | null;

  created_by: number | null;
  created_by_label: string;
  updated_by: number | null;
  updated_by_label: string;

  metadata: Record<string, unknown>;

  created_at: string;
  updated_at: string;
};

export type CoproprietaireReglementTexte = {
  id: number;
  titre: string;
  categorie: ReglementTexteCategorie | string;
  categorie_label: string;
  resume: string;
  contenu: string;
  fichier_url: string;
  filename: string;
  statut: ReglementTexteStatut | string;
  statut_label: string;
  date_publication: string | null;
  publie_par_label: string;
  ordre_affichage: number;
  created_at: string;
  updated_at: string;
};

export type ReglementTexteListResponse<T> =
  | T[]
  | {
      count?: number;
      results?: T[];
      data?: T[];
    };

export type ReglementTextePayload = {
  titre: string;
  categorie: ReglementTexteCategorie;
  resume: string;
  contenu: string;
  statut: ReglementTexteStatut;
  visible_coproprietaire: boolean;
  ordre_affichage: number;
  fichier?: File | null;
};

export type ReglementTexteFilters = {
  categorie?: ReglementTexteCategorie | "";
  statut?: ReglementTexteStatut | "";
  visible_coproprietaire?: boolean | "";
  q?: string;
};

function normalizeList<T>(payload: ReglementTexteListResponse<T>): T[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload.results)) {
    return payload.results;
  }

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  return [];
}

function buildFormData(payload: ReglementTextePayload) {
  const formData = new FormData();

  formData.append("titre", payload.titre);
  formData.append("categorie", payload.categorie);
  formData.append("resume", payload.resume);
  formData.append("contenu", payload.contenu);
  formData.append("statut", payload.statut);
  formData.append(
    "visible_coproprietaire",
    payload.visible_coproprietaire ? "true" : "false",
  );
  formData.append("ordre_affichage", String(payload.ordre_affichage));

  if (payload.fichier) {
    formData.append("fichier", payload.fichier);
  }

  return formData;
}

// =========================================================
// Admin / Syndic — textes réglementaires
// =========================================================

export async function getReglementTextesApplicables(
  filters?: ReglementTexteFilters,
) {
  const response = await api.get<ReglementTexteListResponse<ReglementTexteApplicable>>(
    "/api/documents/reglement-textes/",
    {
      params: {
        categorie: filters?.categorie || undefined,
        statut: filters?.statut || undefined,
        visible_coproprietaire:
          typeof filters?.visible_coproprietaire === "boolean"
            ? filters.visible_coproprietaire
            : undefined,
        q: filters?.q || undefined,
      },
    },
  );

  return normalizeList(response.data);
}

export async function createReglementTexteApplicable(
  payload: ReglementTextePayload,
) {
  const formData = buildFormData(payload);

  const response = await api.post<ReglementTexteApplicable>(
    "/api/documents/reglement-textes/",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );

  return response.data;
}

export async function updateReglementTexteApplicable(
  id: number | string,
  payload: ReglementTextePayload,
) {
  const formData = buildFormData(payload);

  const response = await api.patch<ReglementTexteApplicable>(
    `/api/documents/reglement-textes/${id}/`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );

  return response.data;
}

export async function publierReglementTexteApplicable(id: number | string) {
  const response = await api.post<ReglementTexteApplicable>(
    `/api/documents/reglement-textes/${id}/publier/`,
  );

  return response.data;
}

export async function archiverReglementTexteApplicable(id: number | string) {
  const response = await api.post<ReglementTexteApplicable>(
    `/api/documents/reglement-textes/${id}/archiver/`,
  );

  return response.data;
}

export async function rendreVisibleReglementTexteApplicable(id: number | string) {
  const response = await api.post<ReglementTexteApplicable>(
    `/api/documents/reglement-textes/${id}/rendre-visible/`,
  );

  return response.data;
}

export async function masquerReglementTexteApplicable(id: number | string) {
  const response = await api.post<ReglementTexteApplicable>(
    `/api/documents/reglement-textes/${id}/masquer-coproprietaire/`,
  );

  return response.data;
}

export async function deleteReglementTexteApplicable(id: number | string) {
  const response = await api.delete(`/api/documents/reglement-textes/${id}/`);

  return response.data;
}

// =========================================================
// Copropriétaire — lecture seule
// =========================================================

export async function getCoproprietaireReglementTextes(params?: {
  categorie?: ReglementTexteCategorie | "";
  q?: string;
}) {
  const response = await api.get<
    ReglementTexteListResponse<CoproprietaireReglementTexte>
  >("/api/documents/coproprietaire/reglement-textes/", {
    params: {
      categorie: params?.categorie || undefined,
      q: params?.q || undefined,
    },
  });

  return normalizeList(response.data);
}