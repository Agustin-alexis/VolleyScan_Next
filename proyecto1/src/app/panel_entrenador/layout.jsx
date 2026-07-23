import Sidebar from "@/app/components/Sidebar";

export default function PanelLayout({ children }) {
  return (
    <div style={{ display: "flex" }}>
      <Sidebar />

      <main style={{ flex: 1, padding: "20px" }}>
        {children}
      </main>
    </div>
  );
}