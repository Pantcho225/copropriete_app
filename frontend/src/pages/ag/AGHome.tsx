import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";

type LoadState = "idle" | "loading" | "success" | "error";
type AGStatus = "BROUILLON" | "OUVERTE" | "CLOTUREE" | "ARCHIVEE";
type ResolutionStatus = "EN_ATTENTE" | "ADOPTEE" | "REJETEE";

type AGItem = {
  id: number;
  statut: AGStatus;
  pv_genere?: boolean;
};

type ResolutionItem = {
  id: number;
  statut: ResolutionStatus;
};

type DRFPage<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

const AG_ENDPOINT_CANDIDATES = ["/api/ag/ags/", "/api/ag/ags"];
const RESOLUTION_ENDPOINT_CANDIDATES = ["/api/ag/resolutions/", "/api/ag/resolutions"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isPaginatedResponse<T = unknown>(value: unknown): value is DRFPage<T> {
  return isRecord(value) && Array.isArray(value.results) && typeof value.count === "number";
}

function extractRows<T = unknown>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];

  if (isPaginatedResponse<T>(value)) return value.results;

  if (isRecord(value)) {
    const candidates = [value.results, value.items, value.data];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate as T[];
    }
  }

  return [];
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toBooleanOrNull(value: unknown): boolean | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  if (typeof value === "string") {
    const s = value.trim().toLowerCase();

    if (["true", "1", "oui", "yes", "ok", "genere", "généré", "disponible"].includes(s)) {
      return true;
    }

    if (["false", "0", "non", "no", "non_genere", "non généré", "non genere", "indisponible"].includes(s)) {
      return false;
    }
  }

  return null;
}

function hasTruthyValue(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function normalizeAGStatus(value: unknown): AGStatus {
  const s = String(value ?? "").trim().toUpperCase();

  if (["OUVERTE", "OPEN", "ACTIVE", "ACTIF", "EN_COURS"].includes(s)) return "OUVERTE";
  if (["CLOTUREE", "CLOTURE", "CLOSED", "TERMINEE", "TERMINÉE"].includes(s)) return "CLOTUREE";
  if (["ARCHIVEE", "ARCHIVÉE", "ARCHIVE", "ARCHIVED"].includes(s)) return "ARCHIVEE";
  return "BROUILLON";
}

function normalizeResolutionStatus(value: unknown): ResolutionStatus {
  const s = String(value ?? "").trim().toUpperCase();

  if (["ADOPTEE", "VALIDEE", "VALIDE", "APPROUVEE"].includes(s)) return "ADOPTEE";
  if (["REJETEE", "REJETE", "REFUSEE", "REFUSE"].includes(s)) return "REJETEE";
  return "EN_ATTENTE";
}

function normalizeAGItem(raw: unknown, index: number): AGItem {
  const row = isRecord(raw) ? raw : {};

  const pvGenere =
    toBooleanOrNull(row.pv_genere) ??
    toBooleanOrNull(row.pv_archive) ??
    toBooleanOrNull(row.pv_disponible) ??
    (hasTruthyValue(row.pv_signed_pdf) ? true : null) ??
    false;

  return {
    id:
      toNumberOrNull(row.id) ??
      toNumberOrNull(row.ag_id) ??
      toNumberOrNull(row.pk) ??
      index + 1,
    statut: normalizeAGStatus(row.statut ?? row.status ?? row.etat),
    pv_genere: pvGenere,
  };
}

function normalizeResolutionItem(raw: unknown, index: number): ResolutionItem {
  const row = isRecord(raw) ? raw : {};

  return {
    id:
      toNumberOrNull(row.id) ??
      toNumberOrNull(row.resolution_id) ??
      toNumberOrNull(row.pk) ??
      index + 1,
    statut: normalizeResolutionStatus(row.resultat ?? row.statut ?? row.status ?? row.decision),
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  const err = error as {
    response?: {
      data?: {
        detail?: string;
        message?: string;
      };
    };
    message?: string;
  };

  return err?.response?.data?.detail || err?.response?.data?.message || err?.message || fallback;
}

function PageShell({ children }: { children: ReactNode }) {
  return <div style={{ display: "grid", gap: 16 }}>{children}</div>;
}

function SectionTitle(props: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 900,
            letterSpacing: -0.6,
            color: "#111827",
            lineHeight: 1.1,
          }}
        >
          {props.title}
        </div>

        {props.subtitle ? (
          <div
            style={{
              fontSize: 14,
              color: "#6b7280",
              marginTop: 6,
              lineHeight: 1.5,
              maxWidth: 920,
            }}
          >
            {props.subtitle}
          </div>
        ) : null}
      </div>

      {props.right ? <div>{props.right}</div> : null}
    </div>
  );
}

