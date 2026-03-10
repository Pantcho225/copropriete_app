import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "./routes/ProtectedRoute";
import AdminLayout from "./layout/AdminLayout";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

// Finances
import ImportCSV from "./pages/compta/ImportCSV";
import RelevesImports from "./pages/compta/RelevesImports";
import ReleveLignes from "./pages/compta/ReleveLignes";
import ComptaMouvements from "./pages/compta/ComptaMouvements";
import ComptaStats from "./pages/compta/ComptaStats";

// Ressources humaines
import RHEmployes from "./pages/rh/RHEmployes";
import EmployeForm from "./pages/rh/EmployeForm";
import RHContrats from "./pages/rh/RHContrats";
import ContratForm from "./pages/rh/ContratForm";

// Travaux
import TravauxDossiers from "./pages/travaux/TravauxDossiers";
import TravauxDossierForm from "./pages/travaux/TravauxDossierForm";
import TravauxDossierDetail from "./pages/travaux/TravauxDossierDetail";
import TravauxFournisseurs from "./pages/travaux/TravauxFournisseurs";
import TravauxFournisseurForm from "./pages/travaux/TravauxFournisseurForm";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Authentification */}
        <Route path="/login" element={<Login />} />

        {/* Application protégée */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          {/* Tableau de bord */}
          <Route index element={<Dashboard />} />

          {/* Finances */}
          <Route path="compta">
            <Route index element={<Navigate to="imports" replace />} />
            <Route path="releves" element={<Navigate to="imports" replace />} />
            <Route path="import" element={<ImportCSV />} />
            <Route path="imports" element={<RelevesImports />} />
            <Route path="imports/:importId/lignes" element={<ReleveLignes />} />
            <Route path="mouvements" element={<ComptaMouvements />} />
            <Route path="stats" element={<ComptaStats />} />
          </Route>

          {/* Ressources humaines */}
          <Route path="rh">
            <Route index element={<Navigate to="employes" replace />} />

            <Route path="employes" element={<RHEmployes />} />
            <Route path="employes/nouveau" element={<EmployeForm />} />
            <Route path="employes/:id/modifier" element={<EmployeForm />} />

            <Route path="contrats" element={<RHContrats />} />
            <Route path="contrats/nouveau" element={<ContratForm />} />
            <Route path="contrats/:id/modifier" element={<ContratForm />} />
          </Route>

          {/* Travaux */}
          <Route path="travaux">
            <Route index element={<Navigate to="dossiers" replace />} />

            <Route path="dossiers" element={<TravauxDossiers />} />
            <Route path="dossiers/nouveau" element={<TravauxDossierForm />} />
            <Route path="dossiers/:id/modifier" element={<TravauxDossierForm />} />
            <Route path="dossiers/:id" element={<TravauxDossierDetail />} />

            <Route path="fournisseurs" element={<TravauxFournisseurs />} />
            <Route path="fournisseurs/nouveau" element={<TravauxFournisseurForm />} />
            <Route path="fournisseurs/:id/modifier" element={<TravauxFournisseurForm />} />
          </Route>
        </Route>

        {/* Fallback global */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}