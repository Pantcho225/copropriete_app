import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./routes/ProtectedRoute";
import AdminLayout from "./layout/AdminLayout";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

// Sprint 2 (Compta)
import ImportCSV from "./pages/compta/ImportCSV";
import RelevesImports from "./pages/compta/RelevesImports";
import ReleveLignes from "./pages/compta/ReleveLignes"; // ✅ FIX: bon fichier existant
import ComptaStats from "./pages/compta/ComptaStats";

// Page Mouvements
import ComptaMouvements from "./pages/compta/ComptaMouvements";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />

          <Route path="compta">
            <Route path="releves" element={<Navigate to="imports" replace />} />

            <Route path="import" element={<ImportCSV />} />
            <Route path="imports" element={<RelevesImports />} />

            {/* ✅ ROUTE OK */}
            <Route path="imports/:importId/lignes" element={<ReleveLignes />} />

            <Route path="mouvements" element={<ComptaMouvements />} />
            <Route path="stats" element={<ComptaStats />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}