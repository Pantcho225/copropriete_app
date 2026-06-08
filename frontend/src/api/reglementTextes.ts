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

export type CoproprietaireReglementTexte = {
  id: number;
  titre: string;
  categorie: ReglementTexteCategorie;
  categorie_label: string;
  resume: string;
  contenu: string;
  fichier_url: string;
  filename: string;
  statut: ReglementTexteStatut;
  statut_label: string;
  date_publication: string | null;
  publie_par_label: string;
  ordre_affichage: number;
  created_at: string;
  updated_at: string;
};

export type ReglementTexteListResponse =
  | CoproprietaireReglementTexte[]
  | {
      count?: number;
      results?: CoproprietaireReglementTexte[];
      data?: CoproprietaireReglementTexte[];
    };

function normalizeReglementTextesResponse(
  payload: ReglementTexteListResponse,
): CoproprietaireReglementTexte[] {
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

export async function getCoproprietaireReglementTextes(params?: {
  categorie?: ReglementTexteCategorie | "";
  q?: string;
}): Promise<CoproprietaireReglementTexte[]> {
  const response = await api.get<ReglementTexteListResponse>(
    "/api/documents/coproprietaire/reglement-textes/",
    {
      params: {
        categorie: params?.categorie || undefined,
        q: params?.q || undefined,
      },
    },
  );

  return normalizeReglementTextesResponse(response.data);
}