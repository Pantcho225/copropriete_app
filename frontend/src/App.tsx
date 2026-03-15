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

// AG
import AGHome from "./pages/ag/AGHome";
import AGList from "./pages/ag/AGList";
import AGForm from "./pages/ag/AGForm";
import AGDetail from "./pages/ag/AGDetail";
import AGResolutions from "./pages/ag/AGResolutions";
import AGPV from "./pages/ag/AGPV";
import AGPresences from "./pages/ag/AGPresences";
import AGVotes from "./pages/ag/AGVotes";

// Billing
import BillingHome from "./pages/billing/BillingHome";

// Platform Admin
import PlatformAdminHome from "./pages/platform-admin/PlatformAdminHome";

// Lots
import LotsList from "./pages/lots/LotsList";
import LotForm from "./pages/lots/LotForm";

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

          {/* Finances / comptabilité */}
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

          {/* Lots */}
          <Route path="lots">
            <Route index element={<LotsList />} />
            <Route path="nouveau" element={<LotForm />} />
            <Route path=":id/modifier" element={<LotForm />} />
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

          {/* Assemblées générales */}
          <Route path="ag">
            <Route index element={<AGHome />} />
            <Route path="/ag/assemblees/:id/resolutions" element={<AGResolutions />} />

            <Route path="assemblees" element={<AGList />} />
            <Route path="assemblees/nouveau" element={<AGForm />} />
            <Route path="assemblees/:id/modifier" element={<AGForm />} />
            <Route path="assemblees/:id" element={<AGDetail />} />
            <Route path="assemblees/:id/presences" element={<AGPresences />} />
            <Route path="assemblees/:id/votes" element={<AGVotes />} />
            <Route path="assemblees/:id/pv" element={<AGPV />} />

            <Route path="resolutions" element={<AGResolutions />} />

            {/* Compatibilité / ancienne route */}
            <Route path="pv" element={<Navigate to="/ag/assemblees" replace />} />
          </Route>

          {/* Facturation */}
          <Route path="billing">
            <Route index element={<BillingHome />} />
          </Route>

          {/* Administration plateforme */}
          <Route path="platform-admin">
            <Route index element={<PlatformAdminHome />} />
          </Route>
        </Route>

        {/* Fallback global */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}