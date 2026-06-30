import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";

import api from "../../api/axios";
import { ENDPOINTS } from "../../api/endpoints";
import BackButton from "../../components/ui/BackButton";
import ModuleHero from "../../components/ui/ModuleHero";

type LoadState = "idle" | "loading" | "success" | "error";

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type CompteBancaireItem = {
  id: number;
  nom?: string | null;
  is_active?: boolean;
  is_default?: boolean;
};

type EntreeArgentItem = {
  id: number;
  compte: number;
  compte_label?: string;
  type: string;
  type_label?: string;
  statut: string;
  statut_label?: string;
  montant: string | number;
  date_operation: string;
  reference?: string | null;
  libelle?: string | null;
  source_nom?: string | null;
  mode_paiement?: string | null;
  mode_paiement_label?: string | null;
  mouvement?: number | null;
};

type EntreeArgentStats = {
  total_valide?: number;
  total_brouillon?: number;
  total_annule?: number;
  count_total?: number;
  count_valide?: number;
};

type FormState = {
  compte: string;
  type: string;
  statut: "BROUILLON" | "VALIDEE";
  montant: string;
  date_operation: string;
  reference: string;
  libelle: string;
  source_nom: string;
  mode_paiement: string;
  note: string;
};

const entreeTypes = [
  ["DON", "Don"],
  ["SUBVENTION", "Subvention"],
  ["REMBOURSEMENT", "Remboursement"],
  ["INTERET_BANCAIRE", "Intérêt bancaire"],
  ["REGULARISATION_CREDIT", "Régularisation crédit"],
  ["AUTRE_ENTREE", "Autre entrée d’argent"],
];

const modesPaiement = [
  ["VIREMENT", "Virement"],
  ["ESPECES", "Espèces"],
  ["CHEQUE", "Chèque"],
  ["MOBILE_MONEY", "Mobile money"],
  ["CARTE", "Carte"],
  ["AUTRE", "Autre"],
];

function isPaginated<T>(value: unknown): value is Paginated<T> {
  return Boolean(
    value &&
      typeof value === "object" &&
      Array.isArray((value as Paginated<T>).results),
  );
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function toNumber(value: string | number | undefined | null) {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: string | number | undefined | null) {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
      maximumFractionDigits: 0,
    }).format(toNumber(value));
  } catch {
    return `${toNumber(value)} FCFA`;
  }
}

