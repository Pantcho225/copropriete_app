// frontend/src/pages/administration/GestionAdministrativeHome.tsx
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";

const cards = [
  {
    title: "Copropriété",
    description:
      "Identité, organisation, structure et informations institutionnelles de la résidence.",
    to: "/gestion-administrative/copropriete",
  },
  {
    title: "Copropriétaires & occupants",
    description:
      "Référentiel des propriétaires, habitants, contacts, lots rattachés et statuts d’occupation.",
    to: "/platform-admin/referentiel-copropriete/coproprietaires",
  },
  {
    title: "Lots & tantièmes",
    description:
      "Lots, bâtiments, niveaux, surfaces et tantièmes utilisés pour les répartitions et les votes.",
    to: "/platform-admin/referentiel-copropriete",
  },
  {
    title: "Assemblées générales",
    description:
      "AG, présences, résolutions, votes, procès-verbaux et cycle institutionnel de décision.",
    to: "/ag",
  },
  {
    title: "Mandats de représentation",
    description:
      "Procurations données par les copropriétaires, validation, rejet et traçabilité.",
    to: "/ag/procurations",
  },
  {
    title: "Réunions & rencontres",
    description:
      "Rencontres avec mairies, ministères, autorités, promoteurs ou partenaires, avec compte rendu publié.",
    to: "/gestion-administrative/reunions-rencontres",
  },
  {
    title: "Règlement & textes applicables",
    description:
      "Règlement intérieur, repères juridiques et textes ivoiriens à valider avant usage officiel.",
    to: "/gestion-administrative/reglement-textes",
  },
  {
    title: "Documents administratifs",
    description:
      "Documents institutionnels, règlements, comptes rendus, PV, courriers et pièces de référence.",
    to: "/gestion-administrative/documents",
  },
];

export default function GestionAdministrativeHome() {
  return (
    <div style={page}>
      <section style={hero}>
        <div>
          <p style={eyebrow}>Gestion administrative</p>
          <h1 style={title}>Centre administratif de la copropriété</h1>
          <p style={subtitle}>
            Regroupez les informations institutionnelles, les copropriétaires,
            les lots, les assemblées générales, les mandats, les réunions et les
            documents administratifs dans un espace unique et lisible.
          </p>
        </div>
      </section>

      <section style={grid}>
        {cards.map((card) => (
          <Link key={card.to} to={card.to} style={cardStyle}>
            <div style={cardTitle}>{card.title}</div>
            <p style={cardText}>{card.description}</p>
            <span style={cardAction}>Ouvrir →</span>
          </Link>
        ))}
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
  background:
    "linear-gradient(135deg, #eef2ff 0%, #f8fafc 52%, #ffffff 100%)",
  border: "1px solid #e5e7eb",
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
  fontSize: 30,
  lineHeight: 1.15,
  letterSpacing: -0.8,
  color: "#111827",
};

const subtitle: CSSProperties = {
  margin: "12px 0 0",
  maxWidth: 820,
  fontSize: 15,
  lineHeight: 1.7,
  color: "#475569",
};

const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 16,
};

const cardStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 20,
  borderRadius: 20,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  textDecoration: "none",
  color: "#111827",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
};

const cardTitle: CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
};

const cardText: CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.6,
  color: "#64748b",
};

const cardAction: CSSProperties = {
  marginTop: 4,
  fontSize: 13,
  fontWeight: 900,
  color: "#4f46e5",
};