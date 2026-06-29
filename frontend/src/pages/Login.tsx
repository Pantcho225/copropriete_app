// src/pages/Login.tsx
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import api from "../api/axios";
import { ENDPOINTS } from "../api/endpoints";
import { useAuthStore } from "../store/authStore";

type LoginResponse = {
  access: string;
  refresh: string;
  active_copropriete?: {
    id: number;
    nom: string;
  };
};

type ApiError = {
  response?: {
    status?: number;
    data?: {
      detail?: string;
      message?: string;
    };
  };
  message?: string;
};

const features = [
  "Appels, paiements et relances",
  "Documents administratifs partagés",
  "AG, votes, convocations et PV",
  "Réunions, travaux et suivi syndic",
];

const metrics = [
  { label: "Modules métier", value: "8+" },
  { label: "Pilotage", value: "Centralisé" },
  { label: "Accès", value: "Sécurisé" },
];

function errorMessage(err: unknown): string {
  const error = err as ApiError;

  const status = error?.response?.status;
  const detail = error?.response?.data?.detail || error?.response?.data?.message;

  if (status === 401) return detail || "Identifiants invalides.";

  if (status === 400) {
    return detail || "Requête invalide. Vérifiez les informations saisies.";
  }

  if (status === 404) {
    return "Le service de connexion est introuvable. Vérifiez la configuration de l’API.";
  }

  if (status) return detail || `Une erreur serveur est survenue (${status}).`;

  return (
    error?.message ||
    "Impossible de joindre le backend. Vérifiez le serveur, le réseau ou la configuration CORS."
  );
}

