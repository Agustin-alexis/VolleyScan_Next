import SidebarUsuario from "../components/SidebarUsuario";

export default function UsuarioLayout({ children }) {
    return (
        <div style={{ display: "flex", minHeight: "100vh" }}>
            <SidebarUsuario />

            <main style={{ flex: 1, overflow: "auto" }}>
                {children}
            </main>
        </div>
    );
}