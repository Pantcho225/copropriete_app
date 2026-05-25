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
    "linear-gradient(180deg, #f8fafc 0%, #f4f6fb 46%, #f1f5f9 100%)",
  color: "#111827",
  overflow: "hidden",
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
  background: "rgba(255, 255, 255, 0.58)",
  border: "1px solid rgba(226, 232, 240, 0.9)",
  boxShadow: "0 14px 34px rgba(15, 23, 42, 0.06)",
  backdropFilter: "blur(10px)",
  boxSizing: "border-box",
  minWidth: 0,
};

const contentSurface: CSSProperties = {
  width: "100%",
  minHeight: "calc(100vh - 130px)",
  borderRadius: 24,
  padding: 24,
  boxSizing: "border-box",
  background: "#ffffff",
  border: "1px solid rgba(226, 232, 240, 0.95)",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.8)",
  overflowX: "hidden",
  minWidth: 0,
};