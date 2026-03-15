import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { activerContrat, cloturerContrat, getContrats, getEmployes } from "../../api/rh";
import type { ContratEmploye, ContratStatut, Employe } from "../../api/types";
import {
  PRODUCT_WORDING,
  getContractStatusLabel,
  getRHRoleLabel,
} from "../../constants/productWording";

type LoadState = "idle" | "loading" | "success" | "error";

type ConfirmAction = {
  open: boolean;
  contrat: ContratEmploye | null;
  action: "activer" | "cloturer" | null;
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

  const MAP: Record<string, string> = {
    SYNDIC: "Syndic",
    EMPLOYE: "Employé",
    ASSISTANT: "Assistant",
    COMPTABLE: "Comptable",
    TECHNICIEN: "Technicien",
    RESPONSABLE: "Responsable",
  };

  if (MAP[normalized]) return MAP[normalized];

  return normalized
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function humanizeContractType(type?: string | null) {
  const value = String(type ?? "").trim().toUpperCase();
  if (!value) return PRODUCT_WORDING.common.notProvided;

  const MAP: Record<string, string> = {
    CDI: "CDI",
    CDD: "CDD",
    STAGE: "Stage",
    PRESTATION: "Prestation",
    INTERIM: "Intérim",
    TEMPS_PARTIEL: "Temps partiel",
    TEMPS_PLEIN: "Temps plein",
  };

  if (MAP[value]) return MAP[value];

  return value
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getStatutLabel(statut?: ContratStatut | string | null) {
  const s = String(statut ?? "").toUpperCase();

  if (s === "ACTIF") return getContractStatusLabel("IN_PROGRESS");
  if (s === "TERMINE") return getContractStatusLabel("COMPLETED");
  if (s === "BROUILLON") return PRODUCT_WORDING.statuses.draft;

  return s || PRODUCT_WORDING.common.notProvided;
}

function getStatutStyle(statut: ContratStatut): CSSProperties {
  const s = String(statut).toUpperCase();

  if (s === "ACTIF") {
    return {
      ...badgeBase,
      color: "#166534",
      background: "#ecfdf5",
      border: "1px solid #a7f3d0",
    };
  }

  if (s === "TERMINE") {
    return {
      ...badgeBase,
      color: "#374151",
      background: "#f3f4f6",
      border: "1px solid #e5e7eb",
    };
  }

  return {
    ...badgeBase,
    color: "#92400e",
    background: "#fffbeb",
    border: "1px solid #fde68a",
  };
}

function getCycleBadge(item: ContratEmploye): { label: string; style: CSSProperties } {
  const statut = String(item.statut).toUpperCase();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const debut = item.date_debut ? new Date(item.date_debut) : null;
  const fin = item.date_fin ? new Date(item.date_fin) : null;

  if (debut && !Number.isNaN(debut.getTime())) debut.setHours(0, 0, 0, 0);
  if (fin && !Number.isNaN(fin.getTime())) fin.setHours(0, 0, 0, 0);

  if (statut === "TERMINE") {
    return {
      label: PRODUCT_WORDING.rh.contracts.status.completed,
      style: {
        ...softBadgeBase,
        color: "#374151",
        background: "#f3f4f6",
        border: "1px solid #e5e7eb",
      },
    };
  }

  if (debut && debut > today) {
    return {
      label: PRODUCT_WORDING.rh.contracts.status.upcoming,
      style: {
        ...softBadgeBase,
        color: "#1d4ed8",
        background: "#eff6ff",
        border: "1px solid #bfdbfe",
      },
    };
  }

  if (fin && fin < today) {
    return {
      label: PRODUCT_WORDING.rh.contracts.status.completed,
      style: {
        ...softBadgeBase,
        color: "#92400e",
        background: "#fffbeb",
        border: "1px solid #fde68a",
      },
    };
  }

  return {
    label: PRODUCT_WORDING.rh.contracts.status.inProgress,
    style: {
      ...softBadgeBase,
      color: "#166534",
      background: "#ecfdf5",
      border: "1px solid #a7f3d0",
    },
  };
}

function isFutureDate(dateStr?: string | null) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);

  return d > today;
}

