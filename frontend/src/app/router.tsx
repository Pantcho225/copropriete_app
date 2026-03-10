import { createBrowserRouter } from "react-router-dom";
import LoginPage from "../auth/LoginPage";
import RequireAuth from "../auth/RequireAuth";
import AppLayout from "../components/AppLayout";
import ImportCsvPage from "../features/compta/ImportCsvPage";
import ImportDetailPage from "../features/compta/ImportDetailPage";
import RapproStatsPage from "../features/compta/RapproStatsPage";
import ReleveLignes from "../pages/compta/ReleveLignes";
import RHEmployes from "../pages/rh/RHEmployes";
import RHContrats from "../pages/rh/RHContrats";
import EmployeForm from "../pages/rh/EmployeForm";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },

  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/", element: <ImportCsvPage /> },

          // COMPTA
          { path: "/compta/import", element: <ImportCsvPage /> },
          { path: "/compta/imports/:importId", element: <ImportDetailPage /> },
          { path: "/compta/imports/:importId/lignes", element: <ReleveLignes /> },
          { path: "/compta/stats", element: <RapproStatsPage /> },

          // RH — Employés
          { path: "/rh/employes", element: <RHEmployes /> },
          { path: "/rh/employes/nouveau", element: <EmployeForm /> },
          { path: "/rh/employes/:id/modifier", element: <EmployeForm /> },

          // RH — Contrats
          { path: "/rh/contrats", element: <RHContrats /> },
        ],
      },
    ],
  },
]);