// frontend/src/pages/administration/GestionAdministrativeHome.tsx
import { Link } from "react-router-dom";
import ModuleHero from "../../components/ui/ModuleHero";
import ModuleSection from "../../components/ui/ModuleSection";

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
    <div className="modulePageStack">
      <ModuleHero
        eyebrow="Gestion administrative"
        title="Centre administratif de la copropriété"
        subtitle="Regroupez les informations institutionnelles, les copropriétaires, les lots, les assemblées générales, les mandats, les réunions et les documents administratifs dans un espace unique, lisible et cohérent."
      />

      <ModuleSection
        eyebrow="Référentiel administratif"
        title="Accès aux espaces de gestion"
        subtitle="Ouvrez rapidement les principales rubriques administratives liées à la copropriété active."
      >
        <div className="moduleLinkGrid">
          {cards.map((card) => (
            <Link key={card.to} to={card.to} className="moduleNavCard">
              <div className="moduleNavCard__title">{card.title}</div>
              <p className="moduleNavCard__text">{card.description}</p>
              <span className="moduleNavCard__action">Ouvrir →</span>
            </Link>
          ))}
        </div>
      </ModuleSection>
    </div>
  );
}
