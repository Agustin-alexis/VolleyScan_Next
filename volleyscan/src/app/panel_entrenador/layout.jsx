import Sidebar from "@/app/components/Sidebar";

export default function PanelLayout({ children }) {
  return (
    <div
      style={{
        display: "flex",
        width: "100vw",
        minHeight: "100vh",
      }}
    >
      <Sidebar />

      <main
        style={{
          flex: 1,
          width: "100%",
          minWidth: 0,
          padding: 20,
        }}
      >
        {children}
      </main>
    </div>
  );
}