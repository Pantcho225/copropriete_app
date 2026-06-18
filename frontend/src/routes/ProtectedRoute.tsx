import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Navigate, Outlet } from "react-router-dom";

import { getAuthMe, type AuthMeResponse } from "../api/auth";
import { useAuthStore } from "../store/authStore";

type ProtectedRouteProps = {
  children?: ReactNode;
};

type RouteState = {
  loading: boolean;
  me: AuthMeResponse | null;
  error: string | null;
};

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
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
        console.error("Erreur ProtectedRoute /api/auth/me/", error);

        if (!mounted) return;

        setState({
          loading: false,
          me: null,
          error: "Session invalide ou profil introuvable.",
        });
      }
    }

    loadMe();

    return () => {
      mounted = false;
    };
  }, [access]);

  const hasAdminAccess = useMemo(() => {
    if (!state.me) return false;

    const adminRoles = new Set([
      "ADMIN",
      "SYNDIC",
      "GESTIONNAIRE",
      "COMPTABLE",
      "CONSEIL",
    ]);

    const hasActiveAdminMembership = state.me.memberships.some(
      (membership) =>
        membership.is_active === true && adminRoles.has(membership.role),
    );

    return (
      state.me.is_admin === true ||
      state.me.is_superuser === true ||
      state.me.user.is_staff === true ||
      hasActiveAdminMembership
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
          <p style={styles.title}>Vérification de votre session...</p>
          <p style={styles.text}>
            Nous contrôlons vos droits d’accès avant d’ouvrir l’espace administrateur.
          </p>
        </div>
      </div>
    );
  }

  if (state.error || !state.me) {
    return <Navigate to="/login" replace />;
  }

  if (state.me.must_change_password) {
    return <Navigate to="/change-password" replace />;
  }

  if (!hasAdminAccess) {
    return <Navigate to="/coproprietaire" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
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