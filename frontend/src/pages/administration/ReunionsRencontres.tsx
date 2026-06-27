import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";

import api from "../../api/axios";
import { ENDPOINTS } from "../../api/endpoints";

type LoadState = "idle" | "loading" | "success" | "error";

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type ReunionItem = {
  id: number;
  type: string;
  type_label?: string;
  statut: string;
  statut_label?: string;
  titre: string;
  reference?: string;
  objet?: string;
  description?: string;
  date_debut: string;
  date_fin?: string | null;
  lieu?: string;
  compte_rendu?: string;
  decisions?: string;
  visible_coproprietaire: boolean;
  date_publication?: string | null;
  is_published_for_owner?: boolean;
  participants_count?: number;
  documents_count?: number;
  actions_count?: number;
  participants?: ParticipantItem[];
  documents?: ReunionDocumentItem[];
  actions?: ReunionActionItem[];
};

type ParticipantItem = {
  id: number;
  reunion: number;
  type: string;
  type_label?: string;
  nom_complet: string;
  organisation?: string;
  fonction?: string;
  email?: string;
  telephone?: string;
  present: boolean;
};

type ReunionDocumentItem = {
  id: number;
  reunion: number;
  type: string;
  type_label?: string;
  titre: string;
  description?: string;
  download_url?: string;
  filename?: string;
  visible_coproprietaire: boolean;
};

type ReunionActionItem = {
  id: number;
  reunion: number;
  titre: string;
  description?: string;
  statut: string;
  statut_label?: string;
  priorite: string;
  priorite_label?: string;
  responsable_nom?: string;
  echeance?: string | null;
};

type ReunionForm = {
  type: string;
  statut: string;
  titre: string;
  reference: string;
  objet: string;
  description: string;
  date_debut: string;
  date_fin: string;
  lieu: string;
  compte_rendu: string;
  decisions: string;
  visible_coproprietaire: boolean;
};

type ParticipantForm = {
  type: string;
  nom_complet: string;
  organisation: string;
  fonction: string;
  email: string;
  telephone: string;
  present: boolean;
};

type ActionForm = {
  titre: string;
  description: string;
  statut: string;
  priorite: string;
  responsable_nom: string;
  echeance: string;
};

type DocumentForm = {
  type: string;
  titre: string;
  description: string;
  visible_coproprietaire: boolean;
};

const reunionTypes = [
  ["REUNION_INTERNE", "Réunion interne"],
  ["INFORMATION_CONCERTATION", "Information / concertation"],
  ["RENCONTRE_FOURNISSEUR", "Rencontre fournisseur"],
  ["RENCONTRE_AUTORITE", "Rencontre autorité"],
  ["AUTRE", "Autre"],
];

const reunionStatuts = [
  ["BROUILLON", "Brouillon"],
  ["PROGRAMMEE", "Programmée"],
  ["TENUE", "Tenue"],
  ["ANNULEE", "Annulée"],
];

const participantTypes = [
  ["INTERNE", "Interne"],
  ["COPROPRIETAIRE", "Copropriétaire"],
  ["OCCUPANT", "Occupant / résident"],
  ["PRESTATAIRE", "Prestataire"],
  ["AUTORITE", "Autorité / administration"],
  ["AUTRE", "Autre"],
];

const documentTypes = [
  ["ORDRE_DU_JOUR", "Ordre du jour"],
  ["COMPTE_RENDU", "Compte rendu"],
  ["PV_SIMPLE", "PV simple"],
  ["COURRIER", "Courrier"],
  ["NOTE", "Note"],
  ["PIECE_JOINTE", "Pièce jointe"],
  ["AUTRE", "Autre"],
];

const actionStatuts = [
  ["A_FAIRE", "À faire"],
  ["EN_COURS", "En cours"],
  ["TERMINEE", "Terminée"],
  ["ANNULEE", "Annulée"],
];

const actionPriorites = [
  ["BASSE", "Basse"],
  ["NORMALE", "Normale"],
  ["HAUTE", "Haute"],
];

function nowLocalDatetime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

function isPaginated<T>(value: unknown): value is Paginated<T> {
  return Boolean(
    value &&
      typeof value === "object" &&
      Array.isArray((value as Paginated<T>).results),
  );
}

function normalizeList<T>(value: Paginated<T> | T[] | unknown): T[] {
  if (isPaginated<T>(value)) return value.results;
  if (Array.isArray(value)) return value as T[];
  return [];
}

