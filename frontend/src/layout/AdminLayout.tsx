import type { CSSProperties } from "react";
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

const appShell: CSSProperties = {
  display: "flex",
  minHeight: "100vh",
  width: "100%",
  background:
    "radial-gradient(circle at 88% 0%, rgba(182, 141, 64, 0.12) 0%, rgba(182, 141, 64, 0) 30%), linear-gradient(180deg, #F6F2E9 0%, #F8F5EE 48%, #EFE9DC 100%)",
  color: "#0B1320",
  overflow: "hidden",
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const mainArea: CSSProperties = {
  flex: 1,
  minWidth: 0,
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  overflowX: "hidden",
  overflowY: "auto",
};

const contentViewport: CSSProperties = {
  flex: 1,
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  padding: "22px 24px 28px",
};

const contentContainer: CSSProperties = {
  width: "100%",
  maxWidth: 1480,
  margin: "0 auto",
  boxSizing: "border-box",
  minWidth: 0,
};

const contentFrame: CSSProperties = {
  minHeight: "calc(100vh - 118px)",
  borderRadius: 28,
  padding: 6,
  background: "rgba(255, 255, 255, 0.68)",
  border: "1px solid rgba(210, 198, 174, 0.86)",
  boxShadow: "0 18px 44px rgba(75, 55, 20, 0.08)",
  backdropFilter: "blur(12px)",
  boxSizing: "border-box",
  minWidth: 0,
};

const contentSurface: CSSProperties = {
  width: "100%",
  minHeight: "calc(100vh - 130px)",
  borderRadius: 24,
  padding: 24,
  boxSizing: "border-box",
  background:
    "linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(250, 248, 242, 0.96) 100%)",
  border: "1px solid rgba(228, 223, 210, 0.96)",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.88)",
  overflowX: "hidden",
  minWidth: 0,
};
