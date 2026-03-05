import { createBrowserRouter } from "react-router-dom";
import LoginPage from "../auth/LoginPage";
import RequireAuth from "../auth/RequireAuth";
import AppLayout from "../components/AppLayout";
import ImportCsvPage from "../features/compta/ImportCsvPage";
import ImportDetailPage from "../features/compta/ImportDetailPage";
import RapproStatsPage from "../features/compta/RapproStatsPage";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },

  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/", element: <ImportCsvPage /> },
          { path: "/compta/import", element: <ImportCsvPage /> },
          { path: "/compta/imports/:importId", element: <ImportDetailPage /> },
          { path: "/compta/stats", element: <RapproStatsPage /> },
        ],
      },
    ],
  },
]);