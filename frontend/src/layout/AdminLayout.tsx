import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AdminLayout() {
  return (
    <div style={appShell}>
      <Sidebar />

      <main style={mainArea}>
        <Topbar />

        <div style={contentViewport}>
          <div style={contentContainer}>
            <section aria-label="Contenu principal" style={contentFrame}>
              <div style={contentSurface}>
                <Outlet />
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

const appShell: React.CSSProperties = {
  display: "flex",
  minHeight: "100vh",
  width: "100%",
  background:
    "linear-gradient(180deg, #f8fafc 0%, #f6f7fb 42%, #f3f4f6 100%)",
  color: "#111827",
};

const mainArea: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  overflowX: "hidden",
};

const contentViewport: React.CSSProperties = {
  flex: 1,
  width: "100%",
  boxSizing: "border-box",
  padding: "20px 20px 24px",
};

const contentContainer: React.CSSProperties = {
  width: "100%",
  maxWidth: 1360,
  margin: "0 auto",
  boxSizing: "border-box",
};

const contentFrame: React.CSSProperties = {
  minHeight: "calc(100vh - 118px)",
  borderRadius: 28,
  padding: 4,
  background: "rgba(255, 255, 255, 0.42)",
  border: "1px solid rgba(255, 255, 255, 0.58)",
  boxShadow:
    "0 12px 34px rgba(15, 23, 42, 0.05), inset 0 1px 0 rgba(255,255,255,0.45)",
  backdropFilter: "blur(10px)",
};

const contentSurface: React.CSSProperties = {
  width: "100%",
  minHeight: "calc(100vh - 126px)",
  borderRadius: 24,
  padding: 20,
  boxSizing: "border-box",
  background: "rgba(255, 255, 255, 0.8)",
  border: "1px solid rgba(229, 231, 235, 0.72)",
  backdropFilter: "blur(8px)",
};