function Card(props: { title: string; children: ReactNode; right?: ReactNode; minHeight?: number }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 20,
        padding: 18,
        background: "#ffffff",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
        minHeight: props.minHeight,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 900, color: "#111827" }}>{props.title}</div>
        {props.right ? props.right : null}
      </div>
      {props.children}
    </div>
  );
}

function StatCard(props: { title: string; value: string | number; sub?: string; isLoading?: boolean }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 20,
        padding: 18,
        background: "#ffffff",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
        minHeight: 112,
      }}
    >
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 10, fontWeight: 700 }}>
        {props.title}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 900,
          letterSpacing: -0.5,
          color: "#111827",
          lineHeight: 1.1,
        }}
      >
        {props.isLoading ? "…" : props.value}
      </div>
      {props.sub ? (
        <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
          {props.sub}
        </div>
      ) : null}
    </div>
  );
}

function SmallButton(props: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        border: props.primary ? "1px solid #c7d2fe" : "1px solid #e5e7eb",
        background: props.disabled ? "#f9fafb" : props.primary ? "#eef2ff" : "#fff",
        color: props.disabled ? "#9ca3af" : props.primary ? "#3730a3" : "#111827",
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

function EmptyState(props: { title: string; text: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div
      style={{
        border: "1px dashed #d1d5db",
        borderRadius: 16,
        padding: 18,
        background: "#f9fafb",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 6 }}>
        {props.title}
      </div>
      <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>{props.text}</div>
      {props.actionLabel && props.onAction ? (
        <div style={{ marginTop: 12 }}>
          <SmallButton onClick={props.onAction} primary>
            {props.actionLabel}
          </SmallButton>
        </div>
      ) : null}
    </div>
  );
}

function QuickActionCard(props: {
  title: string;
  text: string;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
  badge?: ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 18,
        padding: 16,
        background: "#ffffff",
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>{props.title}</div>
        {props.badge ?? null}
      </div>
      <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>{props.text}</div>
      <div>
        <SmallButton onClick={props.onAction} primary disabled={props.disabled}>
          {props.actionLabel}
        </SmallButton>
      </div>
    </div>
  );
}

function Badge(props: { text: string; kind?: "neutral" | "success" | "warning" | "info" }) {
  const styles =
    props.kind === "success"
      ? { background: "#ecfdf5", border: "#a7f3d0", color: "#065f46" }
      : props.kind === "warning"
        ? { background: "#fffbeb", border: "#fde68a", color: "#92400e" }
        : props.kind === "info"
          ? { background: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" }
          : { background: "#f3f4f6", border: "#e5e7eb", color: "#374151" };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        border: `1px solid ${styles.border}`,
        background: styles.background,
        color: styles.color,
        whiteSpace: "nowrap",
      }}
    >
      {props.text}
    </span>
  );
}

function AlertBox(props: { kind: "error" | "info"; children: ReactNode }) {
  const tone =
    props.kind === "error"
      ? { bg: "#fef2f2", border: "#fecaca", text: "#991b1b" }
      : { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" };

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 16,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        color: tone.text,
        lineHeight: 1.5,
      }}
    >
      {props.children}
    </div>
  );
}

