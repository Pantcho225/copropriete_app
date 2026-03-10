// src/layout/Topbar.tsx
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

function isValidCoproId(v: string) {
  const s = (v ?? "").trim();
  if (!s) return false;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 && Number.isInteger(n);
}

function getPageTitle(pathname: string) {
  if (pathname === "/") return "Tableau de bord";

  // Comptabilité
  if (pathname === "/compta/import") return "Importer un relevé";
  if (pathname === "/compta/imports") return "Imports bancaires";
  if (pathname.startsWith("/compta/imports/") && pathname.endsWith("/lignes")) {
    return "Lignes importées";
  }
  if (pathname === "/compta/mouvements") return "Mouvements bancaires";
  if (pathname === "/compta/stats") return "Statistiques comptables";

  // RH
  if (pathname === "/rh/employes") return "Employés";
  if (pathname === "/rh/employes/nouveau") return "Nouvel employé";
  if (pathname.startsWith("/rh/employes/") && pathname.endsWith("/modifier")) {
    return "Modifier l’employé";
  }

  if (pathname === "/rh/contrats") return "Contrats";
  if (pathname === "/rh/contrats/nouveau") return "Nouveau contrat";
  if (pathname.startsWith("/rh/contrats/") && pathname.endsWith("/modifier")) {
    return "Modifier le contrat";
  }

  // Travaux
  if (pathname === "/travaux/dossiers") return "Dossiers travaux";
  if (pathname === "/travaux/dossiers/nouveau") return "Nouveau dossier";
  if (pathname.startsWith("/travaux/dossiers/") && pathname.endsWith("/modifier")) {
    return "Modifier le dossier";
  }
  if (
    pathname.startsWith("/travaux/dossiers/") &&
    !pathname.endsWith("/modifier")
  ) {
    return "Détail du dossier travaux";
  }

  if (pathname === "/travaux/fournisseurs") return "Fournisseurs";
  if (pathname === "/travaux/fournisseurs/nouveau") return "Nouveau fournisseur";
  if (pathname.startsWith("/travaux/fournisseurs/") && pathname.endsWith("/modifier")) {
    return "Modifier le fournisseur";
  }

  return "Espace de gestion";
}

function getPageSubtitle(pathname: string) {
  if (pathname === "/") {
    return "Pilotez l’activité de votre copropriété depuis une vue d’ensemble claire et centralisée.";
  }

  // Comptabilité
  if (pathname === "/compta/import") {
    return "Importez un relevé bancaire pour faciliter le traitement et le rapprochement des opérations.";
  }

  if (pathname === "/compta/imports") {
    return "Consultez l’historique des imports bancaires et leur état de traitement.";
  }

  if (pathname.startsWith("/compta/imports/") && pathname.endsWith("/lignes")) {
    return "Traitez les lignes importées, rapprochez-les ou marquez-les selon leur statut métier.";
  }

  if (pathname === "/compta/mouvements") {
    return "Suivez les mouvements bancaires et les opérations enregistrées pour cette copropriété.";
  }

  if (pathname === "/compta/stats") {
    return "Analysez les principaux indicateurs comptables et l’activité bancaire.";
  }

  // RH
  if (pathname === "/rh/employes") {
    return "Gérez les employés rattachés à cette copropriété.";
  }

  if (pathname === "/rh/employes/nouveau") {
    return "Renseignez les informations nécessaires pour enregistrer un nouvel employé.";
  }

  if (pathname.startsWith("/rh/employes/") && pathname.endsWith("/modifier")) {
    return "Mettez à jour les informations de l’employé sélectionné.";
  }

  if (pathname === "/rh/contrats") {
    return "Suivez les contrats, leurs périodes d’activité et leur statut.";
  }

  if (pathname === "/rh/contrats/nouveau") {
    return "Renseignez les informations nécessaires pour enregistrer un nouveau contrat.";
  }

  if (pathname.startsWith("/rh/contrats/") && pathname.endsWith("/modifier")) {
    return "Mettez à jour les informations du contrat sélectionné.";
  }

  // Travaux
  if (pathname === "/travaux/dossiers") {
    return "Pilotez les dossiers travaux, leur budget, leur résolution liée et leur niveau de verrouillage.";
  }

  if (pathname === "/travaux/dossiers/nouveau") {
    return "Renseignez les informations nécessaires pour enregistrer un nouveau dossier dans le module Travaux.";
  }

  if (pathname.startsWith("/travaux/dossiers/") && pathname.endsWith("/modifier")) {
    return "Mettez à jour les informations générales du dossier sélectionné.";
  }

  if (
    pathname.startsWith("/travaux/dossiers/") &&
    !pathname.endsWith("/modifier")
  ) {
    return "Consultez la fiche détaillée du dossier, sa situation budgétaire, la résolution liée et le niveau de verrouillage.";
  }

  if (pathname === "/travaux/fournisseurs") {
    return "Consultez les fournisseurs enregistrés dans le module Travaux et maintenez leurs fiches.";
  }

  if (pathname === "/travaux/fournisseurs/nouveau") {
    return "Renseignez les informations utiles pour enregistrer un nouveau fournisseur dans le module Travaux.";
  }

  if (pathname.startsWith("/travaux/fournisseurs/") && pathname.endsWith("/modifier")) {
    return "Mettez à jour les informations de la fiche fournisseur sélectionnée.";
  }

  return "Interface de gestion de la copropriété.";
}

