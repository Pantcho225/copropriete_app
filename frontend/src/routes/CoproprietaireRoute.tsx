import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Navigate, Outlet } from "react-router-dom";

import { getAuthMe, type AuthMeResponse } from "../api/auth";
import { useAuthStore } from "../store/authStore";

type RouteState = {
  loading: boolean;
  me: AuthMeResponse | null;
  error: string | null;
};

export default function CoproprietaireRoute() {
  const access = useAuthStore((state) => state.access);

  const [state, setState] = useState<RouteState>({
    loading: true,
    me: null,
    error: null,
  });

  useEffect(() => {
    let mounted = true;

    async function loadMe() {
      if (!access) {
        setState({
          loading: false,
          me: null,
          error: "Utilisateur non connecté.",
        });
        return;
      }

      try {
        const me = await getAuthMe();

        if (!mounted) return;

        setState({
          loading: false,
          me,
          error: null,
        });
      } catch (error) {
        console.error("Erreur chargement /api/auth/me/", error);

        if (!mounted) return;

        setState({
          loading: false,
          me: null,
          error: "Impossible de vérifier votre profil.",
        });
      }
    }

    loadMe();

    return () => {
      mounted = false;
    };
  }, [access]);

  const isCoproprietaire = useMemo(() => {
    if (!state.me) return false;

    return (
      state.me.is_coproprietaire === true ||
      state.me.roles.includes("COPROPRIETAIRE") ||
      state.me.memberships.some((membership) => membership.role === "COPROPRIETAIRE")
    );
  }, [state.me]);

  if (!access) {
    return <Navigate to="/login" replace />;
  }

  if (state.loading) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.spinner} />
          <p style={styles.title}>Vérification de votre espace...</p>
          <p style={styles.text}>
            Nous contrôlons vos droits d’accès avant d’ouvrir l’espace copropriétaire.
          </p>
        </div>
      </div>
    );
  }

  if (state.error || !state.me) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <p style={styles.title}>Accès impossible</p>
          <p style={styles.text}>{state.error ?? "Profil introuvable."}</p>
        </div>
      </div>
    );
  }

  if (state.me.must_change_password) {
    return <Navigate to="/change-password" replace />;
  }

  if (!isCoproprietaire) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <p style={styles.title}>Espace réservé aux copropriétaires</p>
          <p style={styles.text}>
            Votre compte ne possède pas le rôle COPROPRIETAIRE. Connectez-vous avec un compte
            copropriétaire valide.
          </p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "radial-gradient(circle at top left, rgba(59,130,246,0.18), transparent 32%), linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 460,
    borderRadius: 28,
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(226,232,240,0.9)",
    boxShadow: "0 24px 70px rgba(15,23,42,0.14)",
    padding: 28,
    textAlign: "center",
  },
  spinner: {
    width: 34,
    height: 34,
    borderRadius: "999px",
    border: "4px solid #e0e7ff",
    borderTopColor: "#2563eb",
    margin: "0 auto 18px",
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
    color: "#0f172a",
  },
  text: {
    margin: "10px 0 0",
    fontSize: 14,
    lineHeight: 1.6,
    color: "#64748b",
  },
};