function dateFr(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleDateString("fr-FR");
  return String(value).slice(0, 10);
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

function StatCard(props: { title: string; value: string; subtitle: string }) {
  return (
    <div style={statCard}>
      <div style={statTitle}>{props.title}</div>
      <div style={statValue}>{props.value}</div>
      <div style={statSubtitle}>{props.subtitle}</div>
    </div>
  );
}

function StatusBadge({ statut }: { statut: string }) {
  const normalized = statut.toUpperCase();

  const style =
    normalized === "VALIDEE"
      ? badgeSuccess
      : normalized === "ANNULEE"
        ? badgeDanger
        : badgeWarning;

  const label =
    normalized === "VALIDEE"
      ? "Validée"
      : normalized === "ANNULEE"
        ? "Annulée"
        : "Brouillon";

  return <span style={{ ...badgeBase, ...style }}>{label}</span>;
}

export default function ComptaEntreesArgent() {
  const navigate = useNavigate();

  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [actionState, setActionState] = useState<LoadState>("idle");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  const [items, setItems] = useState<EntreeArgentItem[]>([]);
  const [stats, setStats] = useState<EntreeArgentStats | null>(null);
  const [comptes, setComptes] = useState<CompteBancaireItem[]>([]);

  const [typeFilter, setTypeFilter] = useState("");
  const [statutFilter, setStatutFilter] = useState("");
  const [query, setQuery] = useState("");

  const [form, setForm] = useState<FormState>({
    compte: "",
    type: "DON",
    statut: "BROUILLON",
    montant: "",
    date_operation: todayISO(),
    reference: "",
    libelle: "",
    source_nom: "",
    mode_paiement: "VIREMENT",
    note: "",
  });

  const isBusy = loadState === "loading" || actionState === "loading";

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

      const [entreesRes, statsRes, comptesRes] = await Promise.all([
        api.get<Paginated<EntreeArgentItem> | EntreeArgentItem[]>(
          ENDPOINTS.comptaEntreesArgent,
          { params },
        ),
        api.get<EntreeArgentStats>(ENDPOINTS.comptaEntreesArgentStats),
        api.get<Paginated<CompteBancaireItem> | CompteBancaireItem[]>(
          ENDPOINTS.comptaComptes,
        ),
      ]);

      const nextItems = isPaginated<EntreeArgentItem>(entreesRes.data)
        ? entreesRes.data.results
        : Array.isArray(entreesRes.data)
          ? entreesRes.data
          : [];

      const nextComptes = isPaginated<CompteBancaireItem>(comptesRes.data)
        ? comptesRes.data.results
        : Array.isArray(comptesRes.data)
          ? comptesRes.data
          : [];

      setItems(nextItems);
      setStats(statsRes.data ?? null);
      setComptes(nextComptes);

      const defaultCompte =
        nextComptes.find((compte) => compte.is_default && compte.is_active !== false) ??
        nextComptes.find((compte) => compte.is_active !== false) ??
        nextComptes[0];

      if (defaultCompte) {
        setForm((current) =>
          current.compte ? current : { ...current, compte: String(defaultCompte.id) },
        );
      }

      setLoadState("success");
    } catch (error) {
      setLoadState("error");
      showMessage("error", getErrorMessage(error, "Impossible de charger les entrées d’argent."));
    }
  }, [showMessage, statutFilter, typeFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return items;

    return items.filter((item) =>
      [item.reference, item.libelle, item.source_nom, item.type_label, item.compte_label]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [items, query]);

  const resetForm = useCallback((compte = form.compte) => {
    setForm({
      compte,
      type: "DON",
      statut: "BROUILLON",
      montant: "",
      date_operation: todayISO(),
      reference: "",
      libelle: "",
      source_nom: "",
      mode_paiement: "VIREMENT",
      note: "",
    });
  }, [form.compte]);

  const createEntree = useCallback(async () => {
    if (!form.compte) {
      showMessage("error", "Sélectionnez un compte bancaire.");
      return;
    }

    if (!form.libelle.trim()) {
      showMessage("error", "Saisissez un libellé.");
      return;
    }

    if (toNumber(form.montant) <= 0) {
      showMessage("error", "Saisissez un montant valide.");
      return;
    }

    setActionState("loading");

    try {
      await api.post(ENDPOINTS.comptaEntreesArgent, {
        compte: Number(form.compte),
        type: form.type,
        statut: form.statut,
        montant: form.montant,
        date_operation: form.date_operation,
        reference: form.reference.trim(),
        libelle: form.libelle.trim(),
        source_nom: form.source_nom.trim(),
        mode_paiement: form.mode_paiement,
        note: form.note.trim(),
      });

      showMessage("success", "Entrée d’argent enregistrée.");
      resetForm(form.compte);
      await loadData();
      setActionState("success");
    } catch (error) {
      setActionState("error");
      showMessage("error", getErrorMessage(error, "Impossible d’enregistrer l’entrée d’argent."));
    }
  }, [form, loadData, resetForm, showMessage]);

  const validateEntree = useCallback(async (item: EntreeArgentItem) => {
    setActionState("loading");

    try {
      await api.post(ENDPOINTS.comptaEntreeArgentValider(item.id), {});
      showMessage("success", "Entrée validée. Le mouvement CREDIT a été créé.");
      await loadData();
      setActionState("success");
    } catch (error) {
      setActionState("error");
      showMessage("error", getErrorMessage(error, "Impossible de valider l’entrée."));
    }
  }, [loadData, showMessage]);

  const cancelEntree = useCallback(async (item: EntreeArgentItem) => {
    const reason = window.prompt(
      "Motif d’annulation de cette entrée d’argent ?",
      "Erreur de saisie",
    );

    if (reason === null) return;

    setActionState("loading");

    try {
      await api.post(ENDPOINTS.comptaEntreeArgentAnnuler(item.id), {
        reason,
        cancel_mouvement: true,
      });

      showMessage("success", "Entrée annulée.");
      await loadData();
      setActionState("success");
    } catch (error) {
      setActionState("error");
      showMessage("error", getErrorMessage(error, "Impossible d’annuler l’entrée."));
    }
  }, [loadData, showMessage]);

  return (
    <div style={pageShell}>
      <ModuleHero
        eyebrow="Comptabilité · Entrées d’argent"
        title="Entrées d’argent"
        subtitle="Enregistrez les dons, subventions, remboursements, intérêts bancaires, régularisations crédit et autres encaissements hors appels de fonds."
        actions={
          <>
            <BackButton to="/compta" label="Retour à la comptabilité" />
            <button
              type="button"
              className="moduleButton moduleButton--heroDark"
              onClick={() => navigate("/compta/mouvements")}
            >
              Voir les mouvements
            </button>
            <button
              type="button"
              className="moduleButton moduleButton--hero"
              onClick={() => void loadData()}
              disabled={isBusy}
            >
              Actualiser
            </button>
          </>
        }
      />

      {message ? (
        <div
          style={{
            ...messageBox,
            ...(messageType === "error" ? messageError : messageSuccess),
          }}
        >
          {message}
        </div>
      ) : null}

      <div style={statsGrid}>
        <StatCard
          title="Total validé"
          value={money(stats?.total_valide ?? 0)}
          subtitle={`${stats?.count_valide ?? 0} entrée(s) validée(s)`}
        />
        <StatCard
          title="Brouillons"
          value={money(stats?.total_brouillon ?? 0)}
          subtitle="Entrées préparées mais non encore validées."
        />
        <StatCard
          title="Annulées"
          value={money(stats?.total_annule ?? 0)}
          subtitle="Historique conservé pour la traçabilité."
        />
        <StatCard
          title="Total enregistré"
          value={String(stats?.count_total ?? items.length)}
          subtitle="Toutes les entrées du périmètre actif."
        />
      </div>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={cardTitle}>Nouvelle entrée</h2>
            <p style={cardSubtitle}>
              Une entrée validée crée automatiquement un mouvement bancaire CREDIT.
            </p>
          </div>
        </div>

        {comptes.length === 0 ? (
          <div style={emptyBox}>
            Aucun compte bancaire disponible. Créez d’abord un compte bancaire actif.
          </div>
        ) : (
          <div style={formGrid}>
            <label style={fieldLabel}>
              <span>Compte bancaire</span>
              <select
                value={form.compte}
                onChange={(event) =>
                  setForm((current) => ({ ...current, compte: event.target.value }))
                }
                style={input}
              >
                <option value="">Sélectionner</option>
                {comptes.map((compte) => (
                  <option key={compte.id} value={compte.id}>
                    {compte.nom || `Compte #${compte.id}`}
                    {compte.is_default ? " · par défaut" : ""}
                  </option>
                ))}
              </select>
            </label>

            <label style={fieldLabel}>
              <span>Type</span>
              <select
                value={form.type}
                onChange={(event) =>
                  setForm((current) => ({ ...current, type: event.target.value }))
                }
                style={input}
              >
                {entreeTypes.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label style={fieldLabel}>
              <span>Statut initial</span>
              <select
                value={form.statut}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    statut: event.target.value === "VALIDEE" ? "VALIDEE" : "BROUILLON",
                  }))
                }
                style={input}
              >
                <option value="BROUILLON">Brouillon</option>
                <option value="VALIDEE">Validée directement</option>
              </select>
            </label>

            <label style={fieldLabel}>
              <span>Montant</span>
              <input
                type="number"
                value={form.montant}
                onChange={(event) =>
                  setForm((current) => ({ ...current, montant: event.target.value }))
                }
                style={input}
                placeholder="25000"
              />
            </label>

            <label style={fieldLabel}>
              <span>Date</span>
              <input
                type="date"
                value={form.date_operation}
                onChange={(event) =>
                  setForm((current) => ({ ...current, date_operation: event.target.value }))
                }
                style={input}
              />
            </label>

            <label style={fieldLabel}>
              <span>Référence</span>
              <input
                value={form.reference}
                onChange={(event) =>
                  setForm((current) => ({ ...current, reference: event.target.value }))
                }
                style={input}
                placeholder="DON-2026-001"
              />
            </label>

            <label style={fieldLabel}>
              <span>Libellé</span>
              <input
                value={form.libelle}
                onChange={(event) =>
                  setForm((current) => ({ ...current, libelle: event.target.value }))
                }
                style={input}
                placeholder="Don de soutien"
              />
            </label>

            <label style={fieldLabel}>
              <span>Source</span>
              <input
                value={form.source_nom}
                onChange={(event) =>
                  setForm((current) => ({ ...current, source_nom: event.target.value }))
                }
                style={input}
                placeholder="Donateur, mairie, fournisseur..."
              />
            </label>

            <label style={fieldLabel}>
              <span>Mode de paiement</span>
              <select
                value={form.mode_paiement}
                onChange={(event) =>
                  setForm((current) => ({ ...current, mode_paiement: event.target.value }))
                }
                style={input}
              >
                {modesPaiement.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ ...fieldLabel, gridColumn: "1 / -1" }}>
              <span>Note</span>
              <textarea
                value={form.note}
                onChange={(event) =>
                  setForm((current) => ({ ...current, note: event.target.value }))
                }
                style={{ ...input, resize: "vertical" }}
                rows={3}
              />
            </label>

            <div style={formActions}>
              <button type="button" style={primaryButton} onClick={() => void createEntree()} disabled={isBusy}>
                Enregistrer
              </button>
              <button type="button" style={secondaryButton} onClick={() => resetForm()} disabled={isBusy}>
                Réinitialiser
              </button>
            </div>
          </div>
        )}
      </section>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={cardTitle}>Liste des entrées</h2>
            <p style={cardSubtitle}>Filtrez, validez ou annulez les entrées d’argent.</p>
          </div>
        </div>

        <div style={filtersGrid}>
          <label style={fieldLabel}>
            <span>Recherche</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              style={input}
              placeholder="Référence, libellé, source..."
            />
          </label>

          <label style={fieldLabel}>
            <span>Type</span>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              style={input}
            >
              <option value="">Tous les types</option>
              {entreeTypes.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldLabel}>
            <span>Statut</span>
            <select
              value={statutFilter}
              onChange={(event) => setStatutFilter(event.target.value)}
              style={input}
            >
              <option value="">Tous</option>
              <option value="BROUILLON">Brouillon</option>
              <option value="VALIDEE">Validée</option>
              <option value="ANNULEE">Annulée</option>
            </select>
          </label>
        </div>

        {loadState === "loading" ? (
          <div style={emptyBox}>Chargement des entrées d’argent...</div>
        ) : filteredItems.length === 0 ? (
          <div style={emptyBox}>Aucune entrée d’argent trouvée.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Date</th>
                  <th style={th}>Libellé</th>
                  <th style={th}>Type</th>
                  <th style={th}>Source</th>
                  <th style={th}>Montant</th>
                  <th style={th}>Statut</th>
                  <th style={th}>Mouvement</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const statut = item.statut.toUpperCase();

                  return (
                    <tr key={item.id}>
                      <td style={td}>{dateFr(item.date_operation)}</td>
                      <td style={td}>
                        <strong>{item.libelle || "—"}</strong>
                        <div style={muted}>{item.reference || "Sans référence"}</div>
                      </td>
                      <td style={td}>{item.type_label || item.type}</td>
                      <td style={td}>{item.source_nom || "—"}</td>
                      <td style={td}>
                        <strong>{money(item.montant)}</strong>
                      </td>
                      <td style={td}>
                        <StatusBadge statut={item.statut} />
                      </td>
                      <td style={td}>{item.mouvement ? `#${item.mouvement}` : "Non créé"}</td>
                      <td style={td}>
                        {statut === "ANNULEE" ? (
                          <span style={muted}>Aucune action</span>
                        ) : (
                          <div style={rowActions}>
                            {statut === "BROUILLON" ? (
                              <button
                                type="button"
                                style={smallPrimaryButton}
                                disabled={isBusy}
                                onClick={() => void validateEntree(item)}
                              >
                                Valider
                              </button>
                            ) : null}

                            <button
                              type="button"
                              style={smallDangerButton}
                              disabled={isBusy}
                              onClick={() => void cancelEntree(item)}
                            >
                              Annuler
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const pageShell: CSSProperties = {
  display: "grid",
  gap: 18,
  width: "100%",
};






const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 12,
};

const statCard: CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 18,
};

const statTitle: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "#475569",
};

const statValue: CSSProperties = {
  fontSize: 26,
  fontWeight: 900,
  color: "#0f172a",
  marginTop: 8,
};

const statSubtitle: CSSProperties = {
  fontSize: 12,
  color: "#64748b",
  marginTop: 6,
  lineHeight: 1.5,
};

const card: CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 24,
  padding: 22,
  boxShadow: "0 18px 45px rgba(15,23,42,0.06)",
};

const cardHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 16,
};

