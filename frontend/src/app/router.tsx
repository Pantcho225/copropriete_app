import { createBrowserRouter } from "react-router-dom";
import LoginPage from "../auth/LoginPage";
import RequireAuth from "../auth/RequireAuth";
import AppLayout from "../components/AppLayout";
import ImportCsvPage from "../features/compta/ImportCsvPage";
import ImportDetailPage from "../features/compta/ImportDetailPage";
import RapproStatsPage from "../features/compta/RapproStatsPage";
import ReleveLignes from "../pages/compta/ReleveLignes";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },

  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/", element: <ImportCsvPage /> },

          // Import CSV
          { path: "/compta/import", element: <ImportCsvPage /> },

          // Détail import
          { path: "/compta/imports/:importId", element: <ImportDetailPage /> },

          // ✅ Lignes importées
          { path: "/compta/imports/:importId/lignes", element: <ReleveLignes /> },

          // Stats rapprochements
          { path: "/compta/stats", element: <RapproStatsPage /> },
        ],
      },
    ],
  },
]);