import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Home, ClipboardList, Award, DollarSign, User, Settings,
  FolderOpen, Plus, FileText, Key, CreditCard, LogOut, Menu, X
} from "lucide-react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useUserDisplayName } from "@/hooks/useUserDisplayName";

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  badge?: number;
}

interface DashboardLayoutProps {
  children: ReactNode;
  role: "expert" | "client";
  navItems: NavItem[];
  userName?: string;
}

export function DashboardLayout({ children, role, navItems, userName }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Déconnecté");
    navigate("/");
  };

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-60 border-r border-border bg-background fixed inset-y-0 left-0 z-30">
        <div className="h-14 flex items-center px-5 border-b border-border">
          <Link to="/" className="text-lg font-bold text-foreground tracking-tight">
            STEF
          </Link>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-150",
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.badge != null && item.badge > 0 && (
                  <span className="min-w-[20px] h-5 bg-primary text-primary-foreground text-[11px] font-medium rounded-full flex items-center justify-center px-1.5">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border space-y-2">
          <div className="flex items-center justify-between px-3">
            <ThemeToggle />
          </div>
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-muted text-muted-foreground text-xs font-medium">
                {userName?.charAt(0)?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{userName || "Utilisateur"}</p>
            </div>
            <Button variant="ghost" size="icon" className="shrink-0 w-8 h-8" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-background border-b border-border z-30 flex items-center justify-between px-4">
        <Link to="/" className="text-lg font-bold text-foreground tracking-tight">STEF</Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </header>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-20 bg-background/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute top-14 left-0 right-0 bg-background border-b border-border p-4 space-y-1" onClick={(e) => e.stopPropagation()}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                    active ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <div className="pt-2 border-t border-border mt-2">
              <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 text-sm text-muted-foreground w-full">
                <LogOut className="w-5 h-5" />
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border z-30 safe-area-pb">
        <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
          {navItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 min-w-[48px] py-1 transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <div className="relative">
                  <Icon className={cn("w-5 h-5", active && "stroke-[2.5]")} />
                  {item.badge != null && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className={cn("text-[10px]", active ? "font-semibold" : "font-medium")}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Main Content */}
      <main className={cn(
        "flex-1 min-h-screen",
        "md:ml-60",
        "pt-14 md:pt-0",
        "pb-16 md:pb-0"
      )}>
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-8">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}

// Pre-configured layouts
export function ExpertDashboardLayout({ children, userName, pendingCount }: { children: ReactNode; userName?: string; pendingCount?: number }) {
  const { data: fetchedName } = useUserDisplayName("expert");
  const resolvedName = userName || fetchedName || undefined;

  const navItems: NavItem[] = [
    { label: "Accueil", path: "/expert/home", icon: Home },
    { label: "Taches", path: "/expert/tasks", icon: ClipboardList, badge: pendingCount },
    { label: "Certification", path: "/expert/certification", icon: Award },
    { label: "Gains", path: "/expert/earnings", icon: DollarSign },
    { label: "Profil", path: "/expert/profile", icon: User },
  ];

  return (
    <DashboardLayout role="expert" navItems={navItems} userName={resolvedName}>
      {children}
    </DashboardLayout>
  );
}

export function ClientDashboardLayout({ children, userName }: { children: ReactNode; userName?: string }) {
  const { data: fetchedName } = useUserDisplayName("client");
  const resolvedName = userName || fetchedName || undefined;

  const navItems: NavItem[] = [
    { label: "Accueil", path: "/client/dashboard", icon: Home },
    { label: "Projets", path: "/client/projects", icon: FolderOpen },
    { label: "Facturation", path: "/client/billing", icon: CreditCard },
    { label: "Parametres", path: "/client/settings", icon: Settings },
  ];

  return (
    <DashboardLayout role="client" navItems={navItems} userName={resolvedName}>
      {children}
    </DashboardLayout>
  );
}
