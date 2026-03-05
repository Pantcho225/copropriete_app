import { Navigate, Outlet } from "react-router-dom";
import { authStore } from "./auth.store";

export default function RequireAuth() {
  const tokens = authStore.getTokens();
  const coproId = authStore.getCoproId();
  if (!tokens?.access || !tokens?.refresh || !coproId) return <Navigate to="/login" replace />;
  return <Outlet />;
}