// frontend/src/pages/auth/ResetPassword.tsx

import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { confirmPasswordReset } from "../../api/auth";

function extractApiError(error: unknown): string {
  const maybeError = error as {
    response?: {
      data?: {
        detail?: string;
        token?: string[];
        new_password?: string[];
        confirm_password?: string[];
        non_field_errors?: string[];
      };
      status?: number;
    };
    message?: string;
  };

  const data = maybeError.response?.data;

  if (data?.detail) return data.detail;
  if (data?.token?.length) return data.token[0];
  if (data?.new_password?.length) return data.new_password[0];
  if (data?.confirm_password?.length) return data.confirm_password[0];
  if (data?.non_field_errors?.length) return data.non_field_errors[0];

  if (maybeError.response?.status) {
    return `Une erreur est survenue (${maybeError.response.status}). Veuillez réessayer.`;
  }

  return maybeError.message || "Impossible de joindre le serveur.";
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const tokenFromUrl = searchParams.get("token") || "";
  const hasTokenInUrl = tokenFromUrl.trim().length > 0;

  const [token, setToken] = useState(tokenFromUrl);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    document.documentElement.classList.add("authPremiumHtml");
    document.body.classList.add("authPremiumBody");

    return () => {
      document.documentElement.classList.remove("authPremiumHtml");
      document.body.classList.remove("authPremiumBody");
    };
  }, []);

  const canSubmit = useMemo(() => {
    return (
      token.trim().length > 10 &&
      newPassword.trim().length > 0 &&
      confirmPassword.trim().length > 0 &&
      !submitting
    );
  }, [token, newPassword, confirmPassword, submitting]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) return;

    setSubmitting(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const response = await confirmPasswordReset({
        token: token.trim(),
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      setSuccessMessage(response.detail);

      window.setTimeout(() => {
        navigate("/login", { replace: true });
      }, 1200);
    } catch (error) {
      setErrorMessage(extractApiError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={styles.page} className="authPremiumPage">
      <div style={styles.goldGlow} />
      <div style={styles.blueGlow} />
      <div style={styles.gridOverlay} />

      <section style={styles.card} className="authPremiumCard">
        <div style={styles.brandRow}>
          <div style={styles.brandMark}>CP</div>

          <div>
            <div style={styles.brandName}>Copropriété SaaS</div>
            <div style={styles.brandSubline}>Sécurisation du compte</div>
          </div>
        </div>

        <div style={styles.header}>
          <div style={styles.badge}>Réinitialisation sécurisée</div>

          <h1 style={styles.title} className="authPremiumTitle">
            Nouveau mot de passe
          </h1>

          <p style={styles.description}>
            Définissez un nouveau mot de passe pour récupérer l’accès à votre
            espace. Après validation, vous pourrez vous reconnecter normalement.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {hasTokenInUrl ? (
            <div style={styles.infoBox}>
              Lien de récupération détecté. Saisissez votre nouveau mot de passe
              pour finaliser la sécurisation du compte.
            </div>
          ) : (
            <div style={styles.fieldGroup}>
              <label htmlFor="token" style={styles.label}>
                Token de récupération
              </label>

              <textarea
                id="token"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="Collez le token reçu"
                rows={3}
                style={styles.textarea}
                className="authPremiumInput"
              />
            </div>
          )}

          <div style={styles.fieldGroup}>
            <label htmlFor="newPassword" style={styles.label}>
              Nouveau mot de passe
            </label>

            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Votre nouveau mot de passe"
              autoComplete="new-password"
              style={styles.input}
              className="authPremiumInput"
            />
          </div>

          <div style={styles.fieldGroup}>
            <label htmlFor="confirmPassword" style={styles.label}>
              Confirmer le mot de passe
            </label>

            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirmez le nouveau mot de passe"
              autoComplete="new-password"
              style={styles.input}
              className="authPremiumInput"
            />
          </div>

          {successMessage ? (
            <div style={styles.successBox}>{successMessage}</div>
          ) : null}

          {errorMessage ? (
            <div style={styles.errorBox}>{errorMessage}</div>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              ...styles.primaryButton,
              opacity: canSubmit ? 1 : 0.62,
              cursor: canSubmit ? "pointer" : "not-allowed",
            }}
            className="authPremiumButton"
          >
            {submitting ? "Réinitialisation en cours..." : "Réinitialiser le mot de passe"}
          </button>
        </form>

        <div style={styles.footer}>
          <Link to="/forgot-password" style={styles.secondaryLink}>
            Demander un nouveau lien
          </Link>

          <span style={styles.footerSeparator}>•</span>

          <Link to="/login" style={styles.secondaryLink}>
            Retour à la connexion
          </Link>
        </div>
      </section>

      <style>{authPremiumCss}</style>
    </main>
  );
}

const authPremiumCss = `
  html.authPremiumHtml,
  body.authPremiumBody {
    width: 100%;
    min-width: 320px;
    overflow: hidden !important;
  }

  body.authPremiumBody {
    display: block !important;
    place-items: initial !important;
    min-height: 100vh !important;
  }

  body.authPremiumBody #root {
    width: 100% !important;
    max-width: none !important;
    min-height: 100vh !important;
    margin: 0 !important;
    padding: 0 !important;
    text-align: left !important;
  }

  .authPremiumInput::placeholder {
    color: rgba(100, 116, 139, 0.74);
  }

  .authPremiumInput:focus {
    border-color: rgba(184, 134, 45, 0.72) !important;
    box-shadow: 0 0 0 4px rgba(184, 134, 45, 0.14) !important;
    background: #ffffff !important;
  }

  .authPremiumButton:not(:disabled):hover {
    transform: translateY(-1px);
    box-shadow: 0 22px 42px rgba(120, 79, 18, 0.32) !important;
  }

  @media (max-width: 720px) {
    .authPremiumPage {
      padding: 16px !important;
      align-items: flex-start !important;
      overflow-y: auto !important;
    }

    .authPremiumCard {
      border-radius: 24px !important;
      padding: 22px !important;
    }

    .authPremiumTitle {
      font-size: 1.9rem !important;
    }
  }
`;

const styles: Record<string, CSSProperties> = {
  page: {
    position: "fixed",
    inset: 0,
    minHeight: "100vh",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    boxSizing: "border-box",
    background:
      "radial-gradient(circle at 12% 12%, rgba(218, 165, 32, 0.18), transparent 30%), radial-gradient(circle at 85% 18%, rgba(59, 130, 246, 0.18), transparent 34%), linear-gradient(135deg, #07111f 0%, #0f172a 44%, #111827 100%)",
  },
  goldGlow: {
    position: "absolute",
    top: -160,
    left: -120,
    width: 420,
    height: 420,
    borderRadius: "50%",
    background: "rgba(218, 165, 32, 0.22)",
    filter: "blur(55px)",
    pointerEvents: "none",
  },
  blueGlow: {
    position: "absolute",
    right: -120,
    bottom: -160,
    width: 460,
    height: 460,
    borderRadius: "50%",
    background: "rgba(37, 99, 235, 0.18)",
    filter: "blur(60px)",
    pointerEvents: "none",
  },
  gridOverlay: {
    position: "absolute",
    inset: 0,
    opacity: 0.16,
    backgroundImage:
      "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
    backgroundSize: "42px 42px",
    pointerEvents: "none",
  },
  card: {
    position: "relative",
    zIndex: 1,
    width: "100%",
    maxWidth: 540,
    borderRadius: 34,
    padding: 34,
    border: "1px solid rgba(255, 255, 255, 0.72)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.94) 100%)",
    boxShadow: "0 34px 90px rgba(0, 0, 0, 0.28)",
    boxSizing: "border-box",
  },
  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 24,
  },
  brandMark: {
    width: 48,
    height: 48,
    borderRadius: 17,
    display: "grid",
    placeItems: "center",
    color: "#0f172a",
    fontWeight: 950,
    letterSpacing: "-0.05em",
    background: "linear-gradient(135deg, #f8e7b1 0%, #c99738 100%)",
    boxShadow: "0 14px 30px rgba(201, 151, 56, 0.28)",
  },
  brandName: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: 950,
    letterSpacing: "-0.03em",
  },
  brandSubline: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 750,
  },
  header: {
    display: "grid",
    gap: 10,
  },
  badge: {
    width: "fit-content",
    borderRadius: 999,
    padding: "7px 12px",
    background: "#fef3c7",
    color: "#92400e",
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  title: {
    margin: 0,
    color: "#0f172a",
    fontSize: "2.2rem",
    lineHeight: 1,
    fontWeight: 950,
    letterSpacing: "-0.06em",
  },
  description: {
    margin: 0,
    color: "#64748b",
    fontSize: 15,
    lineHeight: 1.65,
    fontWeight: 560,
  },
  form: {
    marginTop: 24,
    display: "grid",
    gap: 16,
  },
  fieldGroup: {
    display: "grid",
    gap: 8,
  },
  label: {
    color: "#172033",
    fontSize: 13,
    fontWeight: 900,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 16,
    border: "1px solid rgba(100, 116, 139, 0.24)",
    background: "rgba(255, 255, 255, 0.92)",
    padding: "14px 15px",
    color: "#0f172a",
    fontSize: 15,
    outline: "none",
    fontWeight: 720,
    transition: "border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease",
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 16,
    border: "1px solid rgba(100, 116, 139, 0.24)",
    background: "rgba(255, 255, 255, 0.92)",
    padding: "14px 15px",
    color: "#0f172a",
    fontSize: 13,
    outline: "none",
    resize: "vertical",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease",
  },
  infoBox: {
    borderRadius: 16,
    padding: "12px 14px",
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid rgba(37, 99, 235, 0.18)",
    fontSize: 13,
    fontWeight: 750,
    lineHeight: 1.55,
  },
  successBox: {
    borderRadius: 16,
    border: "1px solid #bbf7d0",
    background: "#f0fdf4",
    color: "#166534",
    padding: "12px 14px",
    fontSize: 13,
    lineHeight: 1.5,
    fontWeight: 750,
  },
  errorBox: {
    borderRadius: 16,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#991b1b",
    padding: "12px 14px",
    fontSize: 13,
    lineHeight: 1.5,
    fontWeight: 750,
  },
  primaryButton: {
    width: "100%",
    border: 0,
    borderRadius: 18,
    padding: "15px 18px",
    background: "linear-gradient(135deg, #f8e7b1 0%, #c99738 46%, #8b5e16 100%)",
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 950,
    letterSpacing: "-0.01em",
    boxShadow: "0 18px 34px rgba(120, 79, 18, 0.24)",
    transition: "transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease",
  },
  footer: {
    marginTop: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    flexWrap: "wrap",
  },
  footerSeparator: {
    color: "#cbd5e1",
    fontWeight: 900,
  },
  secondaryLink: {
    color: "#b7791f",
    fontSize: 14,
    fontWeight: 900,
    textDecoration: "none",
  },
};