export default function AGHome() {
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [ags, setAgs] = useState<AGItem[]>([]);
  const [resolutions, setResolutions] = useState<ResolutionItem[]>([]);

  useEffect(() => {
    async function fetchData() {
      setState("loading");
      setError(null);

      let agRows: AGItem[] = [];
      let resolutionRows: ResolutionItem[] = [];
      let lastError: unknown = null;

      for (const endpoint of AG_ENDPOINT_CANDIDATES) {
        try {
          const res = await api.get(endpoint);
          const data = res?.data;
          agRows = extractRows<Record<string, unknown>>(data)
            .map(normalizeAGItem)
            .filter((item) => item.id > 0);
          break;
        } catch (e) {
          lastError = e;
        }
      }

      for (const endpoint of RESOLUTION_ENDPOINT_CANDIDATES) {
        try {
          const res = await api.get(endpoint);
          const data = res?.data;
          resolutionRows = extractRows<Record<string, unknown>>(data)
            .map(normalizeResolutionItem)
            .filter((item) => item.id > 0);
          break;
        } catch (e) {
          lastError = e;
        }
      }

      setAgs(agRows);
      setResolutions(resolutionRows);

      if (agRows.length === 0 && resolutionRows.length === 0 && lastError) {
        setState("error");
        setError(getErrorMessage(lastError, "Impossible de charger les indicateurs du module AG."));
        return;
      }

      setState("success");
    }

    void fetchData();
  }, []);

  const stats = useMemo(() => {
    const pvGeneres = ags.filter((x) => x.pv_genere).length;
    const assembleesASuivre = ags.filter((x) => x.statut === "BROUILLON" || x.statut === "OUVERTE").length;
    const resolutionsEnAttente = resolutions.filter((x) => x.statut === "EN_ATTENTE").length;
    const agDisponible = ags.length > 0 ? ags[0] : null;

    return {
      agTotal: ags.length,
      resolutionsTotal: resolutions.length,
      pvGeneres,
      assembleesASuivre,
      resolutionsEnAttente,
      firstAgId: agDisponible?.id ?? null,
    };
  }, [ags, resolutions]);

  const isLoading = state === "loading";
  const hasAnyAg = stats.firstAgId !== null;

  return (
    <PageShell>
      <SectionTitle
        title="Assemblées générales"
        subtitle="Pilotez les assemblées générales, les résolutions, les présences, les votes et les procès-verbaux depuis un espace unifié, lisible et orienté produit."
        right={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SmallButton onClick={() => navigate("/")}>
              Retour au tableau de bord
            </SmallButton>
            <SmallButton onClick={() => navigate("/ag/assemblees/nouveau")} primary>
              Nouvelle assemblée
            </SmallButton>
          </div>
        }
      />

      {state === "error" && error ? (
        <AlertBox kind="error">
          <div style={{ fontWeight: 900, marginBottom: 4 }}>Chargement partiel ou impossible</div>
          <div style={{ fontSize: 13 }}>{error}</div>
        </AlertBox>
      ) : null}

      <div className="ag-stat-grid">
        <StatCard
          title="Assemblées générales"
          value={stats.agTotal}
          sub="Nombre total d’assemblées actuellement disponibles."
          isLoading={isLoading}
        />
        <StatCard
          title="Résolutions"
          value={stats.resolutionsTotal}
          sub="Volume global des résolutions rattachées aux assemblées."
          isLoading={isLoading}
        />
        <StatCard
          title="Procès-verbaux générés"
          value={stats.pvGeneres}
          sub="Assemblées disposant déjà d’un procès-verbal généré ou archivé."
          isLoading={isLoading}
        />
        <StatCard
          title="Assemblées à suivre"
          value={stats.assembleesASuivre}
          sub="Assemblées en brouillon ou encore ouvertes à surveiller."
          isLoading={isLoading}
        />
      </div>

      <div className="ag-main-grid">
        <Card
          title="Vue produit du module"
          right={<Badge text="Module opérationnel" kind="success" />}
          minHeight={270}
        >
          <div style={{ display: "grid", gap: 14 }}>
            <div style={paragraph}>
              Le module Assemblées générales est désormais intégré dans l’application avec ses pages
              métier principales : liste des assemblées, détail, résolutions, présences, votes et
              pilotage documentaire du procès-verbal.
            </div>

            <div style={paragraph}>
              Le socle produit déjà visible permet de :
            </div>

            <div style={bulletList}>
              <div style={bulletItem}>• préparer les assemblées générales</div>
              <div style={bulletItem}>• consulter l’état d’avancement des assemblées</div>
              <div style={bulletItem}>• suivre les résolutions et leurs résultats</div>
              <div style={bulletItem}>• accéder aux présences et aux votes depuis le cycle AG</div>
              <div style={bulletItem}>• structurer le pilotage du procès-verbal avant la finition premium</div>
            </div>
          </div>
        </Card>

        <Card
          title="État actuel"
          minHeight={270}
          right={<Badge text="Branchement métier actif" kind="info" />}
        >
          <div style={{ display: "grid", gap: 12 }}>
            <EmptyState
              title="Cycle AG visible et exploitable"
              text="La navigation principale du module est en place. Les écrans Présences et Votes existent maintenant dans le parcours AG, même si leur visibilité dashboard/KPI avancés sera encore enrichie dans la finition produit."
            />

            <div style={infoBox}>
              {stats.resolutionsEnAttente > 0
                ? `${stats.resolutionsEnAttente} résolution(s) restent encore en attente de décision ou de clôture.`
                : "Les KPI affichés ici servent de première synthèse produit du module AG."}
            </div>
          </div>
        </Card>
      </div>

      <Card title="Accès rapides AG" minHeight={120}>
        <div className="ag-quick-grid">
          <QuickActionCard
            title="Créer une assemblée"
            text="Préparez une nouvelle assemblée générale avec sa période, ses présences et son cadre de décision."
            actionLabel="Nouvelle assemblée"
            onAction={() => navigate("/ag/assemblees/nouveau")}
          />

          <QuickActionCard
            title="Consulter les assemblées"
            text="Accédez à la liste des assemblées générales déjà préparées, en cours ou clôturées."
            actionLabel="Voir les assemblées"
            onAction={() => navigate("/ag/assemblees")}
          />

          <QuickActionCard
            title="Consulter les résolutions"
            text="Suivez les résolutions, leur statut, leur résultat et leur impact métier sur la copropriété."
            actionLabel="Voir les résolutions"
            onAction={() => navigate("/ag/resolutions")}
          />

          <QuickActionCard
            title="Présences AG"
            text="Accédez directement à la gestion des présences et représentations pour une assemblée disponible."
            actionLabel="Voir les présences"
            onAction={() => navigate(`/ag/assemblees/${stats.firstAgId}/presences`)}
            disabled={!hasAnyAg}
            badge={<Badge text={hasAnyAg ? "Visible" : "Aucune AG"} kind={hasAnyAg ? "success" : "warning"} />}
          />

          <QuickActionCard
            title="Votes AG"
            text="Accédez directement à l’enregistrement et à la consultation des votes pour une assemblée disponible."
            actionLabel="Voir les votes"
            onAction={() => navigate(`/ag/assemblees/${stats.firstAgId}/votes`)}
            disabled={!hasAnyAg}
            badge={<Badge text={hasAnyAg ? "Visible" : "Aucune AG"} kind={hasAnyAg ? "success" : "warning"} />}
          />

          <QuickActionCard
            title="Détail d’une AG"
            text="Ouvrez une assemblée disponible pour accéder ensuite au quorum, au PV, aux présences et aux votes."
            actionLabel="Ouvrir le détail"
            onAction={() => navigate(`/ag/assemblees/${stats.firstAgId}`)}
            disabled={!hasAnyAg}
            badge={<Badge text={hasAnyAg ? "Recommandé" : "Aucune AG"} kind={hasAnyAg ? "info" : "warning"} />}
          />
        </div>
      </Card>

      <AlertBox kind="info">
        <div style={{ fontWeight: 800, marginBottom: 4 }}>Visibilité produit AG</div>
        <div style={{ fontSize: 13 }}>
          Les écrans <strong>Présences</strong> et <strong>Votes</strong> sont maintenant exposés dans la
          page d’accueil du module AG via les accès rapides. Pour une visibilité encore plus forte,
          on pourra ensuite les afficher aussi dans <strong>AGList</strong> et dans le
          <strong> Dashboard</strong>.
        </div>
      </AlertBox>

      <style>{`
        .ag-stat-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .ag-main-grid {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 14px;
        }

        .ag-quick-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        @media (max-width: 1280px) {
          .ag-quick-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 1200px) {
          .ag-stat-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .ag-main-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .ag-stat-grid {
            grid-template-columns: 1fr;
          }

          .ag-quick-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </PageShell>
  );
}

const paragraph: CSSProperties = {
  fontSize: 14,
  color: "#4b5563",
  lineHeight: 1.65,
};

const bulletList: CSSProperties = {
  display: "grid",
  gap: 8,
};

const bulletItem: CSSProperties = {
  fontSize: 14,
  color: "#374151",
  lineHeight: 1.55,
};

const infoBox: CSSProperties = {
  padding: 14,
  borderRadius: 14,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  color: "#475569",
  fontSize: 13,
  lineHeight: 1.6,
};