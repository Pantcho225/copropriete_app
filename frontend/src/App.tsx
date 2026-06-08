// frontend/src/App.tsx
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "./routes/ProtectedRoute";
import AdminLayout from "./layout/AdminLayout";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
// Gestion administrative
import GestionAdministrativeHome from "./pages/administration/GestionAdministrativeHome";
import CoproprieteAdministrativeOverview from "./pages/administration/CoproprieteAdministrativeOverview";
import ReunionsRencontres from "./pages/administration/ReunionsRencontres";
import ReglementTextesApplicables from "./pages/administration/ReglementTextesApplicables";
import DocumentsAdministratifs from "./pages/administration/DocumentsAdministratifs";

// Comptabilité
import ComptaHome from "./pages/compta/ComptaHome";
import ImportCSV from "./pages/compta/ImportCSV";
import RelevesImports from "./pages/compta/RelevesImports";
import ReleveLignes from "./pages/compta/ReleveLignes";
import ComptaMouvements from "./pages/compta/ComptaMouvements";
import ComptaStats from "./pages/compta/ComptaStats";

// Ressources humaines
import RHHome from "./pages/rh/RHHome";
import RHEmployes from "./pages/rh/RHEmployes";
import EmployeForm from "./pages/rh/EmployeForm";
import RHContrats from "./pages/rh/RHContrats";
import ContratForm from "./pages/rh/ContratForm";

// Lots
import LotsList from "./pages/lots/LotsList";
import LotForm from "./pages/lots/LotForm";

// Travaux
import TravauxDossiers from "./pages/travaux/TravauxDossiers";
import TravauxDossierForm from "./pages/travaux/TravauxDossierForm";
import TravauxDossierDetail from "./pages/travaux/TravauxDossierDetail";
import TravauxFournisseurs from "./pages/travaux/TravauxFournisseurs";
import TravauxFournisseurForm from "./pages/travaux/TravauxFournisseurForm";

// Assemblées générales
import AGHome from "./pages/ag/AGHome";
import AGList from "./pages/ag/AGList";
import AGForm from "./pages/ag/AGForm";
import AGDetail from "./pages/ag/AGDetail";
import AGResolutions from "./pages/ag/AGResolutions";
import AGPV from "./pages/ag/AGPV";
import AGPresences from "./pages/ag/AGPresences";
import AGVotes from "./pages/ag/AGVotes";
import AGProcurations from "./pages/ag/AGProcurations";

// Relances
import RelancesDashboard from "./pages/relances/RelancesDashboard";
import DossiersImpayesList from "./pages/relances/DossiersImpayesList";
import DossierImpayeDetail from "./pages/relances/DossierImpayeDetail";
import RelancesHistorique from "./pages/relances/RelancesHistorique";
import AvisRegularisationList from "./pages/relances/AvisRegularisationList";

// Facturation
import BillingHome from "./pages/billing/BillingHome";
import BillingFactures from "./pages/billing/BillingFactures";
import BillingAbonnement from "./pages/billing/BillingAbonnement";

// Plateforme / Super Admin
import PlatformAdminHome from "./pages/platform-admin/PlatformAdminHome";
import ReferentielCopropriete from "./pages/platform-admin/ReferentielCopropriete";
import PlatformCoproprietesList from "./pages/platform-admin/PlatformCoproprietesList";
import PlatformCoproprieteForm from "./pages/platform-admin/PlatformCoproprieteForm";
import PlatformCoproprieteDetail from "./pages/platform-admin/PlatformCoproprieteDetail";
import PlatformCoproprietaires from "./pages/platform-admin/PlatformCoproprietaires";
import PlatformLots from "./pages/platform-admin/PlatformLots";
import PlatformOccupants from "./pages/platform-admin/PlatformOccupants";
import PlatformTantiemes from "./pages/platform-admin/PlatformTantiemes";
import PlatformUsersRoles from "./pages/platform-admin/PlatformUsersRoles";

