import { BarChart3, FileText, Folder, LogOut, Server, Settings, Shield } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { Button } from "../components/ui/Button.js";

const navItems = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/services", label: "Servicios", icon: Server },
  { href: "/files", label: "Archivos", icon: Folder },
  { href: "/logs", label: "Logs", icon: FileText },
  { href: "/system", label: "Sistema", icon: Settings }
];

export const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="app-shell">
      <aside className="desktop-sidebar sticky top-0 z-30 border-b border-line bg-ink/95 backdrop-blur">
        <div className="flex h-16 min-w-0 items-center gap-3 px-4 sm:px-5">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-cyanGlow text-ink">
            <Shield className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100">Poco Cloud</p>
            <p className="text-xs text-slate-500">Personal control plane</p>
          </div>
        </div>
        <nav className="mobile-nav-grid desktop-nav gap-1 px-2 pb-2 sm:px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                `nav-item flex min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1.5 py-2 text-[11px] font-medium leading-tight transition ${
                  isActive ? "bg-cyanGlow/12 text-cyanGlow" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                }`
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="min-w-0 truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="desktop-main min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b border-line bg-ink/90 px-4 py-3 backdrop-blur sm:px-5">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-cyanGlow">Secure session</p>
            <h1 className="truncate text-base font-semibold text-slate-100">{user?.displayName}</h1>
          </div>
          <Button variant="ghost" className="shrink-0" onClick={() => void handleLogout()}>
            <LogOut className="h-4 w-4" />
            Salir
          </Button>
        </header>
        <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
