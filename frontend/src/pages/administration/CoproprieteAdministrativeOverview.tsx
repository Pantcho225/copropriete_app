// frontend/src/pages/administration/CoproprieteAdministrativeOverview.tsx
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";

export default function CoproprieteAdministrativeOverview() {
  return (
    <div style={page}>
      <section style={hero}>
        <p style={eyebrow}>Copropriété</p>
        <h1 style={title}>Vue administrative de la copropriété</h1>
        <p style={subtitle}>
          Cette page centralise les informations de référence de la résidence :
          identité, organisation, structure immobilière, documents et cadre
          réglementaire applicable.
        </p>
      </section>

      <section style={grid}>
        <div style={panel}>
          <h2 style={panelTitle}>Identité de la copropriété</h2>
          <div style={list}>
            <Info label="Nom" value="Résidence active" />
            <Info label="Adresse" value="À compléter" />
            <Info label="Commune / Ville" value="À compléter" />
            <Info label="Contact syndic" value="À compléter" />
          </div>
        </div>

        <div style={panel}>
          <h2 style={panelTitle}>Structure immobilière</h2>
          <div style={list}>
            <Info label="Bâtiments / blocs" value="À enrichir" />
            <Info label="Lots" value="Voir le référentiel" />
            <Info label="Tantièmes" value="Voir les catégories" />
            <Info label="Occupants" value="À enrichir" />
          </div>

          <div style={actions}>
            <Link to="/platform-admin/referentiel-copropriete" style={button}>
              Ouvrir lots & tantièmes
            </Link>
            <Link
              to="/platform-admin/referentiel-copropriete/coproprietaires"
              style={secondaryButton}
            >
              Ouvrir copropriétaires
            </Link>
          </div>
        </div>

        <div style={panel}>
          <h2 style={panelTitle}>Cadre administratif</h2>
          <p style={text}>
            Cette section préparera les informations institutionnelles :
            règlement de copropriété, règlement intérieur, organes de gestion,
            règles de cotisation, modalités d’assemblée générale et documents de
            référence.
          </p>
          <p style={warning}>
            Les textes juridiques ivoiriens doivent rester informatifs, sourcés
            et validés par un professionnel avant usage officiel.
          </p>
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoRow}>
      <span style={infoLabel}>{label}</span>
      <strong style={infoValue}>{value}</strong>
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
  background: "#f8fafc",
};

const eyebrow: CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  color: "#4f46e5",
};

const title: CSSProperties = {
  margin: "8px 0 0",
  fontSize: 28,
  letterSpacing: -0.7,
};

const subtitle: CSSProperties = {
  margin: "12px 0 0",
  maxWidth: 840,
  fontSize: 15,
  lineHeight: 1.7,
  color: "#475569",
};

const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: 16,
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

const list: CSSProperties = {
  display: "grid",
  gap: 10,
};

const infoRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 0",
  borderBottom: "1px solid #f1f5f9",
};

const infoLabel: CSSProperties = {
  color: "#64748b",
  fontSize: 13,
};

const infoValue: CSSProperties = {
  color: "#111827",
  fontSize: 13,
  textAlign: "right",
};

const text: CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.7,
  color: "#475569",
};

const warning: CSSProperties = {
  margin: "14px 0 0",
  padding: 12,
  borderRadius: 14,
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  color: "#9a3412",
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 700,
};

const actions: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  marginTop: 18,
};

const button: CSSProperties = {
  padding: "10px 13px",
  borderRadius: 14,
  background: "#4f46e5",
  color: "#ffffff",
  fontWeight: 900,
  fontSize: 13,
  textDecoration: "none",
};

const secondaryButton: CSSProperties = {
  padding: "10px 13px",
  borderRadius: 14,
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  color: "#111827",
  fontWeight: 900,
  fontSize: 13,
  textDecoration: "none",
};