// Espace copropriétaire
import CoproprietaireLayout from "./layout/CoproprietaireLayout";
import CoproprietaireDashboard from "./pages/coproprietaire/CoproprietaireDashboard";
import CoproprietaireMesLots from "./pages/coproprietaire/CoproprietaireMesLots";
import CoproprietaireAppels from "./pages/coproprietaire/CoproprietaireAppels";
import CoproprietairePaiements from "./pages/coproprietaire/CoproprietairePaiements";
import CoproprietaireRelances from "./pages/coproprietaire/CoproprietaireRelances";
import CoproprietaireDocuments from "./pages/coproprietaire/CoproprietaireDocuments";
import CoproprietaireAssemblees from "./pages/coproprietaire/CoproprietaireAssemblees";
import CoproprietaireRoute from "./routes/CoproprietaireRoute";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Authentification */}
        <Route path="/login" element={<Login />} />

        {/* Espace copropriétaire séparé */}
        <Route element={<CoproprietaireRoute />}>
          <Route path="/coproprietaire" element={<CoproprietaireLayout />}>
            <Route index element={<CoproprietaireDashboard />} />
            <Route
              path="tableau-de-bord"
              element={<CoproprietaireDashboard />}
            />
            <Route path="mes-lots" element={<CoproprietaireMesLots />} />
            <Route path="appels" element={<CoproprietaireAppels />} />
            <Route path="paiements" element={<CoproprietairePaiements />} />
            <Route path="relances" element={<CoproprietaireRelances />} />
            <Route path="documents" element={<CoproprietaireDocuments />} />

            {/* Assemblées générales copropriétaire */}
            <Route path="ag" element={<CoproprietaireAssemblees />} />
          </Route>
        </Route>

        {/* Application admin protégée */}
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

          {/* Gestion administrative */}
          <Route path="gestion-administrative">
            <Route index element={<GestionAdministrativeHome />} />
            <Route
              path="copropriete"
              element={<CoproprieteAdministrativeOverview />}
            />
            <Route
              path="reunions-rencontres"
              element={<ReunionsRencontres />}
            />
            <Route
              path="reglement-textes"
              element={<ReglementTextesApplicables />}
            />
            <Route path="documents" element={<DocumentsAdministratifs />} />
          </Route>

          {/* Comptabilité */}
          <Route path="compta">
            <Route index element={<ComptaHome />} />
            <Route
              path="releves"
              element={<Navigate to="/compta/imports" replace />}
            />
            <Route path="import" element={<ImportCSV />} />
            <Route path="imports" element={<RelevesImports />} />
            <Route path="imports/:importId/lignes" element={<ReleveLignes />} />
            <Route path="mouvements" element={<ComptaMouvements />} />
            <Route path="stats" element={<ComptaStats />} />
          </Route>

          {/* Ressources humaines */}
          <Route path="rh">
            <Route index element={<RHHome />} />
            <Route path="employes" element={<RHEmployes />} />
            <Route path="employes/nouveau" element={<EmployeForm />} />
            <Route path="employes/:id/modifier" element={<EmployeForm />} />
            <Route path="contrats" element={<RHContrats />} />
            <Route path="contrats/nouveau" element={<ContratForm />} />
            <Route path="contrats/:id/modifier" element={<ContratForm />} />
          </Route>

          {/* Lots opérationnels */}
          <Route path="lots">
            <Route index element={<LotsList />} />
            <Route path="nouveau" element={<LotForm />} />
            <Route path=":id/modifier" element={<LotForm />} />
          </Route>

          {/* Travaux */}
          <Route path="travaux">
            <Route index element={<Navigate to="/travaux/dossiers" replace />} />
            <Route path="dossiers" element={<TravauxDossiers />} />
            <Route path="dossiers/nouveau" element={<TravauxDossierForm />} />
            <Route
              path="dossiers/:id/modifier"
              element={<TravauxDossierForm />}
            />
            <Route path="dossiers/:id" element={<TravauxDossierDetail />} />
            <Route path="fournisseurs" element={<TravauxFournisseurs />} />
            <Route
              path="fournisseurs/nouveau"
              element={<TravauxFournisseurForm />}
            />
            <Route
              path="fournisseurs/:id/modifier"
              element={<TravauxFournisseurForm />}
            />
          </Route>

          {/* Assemblées générales admin */}
          <Route path="ag">
            <Route index element={<AGHome />} />

            {/* Assemblées */}
            <Route path="assemblees" element={<AGList />} />
            <Route path="assemblees/nouveau" element={<AGForm />} />
            <Route path="assemblees/:id/modifier" element={<AGForm />} />
            <Route path="assemblees/:id" element={<AGDetail />} />

            {/* Cycle opérationnel AG */}
            <Route path="assemblees/:id/presences" element={<AGPresences />} />
            <Route path="assemblees/:id/votes" element={<AGVotes />} />
            <Route path="assemblees/:id/pv" element={<AGPV />} />

            {/* Mandats de représentation */}
            <Route path="procurations" element={<AGProcurations />} />

            {/* Résolutions */}
            <Route
              path="assemblees/:id/resolutions"
              element={<AGResolutions />}
            />
            <Route path="resolutions" element={<AGResolutions />} />

            {/* Compatibilité ancienne route */}
            <Route path="pv" element={<Navigate to="/ag/assemblees" replace />} />
          </Route>

          {/* Relances */}
          <Route path="relances">
            <Route index element={<RelancesDashboard />} />
            <Route path="dossiers" element={<DossiersImpayesList />} />
            <Route path="dossiers/:id" element={<DossierImpayeDetail />} />
            <Route path="historique" element={<RelancesHistorique />} />
            <Route path="avis" element={<AvisRegularisationList />} />
          </Route>

          {/* Facturation */}
          <Route path="billing">
            <Route index element={<BillingHome />} />
            <Route path="factures" element={<BillingFactures />} />
            <Route path="abonnement" element={<BillingAbonnement />} />
          </Route>

          {/* Plateforme / Super Admin */}
          <Route path="platform-admin">
            <Route index element={<PlatformAdminHome />} />

            {/* Copropriétés */}
            <Route path="coproprietes" element={<PlatformCoproprietesList />} />
            <Route
              path="coproprietes/nouveau"
              element={<PlatformCoproprieteForm />}
            />
            <Route
              path="coproprietes/:id"
              element={<PlatformCoproprieteDetail />}
            />
            <Route
              path="coproprietes/:id/modifier"
              element={<PlatformCoproprieteForm />}
            />

            {/* Utilisateurs & rôles */}
            <Route path="utilisateurs-roles" element={<PlatformUsersRoles />} />

            {/* Référentiel copropriété */}
            <Route
              path="referentiel-copropriete"
              element={<ReferentielCopropriete />}
            />
            <Route
              path="referentiel-copropriete/coproprietaires"
              element={<PlatformCoproprietaires />}
            />
            <Route
              path="referentiel-copropriete/lots"
              element={<PlatformLots />}
            />
            <Route
              path="referentiel-copropriete/occupants"
              element={<PlatformOccupants />}
            />
            <Route
              path="referentiel-copropriete/tantiemes"
              element={<PlatformTantiemes />}
            />
          </Route>
        </Route>

        {/* Redirection globale */}
        <Route path="*" element={<Navigate to="/" replace />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
<Route path="/reset-password" element={<ResetPassword />} />
      </Routes>
    </BrowserRouter>
  );
}