const cardTitle: CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 900,
  color: "#0f172a",
};

const cardSubtitle: CSSProperties = {
  margin: "6px 0 0",
  fontSize: 13,
  color: "#64748b",
  lineHeight: 1.5,
};

const formGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const filtersGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginBottom: 16,
};

const fieldLabel: CSSProperties = {
  display: "grid",
  gap: 6,
  fontSize: 12,
  fontWeight: 900,
  color: "#334155",
};

const input: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "10px 12px",
  fontSize: 13,
  color: "#0f172a",
  background: "#fff",
};

const formActions: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const primaryButton: CSSProperties = {
  border: "1px solid #93c5fd",
  borderRadius: 12,
  padding: "10px 14px",
  background: "#dbeafe",
  color: "#1e3a8a",
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
};

const secondaryButton: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "10px 14px",
  background: "#fff",
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
};

const smallPrimaryButton: CSSProperties = {
  ...primaryButton,
  padding: "7px 10px",
  fontSize: 12,
};

const smallDangerButton: CSSProperties = {
  border: "1px solid #fca5a5",
  borderRadius: 12,
  padding: "7px 10px",
  background: "#fef2f2",
  color: "#991b1b",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

const table: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 980,
};

const th: CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "1px solid #e2e8f0",
  fontSize: 11,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const td: CSSProperties = {
  padding: "12px",
  borderBottom: "1px solid #f1f5f9",
  fontSize: 13,
  color: "#334155",
  verticalAlign: "top",
};

