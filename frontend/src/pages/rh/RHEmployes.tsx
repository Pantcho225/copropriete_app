import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { activerEmploye, desactiverEmploye, getEmployes } from "../../api/rh";
import type { Employe, EmployeStatut } from "../../api/types";
import { PRODUCT_WORDING, getRHRoleLabel } from "../../constants/productWording";

type LoadState = "idle" | "loading" | "success" | "error";

type ConfirmAction = {
  open: boolean;
  employe: Employe | null;
  action: "activer" | "desactiver" | null;
};

function fmtMoney(x?: number | null) {
  if (x === undefined || x === null) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(x);
}

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("fr-FR");
}

function truncateText(value?: string | null, max = 42) {
  if (!value) return "—";
  const s = String(value).trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function getErrorMessage(e: unknown, fallback: string) {
  const err = e as {
    response?: { data?: { detail?: string } & Record<string, unknown> };
    message?: string;
  };

  const detail = err?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;

  if (err?.response?.data) {
    try {
      return JSON.stringify(err.response.data, null, 2);
    } catch {
      return fallback;
    }
  }

  return err?.message || fallback;
}

function humanizeRole(role?: string | null) {
  const value = String(role ?? "").trim();
  if (!value) return PRODUCT_WORDING.common.notProvided;

  const normalized = value.toUpperCase();
  const centralized = getRHRoleLabel(normalized);

  if (centralized !== normalized) return centralized;

  const FALLBACK_MAP: Record<string, string> = {
    SYNDIC: "Syndic",
    EMPLOYE: "Employé",
    ASSISTANT: "Assistant",
    COMPTABLE: "Comptable",
    TECHNICIEN: "Technicien",
    RESPONSABLE: "Responsable",
  };

  if (FALLBACK_MAP[normalized]) return FALLBACK_MAP[normalized];

  return normalized
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getStatutLabel(statut?: EmployeStatut | string | null) {
  const s = String(statut ?? "").toUpperCase();

  if (s === "ACTIF") return PRODUCT_WORDING.rh.employees.status.active;
  if (s === "INACTIF") return PRODUCT_WORDING.rh.employees.status.inactive;
  if (s === "SUSPENDU") return "Suspendu";

  return s || PRODUCT_WORDING.common.notProvided;
}

function getStatutStyle(statut: EmployeStatut): CSSProperties {
  const s = String(statut).toUpperCase();

  if (s === "ACTIF") {
    return {
      ...badgeBase,
      color: "#166534",
      background: "#ecfdf5",
      border: "1px solid #a7f3d0",
    };
  }

  if (s === "SUSPENDU") {
    return {
      ...badgeBase,
      color: "#92400e",
      background: "#fffbeb",
      border: "1px solid #fde68a",
    };
  }

  return {
    ...badgeBase,
    color: "#374151",
    background: "#f3f4f6",
    border: "1px solid #e5e7eb",
  };
}

function isEmployeActiveNow(item: Employe) {
  return String(item.statut).toUpperCase() === "ACTIF";
}

function PageShell({ children }: { children: ReactNode }) {
  return <div style={{ display: "grid", gap: 16 }}>{children}</div>;
}

function SectionTitle(props: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        alignItems: "flex-end",
      }}
    >
      <div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 900,
            letterSpacing: -0.5,
            color: "#111827",
            lineHeight: 1.1,
          }}
        >
          {props.title}
        </div>

        {props.subtitle ? (
          <div style={{ marginTop: 8, color: "#6b7280", fontSize: 14, lineHeight: 1.5, maxWidth: 860 }}>
            {props.subtitle}
          </div>
        ) : null}
      </div>

      {props.right ? <div>{props.right}</div> : null}
    </div>
  );
}

function StatCard(props: { title: string; value: string | number; sub?: string }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 20,
        padding: 16,
        background: "#fff",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 700, marginBottom: 8 }}>{props.title}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: "#111827", letterSpacing: -0.4, lineHeight: 1.1 }}>
        {props.value}
      </div>
      {props.sub ? (
        <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>{props.sub}</div>
      ) : null}
    </div>
  );
}

