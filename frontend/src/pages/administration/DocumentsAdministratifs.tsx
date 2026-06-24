// frontend/src/pages/administration/DocumentsAdministratifs.tsx
import type { CSSProperties } from "react";

const documentTypes = [
  "Règlement de copropriété",
  "Règlement intérieur",
  "PV de rencontre",
  "Compte rendu administratif",
  "Courrier institutionnel",
  "Document de référence",
];

export default function DocumentsAdministratifs() {
  return (
    <div className="adminHarmonizedPage adminDocumentsPage" style={page}>
      <section className="adminHarmonizedHero adminHarmonizedHero--violet" style={hero}>
        <p style={eyebrow}>Documents administratifs</p>
        <h1 style={title}>Bibliothèque administrative de la copropriété</h1>
        <p style={subtitle}>
          Cette page prépare la centralisation des documents institutionnels :
          règlement, comptes rendus, PV, courriers, pièces de référence et
          documents publiables aux copropriétaires.
        </p>
      </section>

      <section className="adminHarmonizedPanel" style={panel}>
        <h2 style={panelTitle}>Types de documents prévus</h2>

        <div className="adminHarmonizedBadgeGrid" style={grid}>
          {documentTypes.map((item) => (
            <div className="adminHarmonizedBadge" key={item} style={documentBadge}>
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="adminHarmonizedEmptyState" style={emptyState}>
        <h2 style={emptyTitle}>Module documentaire administratif à brancher</h2>
        <p style={emptyText}>
          La prochaine étape consistera à relier cette page au backend documentaire
          pour téléverser, classer, publier et tracer les documents administratifs.
        </p>
      </section>
    </div>
  );
}

const page: CSSProperties = {
  display: "grid",
  gap: 24,
};

const hero: CSSProperties = {
  padding: 24,
  borderRadius: 24,
  border: "1px solid #e5e7eb",
  background:
    "linear-gradient(135deg, #f5f3ff 0%, #f8fafc 55%, #ffffff 100%)",
};

const eyebrow: CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  color: "#6d28d9",
};

const title: CSSProperties = {
  margin: "8px 0 0",
  fontSize: 28,
  letterSpacing: -0.7,
};

const subtitle: CSSProperties = {
  margin: "12px 0 0",
  maxWidth: 850,
  fontSize: 15,
  lineHeight: 1.7,
  color: "#475569",
};

const panel: CSSProperties = {
  padding: 20,
  borderRadius: 22,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
};

const panelTitle: CSSProperties = {
  margin: "0 0 14px",
  fontSize: 17,
  fontWeight: 900,
};

const grid: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
};

const documentBadge: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 999,
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  fontSize: 13,
  fontWeight: 900,
  color: "#334155",
};

const emptyState: CSSProperties = {
  padding: 22,
  borderRadius: 22,
  border: "1px dashed #cbd5e1",
  background: "#f8fafc",
};

const emptyTitle: CSSProperties = {
  margin: "0 0 8px",
  fontSize: 17,
  fontWeight: 900,
};

const emptyText: CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.7,
  color: "#64748b",
};