function SmallButton(props: {
  children: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  primary?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  const tone = props.danger
    ? {
        border: "1px solid #fecaca",
        background: "#fef2f2",
        color: "#991b1b",
      }
    : props.primary
      ? {
          border: "1px solid #c7d2fe",
          background: "#eef2ff",
          color: "#3730a3",
        }
      : {
          border: "1px solid #e5e7eb",
          background: "#ffffff",
          color: "#111827",
        };

  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title}
      style={{
        ...tone,
        padding: "10px 12px",
        borderRadius: 12,
        cursor: props.disabled ? "not-allowed" : "pointer",
        fontWeight: 800,
        fontSize: 13,
        opacity: props.disabled ? 0.65 : 1,
        lineHeight: 1.2,
        whiteSpace: "nowrap",
      }}
    >
      {props.children}
    </button>
  );
}

function ContextBadge(props: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 14,
        background: "#f8fafc",
        border: "1px solid #e5e7eb",
        whiteSpace: "nowrap",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "#64748b",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginBottom: 3,
        }}
      >
        {props.label}
      </div>
      <div
        style={{
          fontSize: 13,
          color: "#111827",
          fontWeight: 900,
          lineHeight: 1.2,
        }}
      >
        {props.value}
      </div>
    </div>
  );
}