const muted: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  marginTop: 4,
};

const rowActions: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const emptyBox: CSSProperties = {
  border: "1px dashed #cbd5e1",
  borderRadius: 18,
  padding: 18,
  background: "#f8fafc",
  color: "#64748b",
  fontSize: 13,
};

const messageBox: CSSProperties = {
  borderRadius: 16,
  padding: "12px 14px",
  fontSize: 13,
  fontWeight: 800,
  whiteSpace: "pre-wrap",
};

const messageSuccess: CSSProperties = {
  border: "1px solid #86efac",
  background: "#ecfdf5",
  color: "#166534",
};

const messageError: CSSProperties = {
  border: "1px solid #fca5a5",
  background: "#fef2f2",
  color: "#991b1b",
};

const badgeBase: CSSProperties = {
  display: "inline-flex",
  borderRadius: 999,
  padding: "5px 9px",
  fontSize: 11,
  fontWeight: 900,
  border: "1px solid",
};

const badgeSuccess: CSSProperties = {
  background: "#ecfdf5",
  borderColor: "#86efac",
  color: "#166534",
};

const badgeWarning: CSSProperties = {
  background: "#fffbeb",
  borderColor: "#fcd34d",
  color: "#92400e",
};

const badgeDanger: CSSProperties = {
  background: "#fef2f2",
  borderColor: "#fca5a5",
  color: "#991b1b",
};
