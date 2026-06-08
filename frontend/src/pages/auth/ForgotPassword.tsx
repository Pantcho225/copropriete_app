// frontend/src/pages/auth/ForgotPassword.tsx

import { useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { requestPasswordReset } from "../../api/auth";

function extractApiError(error: unknown): string {
  const maybeError = error as {
    response?: {
      data?: {
        detail?: string;
        identifier?: string[];
        non_field_errors?: string[];
      };
      status?: number;
    };
    message?: string;
  };

  const data = maybeError.response?.data;

  if (data?.detail) return data.detail;
  if (data?.identifier?.length) return data.identifier[0];
  if (data?.non_field_errors?.length) return data.non_field_errors[0];

  if (maybeError.response?.status) {
    return `Une erreur est survenue (${maybeError.response.status}). Veuillez réessayer.`;
  }

  return maybeError.message || "Impossible de joindre le serveur.";
}

export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [debugToken, setDebugToken] = useState("");
  const [debugUrl, setDebugUrl] = useState("");

  const canSubmit = useMemo(() => {
    return identifier.trim().length >= 2 && !submitting;
  }, [identifier, submitting]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) return;

    setSubmitting(true);
    setSuccessMessage("");
    setErrorMessage("");
    setDebugToken("");
    setDebugUrl("");

    try {
      const response = await requestPasswordReset({
        identifier: identifier.trim(),
      });

      setSuccessMessage(response.detail);

      if (response.debug_reset_token) {
        setDebugToken(response.debug_reset_token);
      }

      if (response.debug_reset_url) {
        setDebugUrl(response.debug_reset_url);
      }

      if (response.debug_throttled && response.debug_message) {
        setErrorMessage(response.debug_message);
      }
    } catch (error) {
      setErrorMessage(extractApiError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.badge}>Récupération d’accès</div>

        <h1 style={styles.title}>Mot de passe oublié</h1>

        <p style={styles.description}>
          Renseignez votre email ou votre nom d’utilisateur. Si un compte actif
          correspond, un lien de récupération sera préparé.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.fieldGroup}>
            <label htmlFor="identifier" style={styles.label}>
              Email ou nom d’utilisateur
            </label>

            <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="Ex. : jules@test.com ou konan"
              autoComplete="username"
              style={styles.input}
            />
          </div>

          {successMessage ? (
            <div style={styles.successBox}>{successMessage}</div>
          ) : null}

          {errorMessage ? (
            <div style={styles.errorBox}>{errorMessage}</div>
          ) : null}

          {debugToken ? (
            <div style={styles.debugBox}>
              <div style={styles.debugTitle}>Mode développement</div>

              <p style={styles.debugText}>
                Le backend a généré un token de test. En production, ce token
                devra être envoyé par email ou par canal sécurisé.
              </p>

              <textarea
                readOnly
                value={debugToken}
                rows={4}
                style={styles.debugTextarea}
              />

              <Link
                to={`/reset-password?token=${encodeURIComponent(debugToken)}`}
                style={styles.debugLink}
              >
                Ouvrir la page de réinitialisation
              </Link>

              {debugUrl ? (
                <div style={styles.debugUrl}>URL locale : {debugUrl}</div>
              ) : null}
            </div>
          ) : null}

          <button type="submit" disabled={!canSubmit} style={styles.primaryButton}>
            {submitting ? "Préparation en cours..." : "Préparer le lien"}
          </button>
        </form>

        <div style={styles.footer}>
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
    maxWidth: 520,
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
  debugBox: {
    borderRadius: 18,
    border: "1px solid #fde68a",
    background: "#fffbeb",
    padding: 14,
    display: "grid",
    gap: 10,
  },
  debugTitle: {
    color: "#92400e",
    fontSize: 13,
    fontWeight: 950,
  },
  debugText: {
    margin: 0,
    color: "#92400e",
    fontSize: 13,
    lineHeight: 1.5,
  },
  debugTextarea: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 14,
    border: "1px solid #f59e0b",
    background: "#ffffff",
    padding: 12,
    color: "#0f172a",
    fontSize: 12,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    resize: "vertical",
  },
  debugLink: {
    display: "inline-flex",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 14,
    padding: "11px 13px",
    background: "#92400e",
    color: "#ffffff",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 900,
  },
  debugUrl: {
    color: "#92400e",
    fontSize: 12,
    fontWeight: 700,
    wordBreak: "break-all",
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
  },
  secondaryLink: {
    color: "#4f46e5",
    fontSize: 14,
    fontWeight: 850,
    textDecoration: "none",
  },
};