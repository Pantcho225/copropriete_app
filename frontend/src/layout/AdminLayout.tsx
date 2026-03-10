// src/layout/AdminLayout.tsx
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AdminLayout() {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        width: "100%",
        background:
          "linear-gradient(180deg, #f8fafc 0%, #f6f7fb 42%, #f3f4f6 100%)",
        color: "#111827",
      }}
    >
      <Sidebar />

      <main
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          overflowX: "hidden",
        }}
      >
        <Topbar />

        <div
          style={{
            flex: 1,
            width: "100%",
            boxSizing: "border-box",
            padding: "20px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "1360px",
              margin: "0 auto",
              boxSizing: "border-box",
            }}
          >
            <section
              aria-label="Contenu principal"
              style={{
                minHeight: "calc(100vh - 110px)",
                borderRadius: 28,
                padding: 4,
                background: "rgba(255,255,255,0.45)",
                boxShadow: "0 10px 30px rgba(15, 23, 42, 0.03)",
              }}
            >
              <div
                style={{
                  width: "100%",
                  minHeight: "calc(100vh - 118px)",
                  borderRadius: 24,
                  padding: 20,
                  boxSizing: "border-box",
                  background: "rgba(255,255,255,0.72)",
                  backdropFilter: "blur(6px)",
                }}
              >
                <Outlet />
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}