export default function Login() {
  const navigate = useNavigate();

  const setAuth = useAuthStore((s) => s.setAuth);
  const setCopropriete = useAuthStore((s) => s.setCopropriete);

  useEffect(() => {
    document.documentElement.classList.add("loginPremiumHtml");
    document.body.classList.add("loginPremiumBody");

    return () => {
      document.documentElement.classList.remove("loginPremiumHtml");
      document.body.classList.remove("loginPremiumBody");
    };
  }, []);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [coproId, setCoproId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState(
    "Renseignez votre identifiant de copropriété pour ouvrir le bon espace de gestion.",
  );

  const isFormValid = useMemo(() => {
    return (
      username.trim().length > 0 &&
      password.trim().length > 0 &&
      coproId.trim().length > 0
    );
  }, [username, password, coproId]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (loading) return;

    const cid = coproId.trim();
    const user = username.trim();
    const pass = password.trim();

    setError("");
    setInfo("Vérification sécurisée des accès en cours...");

    if (!cid) {
      setInfo("");
      setError("L’identifiant de copropriété est obligatoire.");
      return;
    }

    if (!user || !pass) {
      setInfo("");
      setError("Le nom d’utilisateur et le mot de passe sont obligatoires.");
      return;
    }

    setLoading(true);

    try {
      const res = await api.post<LoginResponse>(
        ENDPOINTS.login,
        { username: user, password: pass },
        {
          headers: {
            "X-Copropriete-Id": cid,
          },
        },
      );

      setCopropriete(res.data.active_copropriete?.id ?? cid);

      setAuth({
        access: res.data.access,
        refresh: res.data.refresh,
      });

      setInfo("Connexion réussie. Redirection en cours...");
      navigate("/", { replace: true });
    } catch (err: unknown) {
      setCopropriete(null);
      setInfo("");
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={page} className="loginPremiumPage">
      <div style={goldGlow} />
      <div style={blueGlow} />
      <div style={gridOverlay} />

      <section style={shell} className="loginPremiumShell">
        <aside style={heroPanel} className="loginPremiumHero">
          <div style={brandRow}>
            <div style={brandMark}>CP</div>

            <div>
              <div style={brandName}>Copropriété SaaS</div>
              <div style={brandSubline}>Gestion immobilière professionnelle</div>
            </div>
          </div>

          <div style={heroCopy}>
            <div style={heroBadge}>Plateforme syndic premium</div>

            <h1 style={heroTitle} className="loginPremiumHeroTitle">
              Une copropriété mieux pilotée, plus claire et plus transparente.
            </h1>

            <p style={heroText}>
              Centralisez la comptabilité, les appels de fonds, les paiements,
              les documents, les assemblées générales, les réunions et les travaux
              dans une interface moderne pensée pour les syndics et les copropriétaires.
            </p>
          </div>

          <div style={featureGrid} className="loginPremiumFeatureGrid">
            {features.map((feature) => (
              <div key={feature} style={featureItem}>
                <span style={featureIcon}>✓</span>
                <span>{feature}</span>
              </div>
            ))}
          </div>

          <div style={metricGrid} className="loginPremiumMetrics">
            {metrics.map((metric) => (
              <div key={metric.label} style={metricCard}>
                <div style={metricLabel}>{metric.label}</div>
                <div style={metricValue}>{metric.value}</div>
              </div>
            ))}
          </div>

          <div style={heroFooter}>
            <span style={heroFooterDot} />
            Données structurées, accès contrôlés et parcours métier prêts pour une gestion syndic professionnelle.
          </div>
        </aside>

        <section style={formPanel}>
          <div style={loginCard} className="loginPremiumCard">
            <div style={cardHeader}>
              <div style={eyebrow}>Accès sécurisé</div>

              <h2 style={title} className="loginPremiumTitle">
                Connexion
              </h2>

              <p style={subtitle}>
                Accédez à votre espace de gestion avec vos identifiants et
                l’identifiant de la copropriété active.
              </p>
            </div>

            {error ? <div style={errorBox}>{error}</div> : null}
            {!error && info ? <div style={infoBox}>{info}</div> : null}

            <form onSubmit={onSubmit} style={form}>
              <div style={fieldGroup}>
                <label htmlFor="username" style={label}>
                  Nom d’utilisateur
                </label>

                <input
                  id="username"
                  className="loginPremiumInput"
                  style={input}
                  placeholder="Votre nom d’utilisateur"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  disabled={loading}
                />
              </div>

              <div style={fieldGroup}>
                <div style={labelRow}>
                  <label htmlFor="password" style={label}>
                    Mot de passe
                  </label>

                  <Link to="/forgot-password" style={forgotPasswordLink}>
                    Mot de passe oublié ?
                  </Link>
                </div>

                <input
                  id="password"
                  className="loginPremiumInput"
                  type="password"
                  style={input}
                  placeholder="Saisissez votre mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={loading}
                />
              </div>

              <div style={tenantBox}>
                <label htmlFor="coproprieteId" style={label}>
                  Identifiant de copropriété
                </label>

                <input
                  id="coproprieteId"
                  className="loginPremiumInput"
                  style={input}
                  placeholder="Exemple : 11"
                  value={coproId}
                  onChange={(e) => setCoproId(e.target.value)}
                  inputMode="numeric"
                  disabled={loading}
                />

                <div style={helperText}>
                  Cet identifiant permet d’isoler les données de la copropriété
                  sélectionnée et de charger le bon contexte métier.
                </div>
              </div>

              <button
                type="submit"
                className="loginPremiumButton"
                disabled={loading || !isFormValid}
                style={{
                  ...submitButton,
                  opacity: loading || !isFormValid ? 0.62 : 1,
                  cursor: loading || !isFormValid ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Connexion en cours..." : "Se connecter à la plateforme"}
              </button>
            </form>

            <div style={secureNote}>
              <span style={lockIcon}>●</span>
              Accès réservé aux utilisateurs autorisés : syndic, administrateur,
              conseil syndical ou copropriétaire.
            </div>
          </div>
        </section>
      </section>

      <style>{`
        html.loginPremiumHtml,
        body.loginPremiumBody {
          width: 100%;
          min-width: 320px;
          overflow: hidden !important;
        }

        body.loginPremiumBody {
          display: block !important;
          place-items: initial !important;
          min-height: 100vh !important;
        }

        body.loginPremiumBody #root {
          width: 100% !important;
          max-width: none !important;
          min-height: 100vh !important;
          margin: 0 !important;
          padding: 0 !important;
          text-align: left !important;
        }

        .loginPremiumInput::placeholder {
          color: rgba(100, 116, 139, 0.74);
        }

        .loginPremiumInput:focus {
          border-color: rgba(184, 134, 45, 0.72) !important;
          box-shadow: 0 0 0 4px rgba(184, 134, 45, 0.14) !important;
          background: #ffffff !important;
        }

        .loginPremiumButton:not(:disabled):hover {
          transform: translateY(-1px);
          box-shadow: 0 22px 42px rgba(120, 79, 18, 0.32) !important;
        }

        .loginPremiumButton:not(:disabled):active {
          transform: translateY(0);
        }

        @media (max-width: 1080px) {
          .loginPremiumPage {
            overflow-y: auto !important;
            align-items: flex-start !important;
          }

          .loginPremiumShell {
            grid-template-columns: 1fr !important;
            max-width: 780px !important;
            gap: 18px !important;
          }

          .loginPremiumHero {
            min-height: auto !important;
          }
        }

        @media (max-width: 720px) {
          .loginPremiumPage {
            padding: 16px !important;
            align-items: flex-start !important;
          }

          .loginPremiumHero,
          .loginPremiumCard {
            border-radius: 24px !important;
            padding: 22px !important;
          }

          .loginPremiumHeroTitle {
            font-size: 2.05rem !important;
          }

          .loginPremiumTitle {
            font-size: 1.85rem !important;
          }

          .loginPremiumMetrics,
          .loginPremiumFeatureGrid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}

const page: CSSProperties = {
  position: "fixed",
  inset: 0,
  minHeight: "100vh",
  overflowY: "hidden",
  overflowX: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 28,
  boxSizing: "border-box",
  background:
    "radial-gradient(circle at 12% 12%, rgba(218, 165, 32, 0.18), transparent 30%), radial-gradient(circle at 85% 18%, rgba(59, 130, 246, 0.18), transparent 34%), linear-gradient(135deg, #07111f 0%, #0f172a 44%, #111827 100%)",
  color: "#0f172a",
};

const goldGlow: CSSProperties = {
  position: "absolute",
  top: -160,
  left: -120,
  width: 420,
  height: 420,
  borderRadius: "50%",
  background: "rgba(218, 165, 32, 0.22)",
  filter: "blur(55px)",
  pointerEvents: "none",
};

const blueGlow: CSSProperties = {
  position: "absolute",
  right: -120,
  bottom: -160,
  width: 460,
  height: 460,
  borderRadius: "50%",
  background: "rgba(37, 99, 235, 0.18)",
  filter: "blur(60px)",
  pointerEvents: "none",
};

const gridOverlay: CSSProperties = {
  position: "absolute",
  inset: 0,
  opacity: 0.16,
  backgroundImage:
    "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
  backgroundSize: "42px 42px",
  pointerEvents: "none",
};

const shell: CSSProperties = {
  width: "100%",
  maxWidth: 1220,
  display: "grid",
  gridTemplateColumns: "1.05fr 0.95fr",
  gap: 24,
  alignItems: "stretch",
  position: "relative",
  zIndex: 1,
};

const heroPanel: CSSProperties = {
  minHeight: 640,
  borderRadius: 34,
  padding: 34,
  display: "grid",
  alignContent: "space-between",
  gap: 28,
  overflow: "hidden",
  position: "relative",
  border: "1px solid rgba(255, 255, 255, 0.14)",
  background:
    "linear-gradient(145deg, rgba(15, 23, 42, 0.96) 0%, rgba(17, 24, 39, 0.9) 48%, rgba(120, 79, 18, 0.42) 100%)",
  boxShadow: "0 34px 90px rgba(0, 0, 0, 0.38)",
};

const brandRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
};

const brandMark: CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: 18,
  display: "grid",
  placeItems: "center",
  color: "#0f172a",
  fontWeight: 950,
  letterSpacing: "-0.05em",
  background: "linear-gradient(135deg, #f8e7b1 0%, #c99738 100%)",
  boxShadow: "0 14px 30px rgba(201, 151, 56, 0.28)",
};

const brandName: CSSProperties = {
  color: "#ffffff",
  fontSize: 17,
  fontWeight: 950,
  letterSpacing: "-0.03em",
};

const brandSubline: CSSProperties = {
  color: "rgba(226, 232, 240, 0.72)",
  fontSize: 13,
  fontWeight: 700,
};

const heroCopy: CSSProperties = {
  display: "grid",
  gap: 16,
  maxWidth: 760,
};

const heroBadge: CSSProperties = {
  width: "fit-content",
  borderRadius: 999,
  padding: "7px 12px",
  border: "1px solid rgba(248, 231, 177, 0.28)",
  background: "rgba(248, 231, 177, 0.1)",
  color: "#f8e7b1",
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const heroTitle: CSSProperties = {
  margin: 0,
  color: "#ffffff",
  fontSize: "clamp(2.45rem, 4.8vw, 4.8rem)",
  lineHeight: 0.95,
  letterSpacing: "-0.075em",
  fontWeight: 950,
};

const heroText: CSSProperties = {
  margin: 0,
  maxWidth: 680,
  color: "rgba(226, 232, 240, 0.82)",
  fontSize: "1.02rem",
  lineHeight: 1.75,
  fontWeight: 560,
};

const featureGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
};

const featureItem: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
  borderRadius: 18,
  padding: "13px 14px",
  border: "1px solid rgba(255, 255, 255, 0.13)",
  background: "rgba(255, 255, 255, 0.075)",
  color: "rgba(248, 250, 252, 0.92)",
  fontSize: 14,
  fontWeight: 780,
};

const featureIcon: CSSProperties = {
  display: "grid",
  placeItems: "center",
  flex: "0 0 auto",
  width: 24,
  height: 24,
  borderRadius: 999,
  background: "rgba(248, 231, 177, 0.14)",
  color: "#f8e7b1",
  fontWeight: 950,
};

const metricGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 12,
};

const metricCard: CSSProperties = {
  borderRadius: 20,
  padding: 16,
  border: "1px solid rgba(255, 255, 255, 0.14)",
  background: "rgba(255, 255, 255, 0.09)",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.08)",
};

const metricLabel: CSSProperties = {
  color: "rgba(226, 232, 240, 0.68)",
  fontSize: 11,
  fontWeight: 920,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

const metricValue: CSSProperties = {
  marginTop: 8,
  color: "#ffffff",
  fontSize: 22,
  lineHeight: 1,
  fontWeight: 950,
  letterSpacing: "-0.04em",
};

const heroFooter: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  color: "rgba(226, 232, 240, 0.72)",
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 680,
};

const heroFooterDot: CSSProperties = {
  flex: "0 0 auto",
  width: 10,
  height: 10,
  marginTop: 5,
  borderRadius: 999,
  background: "#f8e7b1",
  boxShadow: "0 0 0 6px rgba(248, 231, 177, 0.1)",
};

const formPanel: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 0,
};

const loginCard: CSSProperties = {
  width: "100%",
  maxWidth: 520,
  borderRadius: 34,
  padding: 34,
  border: "1px solid rgba(255, 255, 255, 0.72)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.94) 100%)",
  boxShadow: "0 34px 90px rgba(0, 0, 0, 0.28)",
  boxSizing: "border-box",
};

const cardHeader: CSSProperties = {
  display: "grid",
  gap: 10,
  marginBottom: 18,
};

const eyebrow: CSSProperties = {
  width: "fit-content",
  borderRadius: 999,
  padding: "7px 12px",
  background: "#fef3c7",
  color: "#92400e",
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const title: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: "2.25rem",
  lineHeight: 1,
  fontWeight: 950,
  letterSpacing: "-0.06em",
};

const subtitle: CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 15,
  lineHeight: 1.6,
  fontWeight: 560,
};

const infoBox: CSSProperties = {
  borderRadius: 16,
  padding: "12px 14px",
  background: "#eff6ff",
  color: "#1d4ed8",
  border: "1px solid rgba(37, 99, 235, 0.18)",
  fontSize: 13,
  fontWeight: 750,
  lineHeight: 1.55,
  marginBottom: 16,
};

const errorBox: CSSProperties = {
  borderRadius: 16,
  padding: "12px 14px",
  background: "#fef2f2",
  color: "#b91c1c",
  border: "1px solid rgba(220, 38, 38, 0.18)",
  fontSize: 13,
  fontWeight: 800,
  lineHeight: 1.55,
  marginBottom: 16,
};

const form: CSSProperties = {
  display: "grid",
  gap: 15,
};

const fieldGroup: CSSProperties = {
  display: "grid",
  gap: 8,
};

const labelRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const label: CSSProperties = {
  color: "#172033",
  fontSize: 13,
  fontWeight: 900,
};

const input: CSSProperties = {
  width: "100%",
  border: "1px solid rgba(100, 116, 139, 0.24)",
  background: "rgba(255, 255, 255, 0.92)",
  color: "#0f172a",
  borderRadius: 16,
  padding: "14px 15px",
  outline: "none",
  boxSizing: "border-box",
  fontSize: 15,
  fontWeight: 720,
  transition: "border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease",
};

const forgotPasswordLink: CSSProperties = {
  color: "#b7791f",
  fontSize: 13,
  fontWeight: 900,
  textDecoration: "none",
};

const tenantBox: CSSProperties = {
  display: "grid",
  gap: 8,
  borderRadius: 20,
  padding: 15,
  background: "#f8fafc",
  border: "1px solid rgba(15, 23, 42, 0.08)",
};

const helperText: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  lineHeight: 1.5,
  fontWeight: 620,
};

const submitButton: CSSProperties = {
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
};

const secureNote: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 9,
  marginTop: 18,
  color: "#64748b",
  fontSize: 12,
  lineHeight: 1.55,
  fontWeight: 650,
};

const lockIcon: CSSProperties = {
  color: "#16a34a",
  fontSize: 10,
  marginTop: 4,
};