export default function Topbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const coproprieteId = useAuthStore((s) => s.coproprieteId);
  const setCopropriete = useAuthStore((s) => s.setCopropriete);
  const logout = useAuthStore((s) => s.logout);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [coproInput, setCoproInput] = useState(coproprieteId ?? "");
  const [coproError, setCoproError] = useState<string | null>(null);

  const pageTitle = useMemo(() => getPageTitle(location.pathname), [location.pathname]);
  const pageSubtitle = useMemo(() => getPageSubtitle(location.pathname), [location.pathname]);

  useEffect(() => {
    if (!isModalOpen) {
      setCoproInput(coproprieteId ?? "");
      setCoproError(null);
    }
  }, [coproprieteId, isModalOpen]);

  const openChangeCoproModal = () => {
    setCoproInput(coproprieteId ?? "");
    setCoproError(null);
    setIsModalOpen(true);
  };

  const closeChangeCoproModal = () => {
    setIsModalOpen(false);
    setCoproError(null);
  };

  const submitChangeCopro = () => {
    const s = coproInput.trim();

    if (!s) {
      setCoproError("L’identifiant de la copropriété est obligatoire.");
      return;
    }

    if (!isValidCoproId(s)) {
      setCoproError("Veuillez saisir un entier strictement positif, par exemple 7 ou 11.");
      return;
    }

    if (s === String(coproprieteId ?? "")) {
      setCoproError("Cette copropriété est déjà active.");
      return;
    }

    setCopropriete(s);
    setIsModalOpen(false);
    setCoproError(null);

    navigate("/", { replace: true });
  };

  const onLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "rgba(255, 255, 255, 0.86)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(229, 231, 235, 0.9)",
        }}
      >
        <div
          style={{
            minHeight: 82,
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              gap: 5,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: 0.9,
                textTransform: "uppercase",
                color: "#6b7280",
              }}
            >
              Plateforme de gestion
            </div>

            <div
              style={{
                fontSize: 24,
                fontWeight: 900,
                color: "#111827",
                lineHeight: 1.1,
                letterSpacing: -0.4,
              }}
            >
              {pageTitle}
            </div>

            <div
              style={{
                fontSize: 13,
                color: "#6b7280",
                lineHeight: 1.45,
                maxWidth: 780,
              }}
            >
              {pageSubtitle}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "flex-end",
            }}
          >
            <ContextBadge
              label="Copropriété active"
              value={coproprieteId ? `#${coproprieteId}` : "Aucune copropriété sélectionnée"}
            />

            <SmallButton
              onClick={openChangeCoproModal}
              title="Changer la copropriété active"
            >
              Changer de copropriété
            </SmallButton>

            <SmallButton onClick={onLogout} title="Se déconnecter">
              Se déconnecter
            </SmallButton>
          </div>
        </div>
      </header>

      {isModalOpen ? (
        <div style={modalBackdrop} onClick={closeChangeCoproModal}>
          <div
            style={modalCard}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-copro-title"
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div
                id="change-copro-title"
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: "#111827",
                  lineHeight: 1.2,
                }}
              >
                Changer de copropriété
              </div>

              <div
                style={{
                  fontSize: 14,
                  color: "#6b7280",
                  lineHeight: 1.55,
                }}
              >
                Saisissez l’identifiant de la copropriété à charger.
                <br />
                Copropriété actuelle :{" "}
                <strong style={{ color: "#111827" }}>
                  {coproprieteId ? `#${coproprieteId}` : "Aucune copropriété sélectionnée"}
                </strong>
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <label htmlFor="copro-id" style={label}>
                Identifiant de la copropriété
              </label>

              <input
                id="copro-id"
                type="text"
                inputMode="numeric"
                value={coproInput}
                onChange={(e) => {
                  setCoproInput(e.target.value);
                  if (coproError) setCoproError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitChangeCopro();
                  if (e.key === "Escape") closeChangeCoproModal();
                }}
                placeholder="Ex. : 11"
                autoFocus
                style={{
                  ...input,
                  borderColor: coproError ? "#fecaca" : "#d1d5db",
                  background: coproError ? "#fffafa" : "#ffffff",
                }}
              />
            </div>

            {coproError ? (
              <div
                style={{
                  marginTop: 12,
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#991b1b",
                  fontSize: 13,
                  lineHeight: 1.45,
                }}
              >
                {coproError}
              </div>
            ) : (
              <div
                style={{
                  marginTop: 12,
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "#f8fafc",
                  border: "1px solid #e5e7eb",
                  color: "#64748b",
                  fontSize: 13,
                  lineHeight: 1.45,
                }}
              >
                Utilisez un identifiant numérique valide correspondant à une copropriété existante.
              </div>
            )}

            <div
              style={{
                marginTop: 20,
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <SmallButton onClick={closeChangeCoproModal}>Annuler</SmallButton>
              <SmallButton onClick={submitChangeCopro} primary>
                Valider
              </SmallButton>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

const modalBackdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: 16,
  zIndex: 1000,
};

const modalCard: CSSProperties = {
  width: "min(500px, 96vw)",
  background: "#ffffff",
  borderRadius: 24,
  padding: 22,
  border: "1px solid #e5e7eb",
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)",
};

const label: CSSProperties = {
  display: "block",
  marginBottom: 8,
  fontSize: 13,
  fontWeight: 800,
  color: "#4b5563",
};

const input: CSSProperties = {
  width: "100%",
  padding: "12px 13px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};