function isContractActiveNow(item: ContratEmploye) {
  const statut = String(item.statut).toUpperCase();
  if (statut !== "ACTIF") return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const debut = item.date_debut ? new Date(item.date_debut) : null;
  const fin = item.date_fin ? new Date(item.date_fin) : null;

  if (!debut || Number.isNaN(debut.getTime())) return false;
  debut.setHours(0, 0, 0, 0);

  if (debut > today) return false;

  if (fin && !Number.isNaN(fin.getTime())) {
    fin.setHours(0, 0, 0, 0);
    if (fin < today) return false;
  }

  return true;
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
  primary?: boolean;
  danger?: boolean;
  onClick?: () => void;
  disabled?: boolean;
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

export default function RHContrats() {
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rows, setRows] = useState<ContratEmploye[]>([]);
  const [employes, setEmployes] = useState<Employe[]>([]);
  const [statutFilter, setStatutFilter] = useState<"TOUS" | ContratStatut>("TOUS");
  const [searchTerm, setSearchTerm] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const [confirmAction, setConfirmAction] = useState<ConfirmAction>({
    open: false,
    contrat: null,
    action: null,
  });

  async function fetchData() {
    setState("loading");
    setError(null);

    try {
      const [contratsData, employesData] = await Promise.all([getContrats(), getEmployes()]);
      setRows(Array.isArray(contratsData.results) ? contratsData.results : []);
      setEmployes(Array.isArray(employesData.results) ? employesData.results : []);
      setState("success");
    } catch (e) {
      setState("error");
      setError(getErrorMessage(e, PRODUCT_WORDING.rh.contracts.loadError));
      setRows([]);
      setEmployes([]);
    }
  }

  useEffect(() => {
    void fetchData();
  }, []);

  const employesMap = useMemo(() => {
    const map = new Map<number, Employe>();
    for (const emp of employes) map.set(emp.id, emp);
    return map;
  }, [employes]);

  function getEmployeLabel(employe: ContratEmploye["employe"]) {
    if (typeof employe === "number") {
      const emp = employesMap.get(employe);
      if (emp) return `${emp.nom ?? ""} ${emp.prenoms ?? ""}`.trim() || `Employé #${emp.id}`;
      return `Employé #${employe}`;
    }

    if (!employe) return PRODUCT_WORDING.common.notProvided;

    const emp = employe as Employe;
    return `${emp.nom ?? ""} ${emp.prenoms ?? ""}`.trim() || `Employé #${emp.id}`;
  }

  function getRoleLabel(employe: ContratEmploye["employe"]) {
    if (typeof employe === "number") {
      const emp = employesMap.get(employe);
      return humanizeRole(emp?.role);
    }

    if (!employe) return PRODUCT_WORDING.common.notProvided;
    return humanizeRole((employe as Employe).role);
  }

  function openConfirmFor(item: ContratEmploye) {
    const current = String(item.statut).toUpperCase();
    const isActif = current === "ACTIF";

    if (isActif && isFutureDate(item.date_debut)) {
      setError(PRODUCT_WORDING.rh.contracts.closeFutureError);
      setSuccess(null);
      return;
    }

    setError(null);
    setSuccess(null);
    setConfirmAction({
      open: true,
      contrat: item,
      action: isActif ? "cloturer" : "activer",
    });
  }

  function closeConfirmModal() {
    if (busyId !== null) return;
    setConfirmAction({
      open: false,
      contrat: null,
      action: null,
    });
  }

  async function handleConfirmAction() {
    const item = confirmAction.contrat;
    const action = confirmAction.action;

    if (!item || !action) return;

    setBusyId(item.id);
    setError(null);
    setSuccess(null);

    try {
      const updated = action === "cloturer" ? await cloturerContrat(item.id) : await activerContrat(item.id);

      setRows((prev) => prev.map((row) => (row.id === item.id ? updated : row)));
      setSuccess(
        action === "cloturer"
          ? PRODUCT_WORDING.rh.contracts.closeSuccess
          : PRODUCT_WORDING.rh.contracts.reactivateSuccess
      );

      setConfirmAction({
        open: false,
        contrat: null,
        action: null,
      });
    } catch (e) {
      setError(getErrorMessage(e, "Cette action n’a pas pu être finalisée."));
    } finally {
      setBusyId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    return rows.filter((item) => {
      const matchStatut =
        statutFilter === "TOUS" ? true : String(item.statut).toUpperCase() === String(statutFilter);

      if (!matchStatut) return false;
      if (!q) return true;

      const employeLabel = getEmployeLabel(item.employe).toLowerCase();
      const roleLabel = getRoleLabel(item.employe).toLowerCase();
      const typeContrat = humanizeContractType(item.type_contrat).toLowerCase();
      const statutLabel = getStatutLabel(item.statut).toLowerCase();
      const idLabel = String(item.id);

      return (
        employeLabel.includes(q) ||
        roleLabel.includes(q) ||
        typeContrat.includes(q) ||
        statutLabel.includes(q) ||
        idLabel.includes(q)
      );
    });
  }, [rows, statutFilter, searchTerm, employesMap]);

  const stats = useMemo(() => {
    const contratsActifsReels = rows.filter(isContractActiveNow);

    return {
      total: filtered.length,
      actifs: filtered.filter((x) => String(x.statut).toUpperCase() === "ACTIF").length,
      termines: filtered.filter((x) => String(x.statut).toUpperCase() === "TERMINE").length,
      brouillons: filtered.filter((x) => String(x.statut).toUpperCase() === "BROUILLON").length,
      masseActive: contratsActifsReels.reduce((sum, x) => sum + Number(x.salaire_mensuel ?? 0), 0),
    };
  }, [filtered, rows]);

  const isLoading = state === "loading";
  const confirmLoading =
    confirmAction.open && confirmAction.contrat ? busyId === confirmAction.contrat.id : false;

  const hasRows = rows.length > 0;
  const hasFilters = searchTerm.trim().length > 0 || statutFilter !== "TOUS";

  return (
    <PageShell>
      <SectionTitle
        title={PRODUCT_WORDING.rh.contracts.listTitle}
        subtitle="Suivez les contrats, leurs périodes d’activité et leur statut pour les employés de la copropriété."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <SmallButton to="/rh/employes">Voir les employés</SmallButton>
            <SmallButton to="/rh/contrats/nouveau" primary>
              {PRODUCT_WORDING.rh.contracts.createTitle}
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
        <StatCard title="Contrats visibles" value={stats.total} sub="Résultats affichés après filtres et recherche." />
        <StatCard title="En cours" value={stats.actifs} sub="Contrats visibles actuellement en cours." />
        <StatCard title="Terminés" value={stats.termines} sub="Contrats visibles clôturés ou arrivés à terme." />
        <StatCard title="Brouillons" value={stats.brouillons} sub="Contrats visibles encore en préparation." />
        <StatCard
          title="Masse salariale active"
          value={fmtMoney(stats.masseActive)}
          sub="Somme des contrats réellement en cours, indépendamment des filtres affichés."
        />
      </div>

      {(error || success) && (
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
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={statutFilter}
            onChange={(e) => setStatutFilter(e.target.value as "TOUS" | ContratStatut)}
            style={selectInput}
          >
            <option value="TOUS">Tous les statuts</option>
            <option value="ACTIF">En cours</option>
            <option value="TERMINE">Terminés</option>
            <option value="BROUILLON">Brouillons</option>
          </select>

          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher : contrat, employé, rôle..."
            style={searchInput}
          />

          <SmallButton onClick={() => void fetchData()} disabled={isLoading}>
            {isLoading ? "Actualisation..." : "Actualiser"}
          </SmallButton>
        </div>

        <div style={{ color: "#6b7280", fontSize: 13, fontWeight: 600 }}>
          {isLoading ? "Chargement des contrats..." : `${filtered.length} contrat(s) affiché(s) sur ${rows.length}`}
        </div>
      </div>

      <div style={tableWrap}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={th}>ID</th>
              <th style={th}>Employé</th>
              <th style={th}>Rôle</th>
              <th style={th}>Type de contrat</th>
              <th style={th}>Date de début</th>
              <th style={th}>Date de fin</th>
              <th style={th}>Salaire mensuel</th>
              <th style={th}>Statut</th>
              <th style={th}>Cycle</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              <tr>
                <td style={td} colSpan={10}>
                  <span style={{ color: "#6b7280" }}>Chargement des contrats...</span>
                </td>
              </tr>
            ) : null}

            {!isLoading &&
              filtered.map((item) => {
                const current = String(item.statut).toUpperCase();
                const isBusy = busyId === item.id;
                const futureContract = isFutureDate(item.date_debut);
                const cycleBadge = getCycleBadge(item);

                return (
                  <tr key={item.id}>
                    <td style={tdMono}>#{item.id}</td>
                    <td style={td}>
                      <div style={{ fontWeight: 800, color: "#111827" }}>{getEmployeLabel(item.employe)}</div>
                    </td>
                    <td style={td}>{getRoleLabel(item.employe)}</td>
                    <td style={td}>{humanizeContractType(item.type_contrat)}</td>
                    <td style={td}>{fmtDate(item.date_debut)}</td>
                    <td style={td}>{fmtDate(item.date_fin)}</td>
                    <td style={tdStrong}>{fmtMoney(item.salaire_mensuel)}</td>
                    <td style={td}>
                      <span style={getStatutStyle(item.statut)}>{getStatutLabel(item.statut)}</span>
                    </td>
                    <td style={td}>
                      <span style={cycleBadge.style}>{cycleBadge.label}</span>
                    </td>
                    <td style={td}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Link to={`/rh/contrats/${item.id}/modifier`} style={primaryMiniLink}>
                          {PRODUCT_WORDING.actions.edit}
                        </Link>

                        <button
                          type="button"
                          style={
                            current === "ACTIF"
                              ? futureContract
                                ? disabledMiniBtn
                                : dangerMiniBtn
                              : miniBtn
                          }
                          onClick={() => openConfirmFor(item)}
                          disabled={isBusy || (current === "ACTIF" && futureContract)}
                          title={
                            current === "ACTIF" && futureContract
                              ? PRODUCT_WORDING.rh.contracts.closeFutureError
                              : current === "ACTIF"
                                ? PRODUCT_WORDING.rh.contracts.closeAction
                                : PRODUCT_WORDING.rh.contracts.reactivateAction
                          }
                        >
                          {isBusy
                            ? "Traitement..."
                            : current === "ACTIF"
                              ? futureContract
                                ? PRODUCT_WORDING.rh.contracts.status.upcoming
                                : PRODUCT_WORDING.rh.contracts.closeAction
                              : PRODUCT_WORDING.rh.contracts.reactivateAction}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

            {!isLoading && filtered.length === 0 ? (
              <tr>
                <td style={td} colSpan={10}>
                  {!hasRows ? (
                    <EmptyState
                      title="Aucun contrat enregistré"
                      text={PRODUCT_WORDING.rh.contracts.empty}
                      actionLabel={PRODUCT_WORDING.rh.contracts.createTitle}
                      actionTo="/rh/contrats/nouveau"
                    />
                  ) : hasFilters ? (
                    <EmptyState
                      title="Aucun résultat"
                      text={PRODUCT_WORDING.common.noResultsForSearch}
                      actionLabel={PRODUCT_WORDING.rh.contracts.createTitle}
                      actionTo="/rh/contrats/nouveau"
                    />
                  ) : (
                    <EmptyState
                      title="Aucun contrat à afficher"
                      text={PRODUCT_WORDING.rh.contracts.empty}
                      actionLabel={PRODUCT_WORDING.rh.contracts.createTitle}
                      actionTo="/rh/contrats/nouveau"
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
        title={
          confirmAction.action === "cloturer"
            ? "Confirmer la clôture"
            : "Confirmer la réactivation"
        }
        message={
          confirmAction.contrat ? (
            <span>
              {confirmAction.action === "cloturer"
                ? "Voulez-vous vraiment clôturer le contrat"
                : "Voulez-vous vraiment réactiver le contrat"}{" "}
              <strong>#{confirmAction.contrat.id}</strong>
              {" de "}
              <strong>{getEmployeLabel(confirmAction.contrat.employe)}</strong>
              {" ?"}
            </span>
          ) : null
        }
        confirmLabel={
          confirmAction.action === "cloturer"
            ? PRODUCT_WORDING.rh.contracts.closeAction
            : PRODUCT_WORDING.rh.contracts.reactivateAction
        }
        confirmDanger={confirmAction.action === "cloturer"}
        loading={confirmLoading}
        onClose={closeConfirmModal}
        onConfirm={() => void handleConfirmAction()}
      />

      <style>{`
        @media (max-width: 1200px) {
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

const softBadgeBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const selectInput: CSSProperties = {
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#111827",
  fontWeight: 700,
};

const searchInput: CSSProperties = {
  minWidth: 260,
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#111827",
  fontSize: 14,
  outline: "none",
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

const disabledMiniBtn: CSSProperties = {
  ...miniBtn,
  border: "1px solid #e5e7eb",
  background: "#f9fafb",
  color: "#9ca3af",
  cursor: "not-allowed",
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