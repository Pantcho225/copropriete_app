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
            padding: "20px 20px 24px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 1360,
              margin: "0 auto",
              boxSizing: "border-box",
            }}
          >
            <section
              aria-label="Contenu principal"
              style={{
                minHeight: "calc(100vh - 118px)",
                borderRadius: 28,
                padding: 4,
                background: "rgba(255,255,255,0.42)",
                border: "1px solid rgba(255,255,255,0.55)",
                boxShadow:
                  "0 10px 30px rgba(15, 23, 42, 0.04), inset 0 1px 0 rgba(255,255,255,0.45)",
                backdropFilter: "blur(8px)",
              }}
            >
              <div
                style={{
                  width: "100%",
                  minHeight: "calc(100vh - 126px)",
                  borderRadius: 24,
                  padding: 20,
                  boxSizing: "border-box",
                  background: "rgba(255,255,255,0.78)",
                  border: "1px solid rgba(229,231,235,0.7)",
                  backdropFilter: "blur(8px)",
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