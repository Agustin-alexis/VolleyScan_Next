import Sidebar from "@/app/components/Sidebar";

export default function PanelLayout({ children }) {
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100dvh",     // antes: minHeight "100vh"
        overflow: "hidden",   // la página completa no se mueve
      }}
    >
      <Sidebar />

      <main
        style={{
          flex: 1,
          minWidth: 0,
          height: "100dvh",   // antes: minHeight "100vh"
          overflowY: "auto",  // solo esta zona hace scroll
          padding: "20px",
          boxSizing: "border-box",
        }}

      >
        {children}

      </main>

    </div>
  );
}