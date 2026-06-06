// frontend/src/pages/administration/ReglementTextesApplicables.tsx
import type { CSSProperties } from "react";

export default function ReglementTextesApplicables() {
  return (
    <div style={page}>
      <section style={hero}>
        <p style={eyebrow}>Règlement & textes applicables</p>
        <h1 style={title}>Repères réglementaires de la copropriété</h1>
        <p style={subtitle}>
          Cette section prépare l’affichage des règles internes, du règlement de
          copropriété, du règlement intérieur et des repères juridiques ivoiriens
          utiles à la gestion administrative.
        </p>
      </section>

      <section style={panel}>
        <h2 style={panelTitle}>Important</h2>
        <p style={text}>
          Les contenus juridiques affichés dans cette partie devront être
          informatifs, sourcés et validés par un professionnel du droit avant
          toute utilisation officielle auprès des copropriétaires.
        </p>
      </section>

      <section style={grid}>
        <div style={card}>
          <h2 style={cardTitle}>Règlement de copropriété</h2>
          <p style={cardText}>
            Document de référence précisant les règles d’usage, les parties
            communes, les parties privatives, les tantièmes et les obligations.
          </p>
        </div>

        <div style={card}>
          <h2 style={cardTitle}>Règlement intérieur</h2>
          <p style={cardText}>
            Règles pratiques de vie commune : bruit, stationnement, sécurité,
            propreté, utilisation des équipements et respect des parties communes.
          </p>
        </div>

        <div style={card}>
          <h2 style={cardTitle}>Textes applicables</h2>
          <p style={cardText}>
            Espace prévu pour les rappels institutionnels et juridiques liés à la
            copropriété en Côte d’Ivoire, à valider avant diffusion.
          </p>
        </div>
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
    "linear-gradient(135deg, #fefce8 0%, #f8fafc 55%, #ffffff 100%)",
};

const eyebrow: CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  color: "#a16207",
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
  padding: 18,
  borderRadius: 20,
  border: "1px solid #fed7aa",
  background: "#fff7ed",
};

const panelTitle: CSSProperties = {
  margin: "0 0 8px",
  fontSize: 16,
  fontWeight: 900,
  color: "#9a3412",
};

const text: CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.7,
  color: "#9a3412",
  fontWeight: 700,
};

const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 16,
};

const card: CSSProperties = {
  padding: 20,
  borderRadius: 22,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
};

const cardTitle: CSSProperties = {
  margin: "0 0 8px",
  fontSize: 16,
  fontWeight: 900,
};

const cardText: CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.6,
  color: "#64748b",
};