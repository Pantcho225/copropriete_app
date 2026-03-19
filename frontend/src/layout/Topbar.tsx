import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { getPageSubtitle, getPageTitle } from "../config/productNavigation";

function isValidCoproId(value: string) {
  const normalized = (value ?? "").trim();
  if (!normalized) return false;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 && Number.isInteger(parsed);
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
        ...buttonBase,
        ...tone,
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.6 : 1,
      }}
    >
      {props.children}
    </button>
  );
}

function ContextBadge(props: { label: string; value: string }) {
  return (
    <div style={contextBadge}>
      <div style={contextBadgeLabel}>{props.label}</div>
      <div style={contextBadgeValue}>{props.value}</div>
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
  const pageSubtitle = useMemo(
    () => getPageSubtitle(location.pathname),
    [location.pathname]
  );

  const activeCoproLabel = coproprieteId
    ? `#${coproprieteId}`
    : "Aucune copropriété active";

  useEffect(() => {
    if (!isModalOpen) {
      setCoproInput(coproprieteId ?? "");
      setCoproError(null);
    }
  }, [coproprieteId, isModalOpen]);

  useEffect(() => {
    if (!isModalOpen) return;

    const onKeyDown = (event: KeyboardEvent | globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsModalOpen(false);
        setCoproError(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isModalOpen]);

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
    const normalized = coproInput.trim();

    if (!normalized) {
      setCoproError("L’identifiant de la copropriété est requis.");
      return;
    }

    if (!isValidCoproId(normalized)) {
      setCoproError(
        "Veuillez saisir un identifiant numérique valide, par exemple 7 ou 11."
      );
      return;
    }

    if (normalized === String(coproprieteId ?? "")) {
      setCoproError("Cette copropriété est déjà active.");
      return;
    }

    setCopropriete(normalized);
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
      <header style={headerStyle}>
        <div style={headerInner}>
          <div style={headingBlock}>
            <div style={eyebrowStyle}>Plateforme de gestion de copropriété</div>

            <div style={titleStyle}>{pageTitle}</div>

            <div style={subtitleStyle}>{pageSubtitle}</div>
          </div>

          <div style={actionsBlock}>
            <ContextBadge
              label="Copropriété active"
              value={activeCoproLabel}
            />

            <SmallButton
              onClick={openChangeCoproModal}
              title="Changer la copropriété active"
            >
              Changer de copropriété
            </SmallButton>

            <SmallButton onClick={onLogout} title="Se déconnecter">
              Déconnexion
            </SmallButton>
          </div>
        </div>
      </header>

      {isModalOpen ? (
        <div
          style={modalBackdrop}
          onClick={closeChangeCoproModal}
          aria-hidden="true"
        >
          <div
            style={modalCard}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-copro-title"
            aria-describedby="change-copro-description"
          >
            <div style={modalHeader}>
              <div id="change-copro-title" style={modalTitle}>
                Changer de copropriété
              </div>

              <div id="change-copro-description" style={modalDescription}>
                Saisissez l’identifiant de la copropriété à charger dans votre
                session de travail.
                <br />
                Copropriété actuellement active :{" "}
                <strong style={{ color: "#111827" }}>{activeCoproLabel}</strong>
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <label htmlFor="copro-id" style={labelStyle}>
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
                }}
                placeholder="Ex. : 11"
                autoFocus
                aria-invalid={Boolean(coproError)}
                aria-describedby="copro-id-help"
                style={{
                  ...inputStyle,
                  borderColor: coproError ? "#fecaca" : "#d1d5db",
                  background: coproError ? "#fffafa" : "#ffffff",
                }}
              />
            </div>

            {coproError ? (
              <div id="copro-id-help" style={errorBox}>
                {coproError}
              </div>
            ) : (
              <div id="copro-id-help" style={helpBox}>
                Utilisez un identifiant numérique valide correspondant à une
                copropriété existante.
              </div>
            )}

            <div style={modalActions}>
              <SmallButton onClick={closeChangeCoproModal}>Annuler</SmallButton>
              <SmallButton onClick={submitChangeCopro} primary>
                Valider le changement
              </SmallButton>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

const headerStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 20,
  background: "rgba(255, 255, 255, 0.88)",
  backdropFilter: "blur(14px)",
  borderBottom: "1px solid rgba(229, 231, 235, 0.92)",
};

const headerInner: CSSProperties = {
  minHeight: 84,
  padding: "16px 20px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
};

const headingBlock: CSSProperties = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 6,
  flex: "1 1 480px",
};

const eyebrowStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.9,
  textTransform: "uppercase",
  color: "#6b7280",
};

const titleStyle: CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  color: "#111827",
  lineHeight: 1.1,
  letterSpacing: -0.4,
};

const subtitleStyle: CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
  lineHeight: 1.5,
  maxWidth: 780,
};

const actionsBlock: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "flex-end",
};

const contextBadge: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 14,
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  whiteSpace: "nowrap",
};

const contextBadgeLabel: CSSProperties = {
  fontSize: 11,
  color: "#64748b",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  marginBottom: 3,
};

const contextBadgeValue: CSSProperties = {
  fontSize: 13,
  color: "#111827",
  fontWeight: 900,
  lineHeight: 1.2,
};

const buttonBase: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  fontWeight: 800,
  fontSize: 13,
  lineHeight: 1.2,
  whiteSpace: "nowrap",
  transition: "all 0.2s ease",
};

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
  width: "min(520px, 96vw)",
  background: "#ffffff",
  borderRadius: 24,
  padding: 22,
  border: "1px solid #e5e7eb",
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)",
};

const modalHeader: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const modalTitle: CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  color: "#111827",
  lineHeight: 1.2,
};

const modalDescription: CSSProperties = {
  fontSize: 14,
  color: "#6b7280",
  lineHeight: 1.6,
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: 8,
  fontSize: 13,
  fontWeight: 800,
  color: "#4b5563",
};

const inputStyle: CSSProperties = {
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

const helpBox: CSSProperties = {
  marginTop: 12,
  padding: "10px 12px",
  borderRadius: 12,
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.45,
};

const errorBox: CSSProperties = {
  marginTop: 12,
  padding: "10px 12px",
  borderRadius: 12,
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  fontSize: 13,
  lineHeight: 1.45,
};

const modalActions: CSSProperties = {
  marginTop: 20,
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
};