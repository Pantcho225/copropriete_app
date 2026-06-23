// frontend/src/pages/coproprietaire/CoproprietaireMesLots.tsx
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";

import {
  getMesLotsCoproprietaire,
  type CoproprietaireLot,
} from "../../api/coproprietaire";
import ModuleHero from "../../components/ui/ModuleHero";
import ModuleStatCard from "../../components/ui/ModuleStatCard";

type MesLotsResponse = Awaited<ReturnType<typeof getMesLotsCoproprietaire>>;

type PageState = {
  loading: boolean;
  data: MesLotsResponse | null;
  error: string | null;
};

type StatTone = "blue" | "green" | "indigo" | "slate";

function toModuleStatTone(tone: StatTone) {
  const toneKey = String(tone);

  if (toneKey === "green") return "green";
  if (toneKey === "blue") return "blue";
  if (toneKey === "amber" || toneKey === "orange") return "amber";
  if (toneKey === "red" || toneKey === "rose") return "red";
  if (toneKey === "indigo") return "purple";

  return "neutral";
}

export default function CoproprietaireMesLots() {
  const [state, setState] = useState<PageState>({
    loading: true,
    data: null,
    error: null,
  });

  const [search, setSearch] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadLots() {
      try {
        const data = await getMesLotsCoproprietaire();

        if (!mounted) return;

        setState({
          loading: false,
          data,
          error: null,
        });
      } catch (error) {
        console.error("Erreur chargement lots copropriétaire", error);

        if (!mounted) return;

        setState({
          loading: false,
          data: null,
          error: "Impossible de charger vos lots pour le moment.",
        });
      }
    }

    void loadLots();

    return () => {
      mounted = false;
    };
  }, []);

  const lots = useMemo(() => {
    return state.data?.lots ?? [];
  }, [state.data?.lots]);

  const filteredLots = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return lots;

    return lots.filter((lot) => {
      const values = [
        getLotLabel(lot),
        lot.reference,
        lot.numero,
        lot.type_lot,
        lot.description,
        lot.copropriete?.nom,
        lot.etage,
        lot.type_droit,
      ];

      return values.some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(query),
      );
    });
  }, [lots, search]);

  const totalQuotePart = useMemo(() => {
    return lots.reduce((sum, lot) => sum + toNumber(lot.quote_part), 0);
  }, [lots]);

  const totalSurface = useMemo(() => {
    return lots.reduce((sum, lot) => sum + toNumber(lot.surface), 0);
  }, [lots]);

  const coproprieteName =
    lots[0]?.copropriete?.nom || "Copropriété non définie";

  const coproprietaireName = formatCoproprietaireName(state.data);

  if (state.loading) {
    return (
      <div style={styles.loadingCard}>
        <div style={styles.loadingIcon}>🏢</div>
        <div>
          <p style={styles.loadingTitle}>Chargement de vos lots...</p>
          <p style={styles.muted}>
            Nous récupérons uniquement les lots associés à votre compte.
          </p>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div style={styles.alertDanger}>
        <strong>Erreur de chargement</strong>
        <p style={styles.alertText}>{state.error}</p>
      </div>
    );
  }

  return (
    <div className="coproOwnerPage" style={styles.stack}>
      <ModuleHero
        eyebrow="Patrimoine personnel"
        title="Vos lots rattachés"
        subtitle="Consultez les lots associés à votre compte copropriétaire. Les informations affichées sont filtrées côté serveur selon votre profil et vos droits d’accès."
        aside={
          <div className="coproOwnerSecureBox" style={styles.secureBox}>
            <div style={styles.secureIcon}>🔐</div>
            <p style={styles.secureTitle}>Accès personnel</p>
            <p style={styles.secureText}>
              Vous ne voyez que les lots liés à votre compte copropriétaire.
            </p>
          </div>
        }
      >
        <div className="coproOwnerHeroMeta" style={styles.heroMeta}>
          <span style={styles.metaPill}>Copropriété : {coproprieteName}</span>
          <span style={styles.metaPill}>
            Copropriétaire : {coproprietaireName}
          </span>
          <span style={styles.metaPill}>
            {formatNumber(lots.length)} lot(s) visible(s)
          </span>
        </div>
      </ModuleHero>

      <section className="moduleStatsGrid coproOwnerStatsGrid">
        <StatCard
          title="Lots visibles"
          value={formatNumber(lots.length)}
          description="Lots rattachés à votre compte"
          tone="blue"
        />
        <StatCard
          title="Quote-part totale"
          value={formatNumber(totalQuotePart)}
          description="Quote-part cumulée sur vos lots"
          tone="green"
        />
        <StatCard
          title="Surface totale"
          value={totalSurface > 0 ? `${formatNumber(totalSurface)} m²` : "—"}
          description="Surface cumulée renseignée"
          tone="indigo"
        />
        <StatCard
          title="Copropriété"
          value={coproprieteName}
          description="Résidence de rattachement"
          tone="slate"
        />
      </section>

      <section style={styles.card}>
        <div className="coproOwnerSectionHeader" style={styles.sectionHeader}>
          <div>
            <p style={styles.sectionEyebrow}>Patrimoine</p>
            <h3 style={styles.sectionTitle}>Liste de vos lots</h3>
            <p style={styles.sectionText}>
              Retrouvez les références, surfaces, droits et quotes-parts
              associées à vos biens.
            </p>
          </div>

          <div className="coproOwnerHeaderActions" style={styles.headerActions}>
            <Link to="/coproprietaire/appels" style={styles.secondaryButton}>
              Voir mes charges
            </Link>
            <Link to="/coproprietaire/documents" style={styles.primaryButton}>
              Mes documents
            </Link>
          </div>
        </div>

        <div className="coproOwnerToolbar" style={styles.toolbar}>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher par référence, numéro, étage, type..."
            style={styles.searchInput}
          />

          <div style={styles.resultPill}>
            {formatNumber(filteredLots.length)} résultat(s)
          </div>
        </div>

        {lots.length === 0 ? (
          <EmptyState
            title="Aucun lot trouvé"
            text="Aucun lot n’est actuellement rattaché à votre compte copropriétaire."
          />
        ) : filteredLots.length === 0 ? (
          <EmptyState
            title="Aucun résultat"
            text="Aucun lot ne correspond à votre recherche actuelle."
          />
        ) : (
          <div className="coproOwnerLotsGrid" style={styles.lotsGrid}>
            {filteredLots.map((lot) => (
              <LotCard key={getLotKey(lot)} lot={lot} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function LotCard({ lot }: { lot: CoproprietaireLot }) {
  const label = getLotLabel(lot);
  const typeLot = lot.type_lot || "Lot";
  const quotePart = toNumber(lot.quote_part);
  const surface = toNumber(lot.surface);

  return (
    <article style={styles.lotCard}>
      <div className="coproOwnerSectionHeader" style={styles.lotHeader}>
        <div style={styles.lotTitleBlock}>
          <p style={styles.lotEyebrow}>Lot copropriétaire</p>
          <h4 style={styles.lotTitle}>{label}</h4>
        </div>

        <span style={styles.badge}>{typeLot}</span>
      </div>

      <p style={styles.lotDescription}>
        {lot.description || "Aucune description renseignée pour ce lot."}
      </p>

      <div className="coproOwnerTwoColumnGrid" style={styles.highlightRow}>
        <div style={styles.highlightItem}>
          <span style={styles.highlightLabel}>Quote-part</span>
          <strong style={styles.highlightValue}>{formatNumber(quotePart)}</strong>
        </div>

        <div style={styles.highlightItem}>
          <span style={styles.highlightLabel}>Surface</span>
          <strong style={styles.highlightValue}>
            {surface > 0 ? `${formatNumber(surface)} m²` : "—"}
          </strong>
        </div>
      </div>

      <div style={styles.infoGrid}>
        <InfoItem label="Copropriété" value={lot.copropriete?.nom || "—"} />
        <InfoItem label="Référence" value={lot.reference || lot.numero || "—"} />
        <InfoItem label="Étage" value={lot.etage || "—"} />
        <InfoItem label="Droit" value={formatDroit(lot.type_droit)} />
      </div>
    </article>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.infoItem}>
      <span style={styles.infoLabel}>{label}</span>
      <strong style={styles.infoValue}>{value}</strong>
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
  tone,
}: {
  title: string;
  value: string;
  description: string;
  tone: StatTone;
}) {
  return (
    <ModuleStatCard
      label={title}
      value={value}
      hint={description}
      tone={toModuleStatTone(tone)}
    />
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div style={styles.emptyState}>
      <div style={styles.emptyIcon}>🏢</div>
      <p style={styles.emptyTitle}>{title}</p>
      <p style={styles.emptyText}>{text}</p>
    </div>
  );
}

function formatCoproprietaireName(data: MesLotsResponse | null) {
  const coproprietaire = data?.coproprietaire;

  if (!coproprietaire) return "Copropriétaire";

  const fullName = [coproprietaire.prenoms, coproprietaire.nom]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || coproprietaire.email || "Copropriétaire";
}

function getLotKey(lot: CoproprietaireLot) {
  return lot.lot_id ?? lot.id ?? `${lot.reference || lot.numero || "lot"}`;
}

function getLotLabel(lot: CoproprietaireLot) {
  if (lot.label) return lot.label;
  if (lot.reference) return lot.reference;
  if (lot.numero) return lot.numero;

  const id = lot.lot_id ?? lot.id;

  return id ? `Lot #${id}` : "Lot";
}

function formatDroit(value: string | undefined) {
  if (!value) return "—";

  const normalized = value.trim().toUpperCase();

  const labels: Record<string, string> = {
    PROPRIETAIRE: "Propriétaire",
    PROPRIÉTAIRE: "Propriétaire",
    NUE_PROPRIETE: "Nue-propriété",
    USUFRUIT: "Usufruit",
    INDIVISION: "Indivision",
  };

  return labels[normalized] || value;
}

function toNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatNumber(value: number | string | null | undefined) {
  const numberValue = toNumber(value);

  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 2,
  }).format(numberValue);
}

const styles: Record<string, CSSProperties> = {
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: 22,
  },

  hero: {
    borderRadius: 34,
    padding: 30,
    background:
      "linear-gradient(135deg, rgba(15,23,42,0.97), rgba(37,99,235,0.92)), radial-gradient(circle at top right, rgba(125,211,252,0.46), transparent 36%)",
    color: "white",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 320px",
    gap: 24,
    boxShadow: "0 30px 85px rgba(15,23,42,0.26)",
    overflow: "hidden",
  },

  heroContent: {
    minWidth: 0,
  },

  heroBadge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "7px 11px",
    background: "rgba(255,255,255,0.13)",
    border: "1px solid rgba(255,255,255,0.18)",
    color: "#dbeafe",
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },

  heroTitle: {
    margin: "14px 0 0",
    fontSize: 34,
    lineHeight: 1.08,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },

  heroText: {
    margin: "14px 0 0",
    maxWidth: 780,
    color: "#dbeafe",
    fontSize: 15,
    lineHeight: 1.75,
    fontWeight: 550,
  },

  heroMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 22,
  },

  metaPill: {
    borderRadius: 999,
    padding: "8px 12px",
    background: "rgba(255,255,255,0.14)",
    border: "1px solid rgba(255,255,255,0.20)",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 850,
  },

  secureBox: {
    alignSelf: "stretch",
    borderRadius: 28,
    padding: 22,
    background: "rgba(255,255,255,0.13)",
    border: "1px solid rgba(255,255,255,0.22)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)",
  },

  secureIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    background: "rgba(255,255,255,0.14)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    marginBottom: 14,
  },

  secureTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 950,
  },

  secureText: {
    margin: "10px 0 0",
    color: "#dbeafe",
    fontSize: 14,
    lineHeight: 1.6,
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 16,
  },

  statCard: {
    border: "1px solid",
    borderRadius: 26,
    padding: 19,
    boxShadow: "0 16px 44px rgba(15,23,42,0.06)",
    minHeight: 134,
  },

  statTitle: {
    margin: 0,
    color: "#64748b",
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },

  statValue: {
    margin: "12px 0 0",
    fontSize: 24,
    lineHeight: 1.2,
    fontWeight: 950,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  statDescription: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.55,
    fontWeight: 650,
  },

  card: {
    borderRadius: 30,
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(226,232,240,0.95)",
    boxShadow: "0 20px 64px rgba(15,23,42,0.08)",
    padding: 24,
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    alignItems: "flex-start",
  },

  sectionEyebrow: {
    margin: 0,
    fontSize: 11,
    fontWeight: 950,
    color: "#2563eb",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },

  sectionTitle: {
    margin: "7px 0 0",
    fontSize: 21,
    lineHeight: 1.2,
    fontWeight: 950,
    color: "#0f172a",
    letterSpacing: "-0.02em",
  },

  sectionText: {
    margin: "8px 0 0",
    maxWidth: 720,
    fontSize: 13,
    lineHeight: 1.6,
    color: "#64748b",
    fontWeight: 650,
  },

  headerActions: {
    display: "flex",
    gap: 10,
    flexShrink: 0,
  },

  primaryButton: {
    borderRadius: 16,
    padding: "10px 13px",
    background: "#0f172a",
    color: "#ffffff",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 900,
    boxShadow: "0 12px 30px rgba(15,23,42,0.16)",
  },

  secondaryButton: {
    borderRadius: 16,
    padding: "10px 13px",
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 900,
  },

  toolbar: {
    marginTop: 20,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 12,
    alignItems: "center",
  },

  searchInput: {
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    borderRadius: 18,
    padding: "13px 15px",
    color: "#0f172a",
    fontSize: 14,
    outline: "none",
  },

  resultPill: {
    borderRadius: 999,
    padding: "10px 13px",
    background: "#eef2ff",
    border: "1px solid #c7d2fe",
    color: "#4f46e5",
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  lotsGrid: {
    marginTop: 20,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 16,
  },

  lotCard: {
    borderRadius: 26,
    border: "1px solid #e2e8f0",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96))",
    padding: 19,
    boxShadow: "0 16px 44px rgba(15,23,42,0.06)",
  },

  lotHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },

  lotTitleBlock: {
    minWidth: 0,
  },

  lotEyebrow: {
    margin: 0,
    color: "#2563eb",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
  },

  lotTitle: {
    margin: "7px 0 0",
    color: "#0f172a",
    fontSize: 23,
    lineHeight: 1.1,
    fontWeight: 950,
    letterSpacing: "-0.03em",
  },

  lotDescription: {
    margin: "13px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.65,
    fontWeight: 600,
  },

  badge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "7px 10px",
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  highlightRow: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },

  highlightItem: {
    borderRadius: 18,
    background: "#eef2ff",
    border: "1px solid #c7d2fe",
    padding: 13,
  },

  highlightLabel: {
    display: "block",
    color: "#4f46e5",
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },

  highlightValue: {
    display: "block",
    marginTop: 7,
    color: "#0f172a",
    fontSize: 18,
    fontWeight: 950,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  infoGrid: {
    marginTop: 12,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },

  infoItem: {
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    padding: 12,
  },

  infoLabel: {
    display: "block",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 850,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  infoValue: {
    display: "block",
    marginTop: 6,
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 950,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  emptyState: {
    marginTop: 20,
    borderRadius: 26,
    border: "1px dashed #cbd5e1",
    background: "#f8fafc",
    padding: 30,
    textAlign: "center",
  },

  emptyIcon: {
    width: 48,
    height: 48,
    margin: "0 auto 12px",
    borderRadius: 18,
    background: "#eef2ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
  },

  emptyTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 17,
    fontWeight: 950,
  },

  emptyText: {
    margin: "8px auto 0",
    maxWidth: 620,
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.65,
    fontWeight: 600,
  },

  alertDanger: {
    borderRadius: 26,
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#991b1b",
    padding: 22,
    boxShadow: "0 18px 44px rgba(190,18,60,0.08)",
  },

  alertText: {
    margin: "8px 0 0",
    fontSize: 14,
    lineHeight: 1.6,
  },

  loadingCard: {
    borderRadius: 28,
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(226,232,240,0.95)",
    boxShadow: "0 18px 60px rgba(15,23,42,0.08)",
    padding: 24,
    display: "flex",
    alignItems: "center",
    gap: 14,
  },

  loadingIcon: {
    width: 46,
    height: 46,
    borderRadius: 18,
    background: "#eef2ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    flexShrink: 0,
  },

  loadingTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 950,
    color: "#0f172a",
  },

  muted: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 13,
    fontWeight: 600,
  },
};