function AlertBox(props: { kind: "error" | "info" | "success"; children: ReactNode }) {
  const tone =
    props.kind === "error"
      ? { bg: "#fef2f2", border: "#fecaca", text: "#991b1b" }
      : props.kind === "success"
        ? { bg: "#ecfdf5", border: "#a7f3d0", text: "#166534" }
        : { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" };

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 16,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        color: tone.text,
        whiteSpace: "pre-wrap",
        lineHeight: 1.5,
      }}
    >
      {props.children}
    </div>
  );
}

function SmallButton(props: {
  children: ReactNode;
  to?: string;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
  danger?: boolean;
}) {
  if (props.to) {
    return (
      <Link
        to={props.to}
        style={{
          border: props.danger
            ? "1px solid #fecaca"
            : props.primary
              ? "1px solid #c7d2fe"
              : "1px solid #e5e7eb",
          background: props.danger ? "#fef2f2" : props.primary ? "#eef2ff" : "#fff",
          color: props.danger ? "#991b1b" : props.primary ? "#3730a3" : "#111827",
          borderRadius: 12,
          padding: "10px 14px",
          fontSize: 13,
          fontWeight: 800,
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          whiteSpace: "nowrap",
        }}
      >
        {props.children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        border: props.danger
          ? "1px solid #fecaca"
          : props.primary
            ? "1px solid #c7d2fe"
            : "1px solid #e5e7eb",
        background: props.disabled ? "#f9fafb" : props.danger ? "#fef2f2" : props.primary ? "#eef2ff" : "#fff",
        color: props.disabled ? "#9ca3af" : props.danger ? "#991b1b" : props.primary ? "#3730a3" : "#111827",
        borderRadius: 12,
        padding: "10px 14px",
        fontSize: 13,
        fontWeight: 800,
        cursor: props.disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {props.children}
    </button>
  );
}

function ConfirmModal(props: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  confirmDanger?: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!props.open) return null;

  return (
    <div style={modalOverlay} onClick={props.loading ? undefined : props.onClose}>
      <div style={modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={modalTitle}>{props.title}</div>
        <div style={modalText}>{props.message}</div>

        <div style={modalActions}>
          <button
            type="button"
            onClick={props.onClose}
            disabled={props.loading}
            style={{
              ...modalSecondaryBtn,
              opacity: props.loading ? 0.7 : 1,
              cursor: props.loading ? "not-allowed" : "pointer",
            }}
          >
            {PRODUCT_WORDING.actions.cancel}
          </button>

          <button
            type="button"
            onClick={props.onConfirm}
            disabled={props.loading}
            style={
              props.confirmDanger
                ? {
                    ...modalDangerBtn,
                    opacity: props.loading ? 0.7 : 1,
                    cursor: props.loading ? "not-allowed" : "pointer",
                  }
                : {
                    ...modalPrimaryBtn,
                    opacity: props.loading ? 0.7 : 1,
                    cursor: props.loading ? "not-allowed" : "pointer",
                  }
            }
          >
            {props.loading ? "Traitement..." : props.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState(props: { title: string; text: string; actionLabel?: string; actionTo?: string }) {
  return (
    <div style={emptyBox}>
      <div style={emptyTitle}>{props.title}</div>
      <div style={emptyText}>{props.text}</div>

      {props.actionLabel && props.actionTo ? (
        <div style={{ marginTop: 12 }}>
          <SmallButton to={props.actionTo} primary>
            {props.actionLabel}
          </SmallButton>
        </div>
      ) : null}
    </div>
  );
}

export default function RHEmployes() {
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Employe[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [query, setQuery] = useState("");
  const [statutFilter, setStatutFilter] = useState<"TOUS" | EmployeStatut>("TOUS");

  const [confirmAction, setConfirmAction] = useState<ConfirmAction>({
    open: false,
    employe: null,
    action: null,
  });

  async function fetchEmployes() {
    setState("loading");
    setError(null);

    try {
      const data = await getEmployes();
      setRows(Array.isArray(data.results) ? data.results : []);
      setState("success");
    } catch (e) {
      setState("error");
      setError(getErrorMessage(e, PRODUCT_WORDING.rh.employees.loadError));
      setRows([]);
    }
  }

  useEffect(() => {
    void fetchEmployes();
  }, []);

  function openConfirmFor(item: Employe) {
    const current = String(item.statut).toUpperCase();

    setError(null);
    setSuccess(null);
    setConfirmAction({
      open: true,
      employe: item,
      action: current === "ACTIF" ? "desactiver" : "activer",
    });
  }

  function closeConfirmModal() {
    if (busyId !== null) return;
    setConfirmAction({
      open: false,
      employe: null,
      action: null,
    });
  }

  async function handleConfirmAction() {
    const item = confirmAction.employe;
    const action = confirmAction.action;

    if (!item || !action) return;

    setBusyId(item.id);
    setError(null);
    setSuccess(null);

    try {
      const updated = action === "desactiver" ? await desactiverEmploye(item.id) : await activerEmploye(item.id);

      setRows((prev) => prev.map((row) => (row.id === item.id ? updated : row)));
      setSuccess(
        action === "desactiver"
          ? PRODUCT_WORDING.rh.employees.disableSuccess
          : PRODUCT_WORDING.rh.employees.reactivateSuccess
      );

      setConfirmAction({
        open: false,
        employe: null,
        action: null,
      });
    } catch (e) {
      setError(getErrorMessage(e, "Cette action n’a pas pu être finalisée."));
    } finally {
      setBusyId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows.filter((item) => {
      const matchStatut = statutFilter === "TOUS" ? true : String(item.statut).toUpperCase() === String(statutFilter);

      const haystack = [
        item.nom,
        item.prenoms,
        humanizeRole(item.role),
        item.role,
        item.telephone ?? "",
        item.email ?? "",
        String(item.id),
        getStatutLabel(item.statut),
      ]
        .join(" ")
        .toLowerCase();

      const matchQuery = !q ? true : haystack.includes(q);

      return matchStatut && matchQuery;
    });
  }, [rows, query, statutFilter]);

  const stats = useMemo(() => {
    const employesActifsReels = rows.filter(isEmployeActiveNow);

    return {
      total: filtered.length,
      actifs: filtered.filter((x) => String(x.statut).toUpperCase() === "ACTIF").length,
      inactifs: filtered.filter((x) => String(x.statut).toUpperCase() === "INACTIF").length,
      suspendus: filtered.filter((x) => String(x.statut).toUpperCase() === "SUSPENDU").length,
      masseActive: employesActifsReels.reduce((sum, x) => sum + Number(x.salaire_base ?? 0), 0),
    };
  }, [filtered, rows]);

  const isLoading = state === "loading";
  const confirmLoading =
    confirmAction.open && confirmAction.employe ? busyId === confirmAction.employe.id : false;

  const hasRows = rows.length > 0;
  const hasFilters = query.trim().length > 0 || statutFilter !== "TOUS";

  return (
    <PageShell>
      <SectionTitle
        title={PRODUCT_WORDING.rh.employees.listTitle}
        subtitle="Gérez les gardiens, agents d’entretien et autres employés rattachés à la copropriété."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <SmallButton to="/rh/contrats">Voir les contrats</SmallButton>
            <SmallButton to="/rh/employes/nouveau" primary>
              {PRODUCT_WORDING.rh.employees.createTitle}
            </SmallButton>
          </div>
        }
      />

      <div
        className="rh-stats-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: 14,
        }}
      >
        <StatCard title="Employés visibles" value={stats.total} sub="Résultats affichés après filtres et recherche." />
        <StatCard title="Actifs" value={stats.actifs} sub="Employés visibles actuellement actifs." />
        <StatCard title="Inactifs" value={stats.inactifs} sub="Employés visibles désactivés ou sortis." />
        <StatCard title="Suspendus" value={stats.suspendus} sub="Employés visibles temporairement suspendus." />
        <StatCard
          title="Masse salariale active"
          value={fmtMoney(stats.masseActive)}
          sub="Somme des salaires des employés actifs, indépendamment des filtres affichés."
        />
      </div>

      {(success || error) && (
        <AlertBox kind={error ? "error" : "success"}>
          <div style={{ fontWeight: 900, marginBottom: 4 }}>
            {error ? "Action impossible" : "Opération réussie"}
          </div>
          <div style={{ fontSize: 13 }}>{error || success}</div>
        </AlertBox>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher : nom, rôle, téléphone, e-mail..."
            style={input}
          />

          <select
            value={statutFilter}
            onChange={(e) => setStatutFilter(e.target.value as "TOUS" | EmployeStatut)}
            style={selectInput}
          >
            <option value="TOUS">Tous les statuts</option>
            <option value="ACTIF">Actifs</option>
            <option value="INACTIF">Inactifs</option>
            <option value="SUSPENDU">Suspendus</option>
          </select>

          <SmallButton onClick={() => void fetchEmployes()} disabled={isLoading}>
            {isLoading ? "Actualisation..." : "Actualiser"}
          </SmallButton>
        </div>

        <div style={{ color: "#6b7280", fontSize: 13, fontWeight: 600 }}>
          {isLoading ? "Chargement des employés..." : `${filtered.length} employé(s) affiché(s) sur ${rows.length}`}
        </div>
      </div>

      <div style={tableWrap}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={th}>ID</th>
              <th style={th}>Employé</th>
              <th style={th}>Rôle</th>
              <th style={th}>Contact</th>
              <th style={th}>Date d’embauche</th>
              <th style={th}>Salaire de base</th>
              <th style={th}>Statut</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              <tr>
                <td style={td} colSpan={8}>
                  <span style={{ color: "#6b7280" }}>Chargement des employés...</span>
                </td>
              </tr>
            ) : null}

            {!isLoading &&
              filtered.map((item) => {
                const current = String(item.statut).toUpperCase();
                const isBusy = busyId === item.id;

                return (
                  <tr key={item.id}>
                    <td style={tdMono}>#{item.id}</td>

                    <td style={td}>
                      <div style={{ fontWeight: 800, color: "#111827" }}>
                        {item.nom} {item.prenoms}
                      </div>
                    </td>

                    <td style={td}>{humanizeRole(item.role)}</td>

                    <td style={td}>
                      <div>{truncateText(item.telephone, 22)}</div>
                      {item.email ? (
                        <div style={{ marginTop: 4, color: "#6b7280", fontSize: 12 }}>
                          {truncateText(item.email, 26)}
                        </div>
                      ) : null}
                    </td>

                    <td style={td}>{fmtDate(item.date_embauche)}</td>
                    <td style={tdStrong}>{fmtMoney(item.salaire_base)}</td>

                    <td style={td}>
                      <span style={getStatutStyle(item.statut)}>{getStatutLabel(item.statut)}</span>
                    </td>

                    <td style={td}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Link to={`/rh/employes/${item.id}/modifier`} style={primaryMiniLink}>
                          {PRODUCT_WORDING.actions.edit}
                        </Link>

                        <button
                          type="button"
                          style={current === "ACTIF" ? dangerMiniBtn : miniBtn}
                          onClick={() => openConfirmFor(item)}
                          disabled={isBusy}
                          title={
                            current === "ACTIF"
                              ? "Désactiver cet employé"
                              : "Réactiver cet employé"
                          }
                        >
                          {isBusy
                            ? "Traitement..."
                            : current === "ACTIF"
                              ? PRODUCT_WORDING.rh.employees.actions.disable
                              : PRODUCT_WORDING.rh.employees.actions.reactivate}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

            {!isLoading && filtered.length === 0 ? (
              <tr>
                <td style={td} colSpan={8}>
                  {!hasRows ? (
                    <EmptyState
                      title="Aucun employé enregistré"
                      text={PRODUCT_WORDING.rh.employees.empty}
                      actionLabel={PRODUCT_WORDING.rh.employees.createTitle}
                      actionTo="/rh/employes/nouveau"
                    />
                  ) : hasFilters ? (
                    <EmptyState
                      title="Aucun résultat"
                      text={PRODUCT_WORDING.common.noResultsForSearch}
                      actionLabel={PRODUCT_WORDING.rh.employees.createTitle}
                      actionTo="/rh/employes/nouveau"
                    />
                  ) : (
                    <EmptyState
                      title="Aucun employé à afficher"
                      text={PRODUCT_WORDING.rh.employees.empty}
                      actionLabel={PRODUCT_WORDING.rh.employees.createTitle}
                      actionTo="/rh/employes/nouveau"
                    />
                  )}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        open={confirmAction.open}
        title={confirmAction.action === "desactiver" ? "Confirmer la désactivation" : "Confirmer la réactivation"}
        message={
          confirmAction.employe ? (
            <span>
              {confirmAction.action === "desactiver"
                ? "Voulez-vous vraiment désactiver l’employé"
                : "Voulez-vous vraiment réactiver l’employé"}{" "}
              <strong>
                {confirmAction.employe.nom} {confirmAction.employe.prenoms}
              </strong>
              {" ?"}
            </span>
          ) : null
        }
        confirmLabel={
          confirmAction.action === "desactiver"
            ? PRODUCT_WORDING.rh.employees.actions.disable
            : PRODUCT_WORDING.rh.employees.actions.reactivate
        }
        confirmDanger={confirmAction.action === "desactiver"}
        loading={confirmLoading}
        onClose={closeConfirmModal}
        onConfirm={() => void handleConfirmAction()}
      />

      <style>{`
        @media (max-width: 1280px) {
          .rh-stats-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 900px) {
          .rh-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 680px) {
          .rh-stats-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </PageShell>
  );
}

const badgeBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const input: CSSProperties = {
  width: 280,
  maxWidth: "100%",
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#111827",
  fontSize: 13,
  boxSizing: "border-box",
};

const selectInput: CSSProperties = {
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#111827",
  fontWeight: 700,
};

const tableWrap: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 20,
  overflowX: "auto",
  background: "#fff",
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
};

const th: CSSProperties = {
  padding: "14px 12px",
  borderBottom: "1px solid #e5e7eb",
  whiteSpace: "nowrap",
  fontSize: 12,
  color: "#6b7280",
  background: "#f9fafb",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 0.3,
};

const td: CSSProperties = {
  padding: "14px 12px",
  borderBottom: "1px solid #f3f4f6",
  verticalAlign: "middle",
  color: "#111827",
  fontSize: 14,
};

const tdMono: CSSProperties = {
  ...td,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const tdStrong: CSSProperties = {
  ...td,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const miniBtn: CSSProperties = {
  padding: "7px 10px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  cursor: "pointer",
  background: "#fff",
  fontSize: 12,
  fontWeight: 700,
  color: "#111827",
};

const dangerMiniBtn: CSSProperties = {
  ...miniBtn,
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#991b1b",
};

const primaryMiniLink: CSSProperties = {
  padding: "7px 10px",
  borderRadius: 10,
  border: "1px solid #c7d2fe",
  background: "#eef2ff",
  fontSize: 12,
  fontWeight: 700,
  color: "#3730a3",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
};

const emptyBox: CSSProperties = {
  padding: 18,
  borderRadius: 16,
  background: "#f9fafb",
  border: "1px dashed #d1d5db",
};

const emptyTitle: CSSProperties = {
  fontWeight: 800,
  fontSize: 14,
  color: "#111827",
  marginBottom: 6,
};

const emptyText: CSSProperties = {
  color: "#6b7280",
  fontSize: 13,
  lineHeight: 1.5,
};

const modalOverlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(17, 24, 39, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 1000,
};

const modalCard: CSSProperties = {
  width: "100%",
  maxWidth: 520,
  background: "#fff",
  borderRadius: 20,
  border: "1px solid #e5e7eb",
  boxShadow: "0 30px 80px rgba(15, 23, 42, 0.20)",
  padding: 20,
};

const modalTitle: CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  color: "#111827",
  lineHeight: 1.2,
  marginBottom: 10,
};

const modalText: CSSProperties = {
  fontSize: 14,
  color: "#4b5563",
  lineHeight: 1.6,
};

const modalActions: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 20,
};

const modalSecondaryBtn: CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#111827",
  borderRadius: 12,
  padding: "11px 16px",
  fontSize: 14,
  fontWeight: 800,
};

const modalPrimaryBtn: CSSProperties = {
  border: "1px solid #c7d2fe",
  background: "#eef2ff",
  color: "#3730a3",
  borderRadius: 12,
  padding: "11px 16px",
  fontSize: 14,
  fontWeight: 800,
};

const modalDangerBtn: CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#991b1b",
  borderRadius: 12,
  padding: "11px 16px",
  fontSize: 14,
  fontWeight: 800,
};