function getErrorMessage(error: unknown, fallback: string) {
  const err = error as {
    response?: { data?: Record<string, unknown> };
    message?: string;
  };

  const data = err.response?.data;

  if (data) {
    if (typeof data.detail === "string") return data.detail;

    const entries = Object.entries(data);
    if (entries.length) {
      return entries
        .map(([key, value]) => {
          if (Array.isArray(value)) return `${key}: ${value.join(" / ")}`;
          if (typeof value === "string") return `${key}: ${value}`;
          return `${key}: ${JSON.stringify(value)}`;
        })
        .join("\n");
    }
  }

  return err.message || fallback;
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleString("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }

  return String(value);
}

function StatusBadge({ statut }: { statut: string }) {
  const normalized = statut.toUpperCase();

  const style =
    normalized === "PUBLIEE"
      ? badgeSuccess
      : normalized === "TENUE"
        ? badgeInfo
        : normalized === "ANNULEE" || normalized === "ARCHIVEE"
          ? badgeDanger
          : normalized === "PROGRAMMEE"
            ? badgeWarning
            : badgeNeutral;

  const label =
    normalized === "PUBLIEE"
      ? "Publiée"
      : normalized === "TENUE"
        ? "Tenue"
        : normalized === "PROGRAMMEE"
          ? "Programmée"
          : normalized === "ARCHIVEE"
            ? "Archivée"
            : normalized === "ANNULEE"
              ? "Annulée"
              : "Brouillon";

  return <span style={{ ...badgeBase, ...style }}>{label}</span>;
}

function StatCard(props: { title: string; value: string; subtitle: string }) {
  return (
    <div style={statCard}>
      <div style={statTitle}>{props.title}</div>
      <div style={statValue}>{props.value}</div>
      <div style={statSubtitle}>{props.subtitle}</div>
    </div>
  );
}

const initialReunionForm: ReunionForm = {
  type: "REUNION_INTERNE",
  statut: "BROUILLON",
  titre: "",
  reference: "",
  objet: "",
  description: "",
  date_debut: nowLocalDatetime(),
  date_fin: "",
  lieu: "",
  compte_rendu: "",
  decisions: "",
  visible_coproprietaire: false,
};

const initialParticipantForm: ParticipantForm = {
  type: "AUTRE",
  nom_complet: "",
  organisation: "",
  fonction: "",
  email: "",
  telephone: "",
  present: false,
};

const initialActionForm: ActionForm = {
  titre: "",
  description: "",
  statut: "A_FAIRE",
  priorite: "NORMALE",
  responsable_nom: "",
  echeance: "",
};

const initialDocumentForm: DocumentForm = {
  type: "PIECE_JOINTE",
  titre: "",
  description: "",
  visible_coproprietaire: false,
};

export default function ReunionsRencontres() {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [actionState, setActionState] = useState<LoadState>("idle");

  const [reunions, setReunions] = useState<ReunionItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [typeFilter, setTypeFilter] = useState("");
  const [statutFilter, setStatutFilter] = useState("");
  const [query, setQuery] = useState("");

  const [form, setForm] = useState<ReunionForm>(initialReunionForm);
  const [participantForm, setParticipantForm] =
    useState<ParticipantForm>(initialParticipantForm);
  const [actionForm, setActionForm] = useState<ActionForm>(initialActionForm);
  const [documentForm, setDocumentForm] = useState<DocumentForm>(initialDocumentForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  const isBusy = loadState === "loading" || actionState === "loading";

  const selectedReunion = useMemo(
    () => reunions.find((item) => item.id === selectedId) ?? null,
    [reunions, selectedId],
  );

  const showMessage = useCallback((type: "success" | "error", value: string) => {
    setMessageType(type);
    setMessage(value);
  }, []);

  const loadData = useCallback(async () => {
    setLoadState("loading");
    setMessage("");

    try {
      const params: Record<string, string> = {};
      if (typeFilter) params.type = typeFilter;
      if (statutFilter) params.statut = statutFilter;
      if (query.trim()) params.q = query.trim();

      const response = await api.get<Paginated<ReunionItem> | ReunionItem[]>(
        ENDPOINTS.reunionsRencontres,
        { params },
      );

      const nextReunions = normalizeList<ReunionItem>(response.data);
      setReunions(nextReunions);

      setSelectedId((current) => {
        if (current && nextReunions.some((item) => item.id === current)) {
          return current;
        }

        return nextReunions[0]?.id ?? null;
      });

      setLoadState("success");
    } catch (error) {
      setLoadState("error");
      showMessage(
        "error",
        getErrorMessage(error, "Impossible de charger les réunions et rencontres."),
      );
    }
  }, [query, showMessage, statutFilter, typeFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadData]);

  const stats = useMemo(() => {
    const total = reunions.length;
    const publiees = reunions.filter((item) => item.statut === "PUBLIEE").length;
    const programmees = reunions.filter((item) => item.statut === "PROGRAMMEE").length;
    const actions = reunions.reduce(
      (sum, item) => sum + Number(item.actions_count ?? item.actions?.length ?? 0),
      0,
    );

    return { total, publiees, programmees, actions };
  }, [reunions]);

  const createReunion = useCallback(async () => {
    if (!form.titre.trim()) {
      showMessage("error", "Saisissez le titre de la réunion.");
      return;
    }

    if (!form.date_debut) {
      showMessage("error", "Saisissez la date de début.");
      return;
    }

    setActionState("loading");

    try {
      const payload = {
        type: form.type,
        statut: form.statut,
        titre: form.titre.trim(),
        reference: form.reference.trim(),
        objet: form.objet.trim(),
        description: form.description.trim(),
        date_debut: form.date_debut,
        date_fin: form.date_fin || null,
        lieu: form.lieu.trim(),
        compte_rendu: form.compte_rendu.trim(),
        decisions: form.decisions.trim(),
        visible_coproprietaire: form.visible_coproprietaire,
      };

      const response = await api.post<ReunionItem>(ENDPOINTS.reunionsRencontres, payload);

      setForm({
        ...initialReunionForm,
        date_debut: nowLocalDatetime(),
      });
      setSelectedId(response.data.id);
      showMessage("success", "Réunion / rencontre créée.");
      await loadData();
      setActionState("success");
    } catch (error) {
      setActionState("error");
      showMessage(
        "error",
        getErrorMessage(error, "Impossible de créer la réunion."),
      );
    }
  }, [form, loadData, showMessage]);

  const patchSelectedReunion = useCallback(
    async (payload: Partial<ReunionItem>, successMessage: string) => {
      if (!selectedReunion) {
        showMessage("error", "Sélectionnez une réunion.");
        return;
      }

      setActionState("loading");

      try {
        await api.patch(ENDPOINTS.reunionRencontreDetail(selectedReunion.id), payload);
        showMessage("success", successMessage);
        await loadData();
        setActionState("success");
      } catch (error) {
        setActionState("error");
        showMessage("error", getErrorMessage(error, "Impossible de modifier la réunion."));
      }
    },
    [loadData, selectedReunion, showMessage],
  );

  const publishSelected = useCallback(async () => {
    if (!selectedReunion) {
      showMessage("error", "Sélectionnez une réunion.");
      return;
    }

    setActionState("loading");

    try {
      await api.post(ENDPOINTS.reunionRencontrePublier(selectedReunion.id), {});
      showMessage("success", "Réunion publiée côté copropriétaire.");
      await loadData();
      setActionState("success");
    } catch (error) {
      setActionState("error");
      showMessage(
        "error",
        getErrorMessage(
          error,
          "Impossible de publier. Ajoutez un compte rendu ou un document visible.",
        ),
      );
    }
  }, [loadData, selectedReunion, showMessage]);

  const archiveSelected = useCallback(async () => {
    if (!selectedReunion) {
      showMessage("error", "Sélectionnez une réunion.");
      return;
    }

    setActionState("loading");

    try {
      await api.post(ENDPOINTS.reunionRencontreArchiver(selectedReunion.id), {});
      showMessage("success", "Réunion archivée.");
      await loadData();
      setActionState("success");
    } catch (error) {
      setActionState("error");
      showMessage("error", getErrorMessage(error, "Impossible d’archiver."));
    }
  }, [loadData, selectedReunion, showMessage]);

  const createParticipant = useCallback(async () => {
    if (!selectedReunion) {
      showMessage("error", "Sélectionnez une réunion.");
      return;
    }

    if (!participantForm.nom_complet.trim()) {
      showMessage("error", "Saisissez le nom du participant.");
      return;
    }

    setActionState("loading");

    try {
      await api.post(ENDPOINTS.reunionParticipants, {
        reunion: selectedReunion.id,
        type: participantForm.type,
        nom_complet: participantForm.nom_complet.trim(),
        organisation: participantForm.organisation.trim(),
        fonction: participantForm.fonction.trim(),
        email: participantForm.email.trim(),
        telephone: participantForm.telephone.trim(),
        present: participantForm.present,
      });

      setParticipantForm(initialParticipantForm);
      showMessage("success", "Participant ajouté.");
      await loadData();
      setActionState("success");
    } catch (error) {
      setActionState("error");
      showMessage("error", getErrorMessage(error, "Impossible d’ajouter le participant."));
    }
  }, [loadData, participantForm, selectedReunion, showMessage]);

  const createAction = useCallback(async () => {
    if (!selectedReunion) {
      showMessage("error", "Sélectionnez une réunion.");
      return;
    }

    if (!actionForm.titre.trim()) {
      showMessage("error", "Saisissez le titre de l’action.");
      return;
    }

    setActionState("loading");

    try {
      await api.post(ENDPOINTS.reunionActions, {
        reunion: selectedReunion.id,
        titre: actionForm.titre.trim(),
        description: actionForm.description.trim(),
        statut: actionForm.statut,
        priorite: actionForm.priorite,
        responsable_nom: actionForm.responsable_nom.trim(),
        echeance: actionForm.echeance || null,
      });

      setActionForm(initialActionForm);
      showMessage("success", "Action ajoutée.");
      await loadData();
      setActionState("success");
    } catch (error) {
      setActionState("error");
      showMessage("error", getErrorMessage(error, "Impossible d’ajouter l’action."));
    }
  }, [actionForm, loadData, selectedReunion, showMessage]);

  const createDocument = useCallback(async () => {
    if (!selectedReunion) {
      showMessage("error", "Sélectionnez une réunion.");
      return;
    }

    if (!documentForm.titre.trim()) {
      showMessage("error", "Saisissez le titre du document.");
      return;
    }

    if (!selectedFile) {
      showMessage("error", "Ajoutez un fichier.");
      return;
    }

    const payload = new FormData();
    payload.append("reunion", String(selectedReunion.id));
    payload.append("type", documentForm.type);
    payload.append("titre", documentForm.titre.trim());
    payload.append("description", documentForm.description.trim());
    payload.append(
      "visible_coproprietaire",
      documentForm.visible_coproprietaire ? "true" : "false",
    );
    payload.append("fichier", selectedFile);

    setActionState("loading");

    try {
      await api.post(ENDPOINTS.reunionDocuments, payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setDocumentForm(initialDocumentForm);
      setSelectedFile(null);

      const fileInput = document.getElementById("reunion-document-file") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";

      showMessage("success", "Document de réunion ajouté.");
      await loadData();
      setActionState("success");
    } catch (error) {
      setActionState("error");
      showMessage("error", getErrorMessage(error, "Impossible d’ajouter le document."));
    }
  }, [documentForm, loadData, selectedFile, selectedReunion, showMessage]);

  const openDocument = useCallback(async (documentItem: ReunionDocumentItem, download = false) => {
    setActionState("loading");

    try {
      const response = await api.get<Blob>(
        ENDPOINTS.reunionDocumentDownload(documentItem.id),
        {
          responseType: "blob",
          params: { download: download ? 1 : 0 },
        },
      );

      const blobUrl = window.URL.createObjectURL(response.data);
      const filename = documentItem.filename || `${documentItem.titre || "document"}.pdf`;

      if (download) {
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(blobUrl);
      } else {
        window.open(blobUrl, "_blank", "noopener,noreferrer");
        window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
      }

      setActionState("success");
    } catch (error) {
      setActionState("error");
      showMessage("error", getErrorMessage(error, "Impossible d’ouvrir le document."));
    }
  }, [showMessage]);

  return (
    <div className="adminHarmonizedPage adminMeetingsPage" style={styles.page}>
      <section className="adminHarmonizedHero adminHarmonizedHero--cyan" style={styles.hero}>
        <div>
          <p style={styles.eyebrow}>Réunions & rencontres</p>
          <h1 style={styles.title}>Suivre les réunions courantes de la copropriété</h1>
          <p style={styles.subtitle}>
            Créez, documentez, publiez et archivez les réunions du conseil
            syndical, rencontres prestataires, médiations, visites techniques et
            échanges institutionnels sans les confondre avec les Assemblées Générales.
          </p>
        </div>

        <aside className="adminHarmonizedNotice" style={styles.notice}>
          <strong>Séparation métier</strong>
          <span>
            Les AG conservent les convocations, votes, quorum et PV officiel. Ici,
            on historise les échanges opérationnels et les actions à suivre.
          </span>
        </aside>
      </section>

      {message ? (
        <div
          style={{
            ...styles.message,
            ...(messageType === "error" ? styles.messageError : styles.messageSuccess),
          }}
        >
          {message}
        </div>
      ) : null}

      <section className="adminHarmonizedStatsGrid" style={styles.kpiGrid}>
        <StatCard title="Réunions" value={String(stats.total)} subtitle="Total chargé" />
        <StatCard title="Programmées" value={String(stats.programmees)} subtitle="À venir ou à tenir" />
        <StatCard title="Publiées" value={String(stats.publiees)} subtitle="Visibles copropriétaire" />
        <StatCard title="Actions" value={String(stats.actions)} subtitle="Tâches liées aux réunions" />
      </section>

      <section className="adminHarmonizedPanel" style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h2 style={styles.panelTitle}>Nouvelle réunion / rencontre</h2>
            <p style={styles.panelText}>
              Une réunion peut rester interne ou être publiée côté copropriétaire après ajout
              d’un compte rendu ou d’un document visible.
            </p>
          </div>
        </div>

        <div style={styles.formGrid}>
          <label style={styles.field}>
            <span>Type</span>
            <select
              value={form.type}
              onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
              style={styles.input}
            >
              {reunionTypes.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label style={styles.field}>
            <span>Statut</span>
            <select
              value={form.statut}
              onChange={(event) => setForm((current) => ({ ...current, statut: event.target.value }))}
              style={styles.input}
            >
              {reunionStatuts.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label style={styles.field}>
            <span>Titre</span>
            <input
              value={form.titre}
              onChange={(event) => setForm((current) => ({ ...current, titre: event.target.value }))}
              style={styles.input}
              placeholder="Réunion conseil syndical"
            />
          </label>

          <label style={styles.field}>
            <span>Référence</span>
            <input
              value={form.reference}
              onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))}
              style={styles.input}
              placeholder="REU-2026-001"
            />
          </label>

          <label style={styles.field}>
            <span>Date début</span>
            <input
              type="datetime-local"
              value={form.date_debut}
              onChange={(event) => setForm((current) => ({ ...current, date_debut: event.target.value }))}
              style={styles.input}
            />
          </label>

          <label style={styles.field}>
            <span>Date fin</span>
            <input
              type="datetime-local"
              value={form.date_fin}
              onChange={(event) => setForm((current) => ({ ...current, date_fin: event.target.value }))}
              style={styles.input}
            />
          </label>

          <label style={styles.field}>
            <span>Lieu</span>
            <input
              value={form.lieu}
              onChange={(event) => setForm((current) => ({ ...current, lieu: event.target.value }))}
              style={styles.input}
              placeholder="Salle commune, syndic, mairie..."
            />
          </label>

          <label style={styles.field}>
            <span>Objet</span>
            <input
              value={form.objet}
              onChange={(event) => setForm((current) => ({ ...current, objet: event.target.value }))}
              style={styles.input}
              placeholder="Objet principal de la rencontre"
            />
          </label>

          <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
            <span>Description</span>
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              style={{ ...styles.input, resize: "vertical" }}
              rows={2}
            />
          </label>

          <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
            <span>Compte rendu</span>
            <textarea
              value={form.compte_rendu}
              onChange={(event) => setForm((current) => ({ ...current, compte_rendu: event.target.value }))}
              style={{ ...styles.input, resize: "vertical" }}
              rows={3}
              placeholder="Synthèse de la réunion, points abordés, conclusions..."
            />
          </label>

          <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
            <span>Décisions</span>
            <textarea
              value={form.decisions}
              onChange={(event) => setForm((current) => ({ ...current, decisions: event.target.value }))}
              style={{ ...styles.input, resize: "vertical" }}
              rows={2}
            />
          </label>

          <label style={styles.checkRow}>
            <input
              type="checkbox"
              checked={form.visible_coproprietaire}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  visible_coproprietaire: event.target.checked,
                }))
              }
            />
            <span>Préparer comme visible copropriétaire</span>
          </label>

          <div style={styles.formActions}>
            <button type="button" style={styles.primaryButton} onClick={() => void createReunion()} disabled={isBusy}>
              Créer la réunion
            </button>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => setForm({ ...initialReunionForm, date_debut: nowLocalDatetime() })}
              disabled={isBusy}
            >
              Réinitialiser
            </button>
          </div>
        </div>
      </section>

      <section className="adminHarmonizedPanel" style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h2 style={styles.panelTitle}>Réunions enregistrées</h2>
            <p style={styles.panelText}>Sélectionnez une réunion pour ajouter participants, documents et actions.</p>
          </div>
        </div>

        <div style={styles.filters}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            style={styles.input}
            placeholder="Recherche titre, objet, lieu..."
          />
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} style={styles.input}>
            <option value="">Tous les types</option>
            {reunionTypes.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select value={statutFilter} onChange={(event) => setStatutFilter(event.target.value)} style={styles.input}>
            <option value="">Tous les statuts</option>
            <option value="BROUILLON">Brouillon</option>
            <option value="PROGRAMMEE">Programmée</option>
            <option value="TENUE">Tenue</option>
            <option value="PUBLIEE">Publiée</option>
            <option value="ARCHIVEE">Archivée</option>
            <option value="ANNULEE">Annulée</option>
          </select>
        </div>

        {loadState === "loading" ? (
          <div style={styles.empty}>Chargement des réunions...</div>
        ) : reunions.length === 0 ? (
          <div style={styles.empty}>Aucune réunion ou rencontre enregistrée.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Réunion</th>
                  <th style={styles.th}>Date / lieu</th>
                  <th style={styles.th}>Statut</th>
                  <th style={styles.th}>Contenu</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reunions.map((item) => (
                  <tr key={item.id} style={item.id === selectedId ? styles.selectedRow : undefined}>
                    <td style={styles.td}>
                      <strong>{item.titre}</strong>
                      <div style={styles.muted}>{item.type_label || item.type}</div>
                      <div style={styles.muted}>{item.reference || "Sans référence"}</div>
                    </td>
                    <td style={styles.td}>
                      <div>{formatDateTime(item.date_debut)}</div>
                      <div style={styles.muted}>{item.lieu || "Lieu non précisé"}</div>
                    </td>
                    <td style={styles.td}>
                      <StatusBadge statut={item.statut} />
                    </td>
                    <td style={styles.td}>
                      <div>{item.participants_count ?? item.participants?.length ?? 0} participant(s)</div>
                      <div>{item.documents_count ?? item.documents?.length ?? 0} document(s)</div>
                      <div>{item.actions_count ?? item.actions?.length ?? 0} action(s)</div>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.rowActions}>
                        <button type="button" style={styles.smallButton} onClick={() => setSelectedId(item.id)}>
                          Sélectionner
                        </button>
                        <button
                          type="button"
                          style={styles.smallButton}
                          onClick={() =>
                            void patchSelectedReunion(
                              { statut: "TENUE" },
                              "Réunion marquée comme tenue.",
                            )
                          }
                          disabled={isBusy || selectedId !== item.id}
                        >
                          Marquer tenue
                        </button>
                        <button
                          type="button"
                          style={styles.smallButton}
                          onClick={() => void publishSelected()}
                          disabled={isBusy || selectedId !== item.id}
                        >
                          Publier
                        </button>
                        <button
                          type="button"
                          style={styles.dangerSmallButton}
                          onClick={() => void archiveSelected()}
                          disabled={isBusy || selectedId !== item.id}
                        >
                          Archiver
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="adminHarmonizedTwoColumns" style={styles.twoColumns}>
        <article className="adminHarmonizedPanel" style={styles.panel}>
          <h2 style={styles.panelTitle}>Réunion sélectionnée</h2>

          {selectedReunion ? (
            <div style={styles.selectedBox}>
              <strong>{selectedReunion.titre}</strong>
              <div style={styles.muted}>{selectedReunion.objet || "Objet non précisé"}</div>
              <div style={styles.muted}>Compte rendu : {selectedReunion.compte_rendu ? "Oui" : "Non"}</div>
              <div style={styles.muted}>Visible copropriétaire : {selectedReunion.visible_coproprietaire ? "Oui" : "Non"}</div>
            </div>
          ) : (
            <div style={styles.empty}>Aucune réunion sélectionnée.</div>
          )}

          <div style={styles.inlineActions}>
            <button
              type="button"
              style={styles.secondaryButton}
              disabled={!selectedReunion || isBusy}
              onClick={() =>
                void patchSelectedReunion(
                  {
                    visible_coproprietaire: !selectedReunion?.visible_coproprietaire,
                  },
                  selectedReunion?.visible_coproprietaire
                    ? "Visibilité copropriétaire désactivée."
                    : "Visibilité copropriétaire activée.",
                )
              }
            >
              Basculer visibilité
            </button>
          </div>
        </article>

        <article className="adminHarmonizedPanel" style={styles.panel}>
          <h2 style={styles.panelTitle}>Ajouter un participant</h2>
          <div style={styles.compactForm}>
            <select
              value={participantForm.type}
              onChange={(event) =>
                setParticipantForm((current) => ({ ...current, type: event.target.value }))
              }
              style={styles.input}
            >
              {participantTypes.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <input
              value={participantForm.nom_complet}
              onChange={(event) =>
                setParticipantForm((current) => ({ ...current, nom_complet: event.target.value }))
              }
              style={styles.input}
              placeholder="Nom complet"
            />
            <input
              value={participantForm.organisation}
              onChange={(event) =>
                setParticipantForm((current) => ({ ...current, organisation: event.target.value }))
              }
              style={styles.input}
              placeholder="Organisation"
            />
            <input
              value={participantForm.fonction}
              onChange={(event) =>
                setParticipantForm((current) => ({ ...current, fonction: event.target.value }))
              }
              style={styles.input}
              placeholder="Fonction"
            />
            <label style={styles.checkRow}>
              <input
                type="checkbox"
                checked={participantForm.present}
                onChange={(event) =>
                  setParticipantForm((current) => ({ ...current, present: event.target.checked }))
                }
              />
              <span>Présent</span>
            </label>
            <button type="button" style={styles.primaryButton} onClick={() => void createParticipant()} disabled={isBusy || !selectedReunion}>
              Ajouter participant
            </button>
          </div>
        </article>
      </section>

      <section className="adminHarmonizedTwoColumns" style={styles.twoColumns}>
        <article className="adminHarmonizedPanel" style={styles.panel}>
          <h2 style={styles.panelTitle}>Ajouter un document</h2>
          <div style={styles.compactForm}>
            <select
              value={documentForm.type}
              onChange={(event) =>
                setDocumentForm((current) => ({ ...current, type: event.target.value }))
              }
              style={styles.input}
            >
              {documentTypes.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <input
              value={documentForm.titre}
              onChange={(event) =>
                setDocumentForm((current) => ({ ...current, titre: event.target.value }))
              }
              style={styles.input}
              placeholder="Titre du document"
            />
            <textarea
              value={documentForm.description}
              onChange={(event) =>
                setDocumentForm((current) => ({ ...current, description: event.target.value }))
              }
              style={{ ...styles.input, resize: "vertical" }}
              placeholder="Description"
              rows={2}
            />
            <input
              id="reunion-document-file"
              type="file"
              accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              style={styles.input}
            />
            <label style={styles.checkRow}>
              <input
                type="checkbox"
                checked={documentForm.visible_coproprietaire}
                onChange={(event) =>
                  setDocumentForm((current) => ({
                    ...current,
                    visible_coproprietaire: event.target.checked,
                  }))
                }
              />
              <span>Visible copropriétaire</span>
            </label>
            <button type="button" style={styles.primaryButton} onClick={() => void createDocument()} disabled={isBusy || !selectedReunion}>
              Ajouter document
            </button>
          </div>

          <div style={styles.listBox}>
            {(selectedReunion?.documents ?? []).length === 0 ? (
              <span style={styles.muted}>Aucun document lié.</span>
            ) : (
              selectedReunion?.documents?.map((doc) => (
                <div key={doc.id} style={styles.listItem}>
                  <div>
                    <strong>{doc.titre}</strong>
                    <div style={styles.muted}>{doc.type_label || doc.type} · {doc.filename || "fichier"}</div>
                  </div>
                  <div style={styles.rowActions}>
                    <button type="button" style={styles.smallButton} onClick={() => void openDocument(doc, false)}>
                      Ouvrir
                    </button>
                    <button type="button" style={styles.smallButton} onClick={() => void openDocument(doc, true)}>
                      Télécharger
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="adminHarmonizedPanel" style={styles.panel}>
          <h2 style={styles.panelTitle}>Ajouter une action à suivre</h2>
          <div style={styles.compactForm}>
            <input
              value={actionForm.titre}
              onChange={(event) =>
                setActionForm((current) => ({ ...current, titre: event.target.value }))
              }
              style={styles.input}
              placeholder="Titre de l’action"
            />
            <textarea
              value={actionForm.description}
              onChange={(event) =>
                setActionForm((current) => ({ ...current, description: event.target.value }))
              }
              style={{ ...styles.input, resize: "vertical" }}
              placeholder="Description"
              rows={2}
            />
            <select
              value={actionForm.priorite}
              onChange={(event) =>
                setActionForm((current) => ({ ...current, priorite: event.target.value }))
              }
              style={styles.input}
            >
              {actionPriorites.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select
              value={actionForm.statut}
              onChange={(event) =>
                setActionForm((current) => ({ ...current, statut: event.target.value }))
              }
              style={styles.input}
            >
              {actionStatuts.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <input
              value={actionForm.responsable_nom}
              onChange={(event) =>
                setActionForm((current) => ({ ...current, responsable_nom: event.target.value }))
              }
              style={styles.input}
              placeholder="Responsable"
            />
            <input
              type="date"
              value={actionForm.echeance}
              onChange={(event) =>
                setActionForm((current) => ({ ...current, echeance: event.target.value }))
              }
              style={styles.input}
            />
            <button type="button" style={styles.primaryButton} onClick={() => void createAction()} disabled={isBusy || !selectedReunion}>
              Ajouter action
            </button>
          </div>

          <div style={styles.listBox}>
            {(selectedReunion?.actions ?? []).length === 0 ? (
              <span style={styles.muted}>Aucune action liée.</span>
            ) : (
              selectedReunion?.actions?.map((item) => (
                <div key={item.id} style={styles.listItem}>
                  <div>
                    <strong>{item.titre}</strong>
                    <div style={styles.muted}>
                      {item.priorite_label || item.priorite} · {item.statut_label || item.statut}
                    </div>
                    <div style={styles.muted}>{item.responsable_nom || "Responsable non défini"}</div>
                  </div>
                  <div style={styles.muted}>{item.echeance || "Sans échéance"}</div>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { display: "grid", gap: 18 },
  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(260px, 360px)",
    gap: 20,
    padding: 24,
    borderRadius: 24,
    border: "1px solid #e5e7eb",
    background: "linear-gradient(135deg, #ecfeff 0%, #f8fafc 55%, #ffffff 100%)",
  },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#0891b2",
  },
  title: { margin: "8px 0 0", fontSize: 28, letterSpacing: -0.7, color: "#0f172a" },
  subtitle: { margin: "12px 0 0", maxWidth: 920, fontSize: 15, lineHeight: 1.7, color: "#475569" },
  notice: {
    display: "grid",
    gap: 8,
    alignSelf: "start",
    padding: 16,
    borderRadius: 18,
    border: "1px solid #bae6fd",
    background: "rgba(255, 255, 255, 0.82)",
    color: "#475569",
    fontSize: 13,
    lineHeight: 1.6,
  },
  message: { borderRadius: 16, padding: "12px 14px", fontSize: 13, fontWeight: 800, whiteSpace: "pre-wrap" },
  messageSuccess: { border: "1px solid #86efac", background: "#ecfdf5", color: "#166534" },
  messageError: { border: "1px solid #fca5a5", background: "#fef2f2", color: "#991b1b" },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 },
  panel: { padding: 20, borderRadius: 22, border: "1px solid #e5e7eb", background: "#ffffff", boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)" },
  panelHeader: { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 },
  panelTitle: { margin: 0, fontSize: 18, fontWeight: 900, color: "#0f172a" },
  panelText: { margin: "6px 0 0", fontSize: 13, lineHeight: 1.6, color: "#64748b" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 },
  compactForm: { display: "grid", gap: 10 },
  field: { display: "grid", gap: 6, fontSize: 12, fontWeight: 900, color: "#334155" },
  input: { border: "1px solid #cbd5e1", borderRadius: 12, padding: "10px 12px", fontSize: 13, color: "#0f172a", background: "#ffffff" },
  checkRow: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 900, color: "#334155" },
  formActions: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  primaryButton: { border: "1px solid #67e8f9", borderRadius: 12, padding: "10px 14px", background: "#ecfeff", color: "#155e75", fontSize: 13, fontWeight: 900, cursor: "pointer" },
  secondaryButton: { border: "1px solid #cbd5e1", borderRadius: 12, padding: "10px 14px", background: "#ffffff", color: "#0f172a", fontSize: 13, fontWeight: 900, cursor: "pointer" },
  smallButton: { border: "1px solid #cbd5e1", borderRadius: 12, padding: "7px 10px", background: "#ffffff", color: "#0f172a", fontSize: 12, fontWeight: 900, cursor: "pointer" },
  dangerSmallButton: { border: "1px solid #fca5a5", borderRadius: 12, padding: "7px 10px", background: "#fef2f2", color: "#991b1b", fontSize: 12, fontWeight: 900, cursor: "pointer" },
  filters: { display: "grid", gridTemplateColumns: "minmax(220px, 1fr) 220px 220px", gap: 12, marginBottom: 16 },
  table: { width: "100%", minWidth: 980, borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e2e8f0", fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.4 },
  td: { padding: "12px", borderBottom: "1px solid #f1f5f9", fontSize: 13, color: "#334155", verticalAlign: "top" },
  selectedRow: { background: "#ecfeff" },
  rowActions: { display: "flex", gap: 8, flexWrap: "wrap" },
  muted: { color: "#64748b", fontSize: 12, lineHeight: 1.5 },
  empty: { padding: 18, borderRadius: 18, border: "1px dashed #cbd5e1", background: "#f8fafc", color: "#64748b", fontSize: 13 },
  twoColumns: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 },
  selectedBox: { display: "grid", gap: 6, padding: 14, borderRadius: 16, background: "#f8fafc", border: "1px solid #e2e8f0" },
  inlineActions: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 },
  listBox: { display: "grid", gap: 10, marginTop: 14 },
  listItem: { display: "flex", justifyContent: "space-between", gap: 12, padding: 12, borderRadius: 16, border: "1px solid #e2e8f0", background: "#f8fafc" },
};

const statCard: CSSProperties = {
  display: "grid",
  gap: 5,
  padding: 18,
  borderRadius: 20,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
};

const statTitle: CSSProperties = { fontSize: 13, fontWeight: 900, color: "#475569" };
const statValue: CSSProperties = { fontSize: 26, fontWeight: 900, color: "#0f172a" };
const statSubtitle: CSSProperties = { fontSize: 12, color: "#64748b", lineHeight: 1.5 };

const badgeBase: CSSProperties = {
  display: "inline-flex",
  borderRadius: 999,
  border: "1px solid",
  padding: "5px 9px",
  fontSize: 11,
  fontWeight: 900,
};

const badgeSuccess: CSSProperties = { background: "#ecfdf5", borderColor: "#86efac", color: "#166534" };
const badgeWarning: CSSProperties = { background: "#fffbeb", borderColor: "#fcd34d", color: "#92400e" };
const badgeDanger: CSSProperties = { background: "#fef2f2", borderColor: "#fca5a5", color: "#991b1b" };
const badgeInfo: CSSProperties = { background: "#eff6ff", borderColor: "#93c5fd", color: "#1d4ed8" };
const badgeNeutral: CSSProperties = { background: "#f8fafc", borderColor: "#cbd5e1", color: "#475569" };
