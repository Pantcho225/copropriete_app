import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuthStore } from "../store/authStore";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const access = useAuthStore((s) => s.access);
  if (!access) return <Navigate to="/login" replace />;
  return <>{children}</>;
}