// frontend/src/pages/auth/ResetPassword.tsx

import { useMemo, useState, type CSSProperties, type FormEvent } from "react";
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

  const [token, setToken] = useState(tokenFromUrl);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

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
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.badge}>Sécurisation du compte</div>

        <h1 style={styles.title}>Nouveau mot de passe</h1>

        <p style={styles.description}>
          Définissez un nouveau mot de passe pour récupérer l’accès à votre
          espace. Après validation, vous pourrez vous reconnecter normalement.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
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
            />
          </div>

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
            />
          </div>

          {successMessage ? (
            <div style={styles.successBox}>{successMessage}</div>
          ) : null}

          {errorMessage ? (
            <div style={styles.errorBox}>{errorMessage}</div>
          ) : null}

          <button type="submit" disabled={!canSubmit} style={styles.primaryButton}>
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
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    background:
      "radial-gradient(circle at top left, rgba(79, 70, 229, 0.16), transparent 34%), linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)",
  },
  card: {
    width: "100%",
    maxWidth: 540,
    borderRadius: 28,
    background: "rgba(255, 255, 255, 0.95)",
    border: "1px solid rgba(226, 232, 240, 0.95)",
    boxShadow: "0 24px 70px rgba(15, 23, 42, 0.14)",
    padding: 30,
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "7px 12px",
    background: "#eef2ff",
    color: "#3730a3",
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 16,
  },
  title: {
    margin: 0,
    color: "#0f172a",
    fontSize: 30,
    lineHeight: 1.1,
    fontWeight: 950,
    letterSpacing: -0.8,
  },
  description: {
    margin: "12px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.65,
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
    color: "#334155",
    fontSize: 13,
    fontWeight: 850,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    padding: "13px 14px",
    color: "#0f172a",
    fontSize: 14,
    outline: "none",
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    padding: "13px 14px",
    color: "#0f172a",
    fontSize: 13,
    outline: "none",
    resize: "vertical",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
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
    border: "none",
    borderRadius: 16,
    background: "#4f46e5",
    color: "#ffffff",
    padding: "14px 16px",
    fontSize: 14,
    fontWeight: 950,
    cursor: "pointer",
    opacity: 1,
  },
  footer: {
    marginTop: 22,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  footerSeparator: {
    color: "#94a3b8",
    fontWeight: 900,
  },
  secondaryLink: {
    color: "#4f46e5",
    fontSize: 14,
    fontWeight: 850,
    textDecoration: "none",
  },
};