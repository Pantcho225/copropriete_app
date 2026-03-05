// src/layout/AdminLayout.tsx
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AdminLayout() {
  return (
    <div
      style={{
        display: "flex",
        background: "#fafafa",
        minHeight: "100vh",
        width: "100%",
      }}
    >
      <Sidebar />

      <main
        style={{
          flex: 1,
          minHeight: "100vh",
          minWidth: 0, // ✅ important: évite les débordements horizontaux (tables / cards)
        }}
      >
        <Topbar />

        {/* ✅ container global (responsive + limite largeur) */}
        <div
          style={{
            padding: 18,
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 1320, // ✅ look "app" propre (tu peux mettre 1400 si tu veux)
              margin: "0 auto",
            }}
          >
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}