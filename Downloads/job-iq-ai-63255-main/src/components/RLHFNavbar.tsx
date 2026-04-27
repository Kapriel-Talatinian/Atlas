import { Button } from "@/components/ui/button";
import { Menu, X, LogOut, LayoutDashboard } from "lucide-react";
import { RequestQuoteButton } from "@/components/landing/CTAs";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const RLHFNavbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
      if (session) {
        const { data } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id).limit(1).maybeSingle();
        setUserRole(data?.role || null);
      }
    };
    checkAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsAuthenticated(!!session);
      if (!session) setUserRole(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isMobileMenuOpen]);

  const handleLogout = async () => { await supabase.auth.signOut(); toast.success("Déconnecté"); navigate("/"); };

  const getDashboardPath = () => {
    if (userRole === "admin") return "/admin";
    if (userRole === "company" || userRole === "client") return "/client/dashboard";
    return "/expert/home";
  };

  const navTo = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <nav className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-200",
        isScrolled ? "bg-background/95 backdrop-blur-md border-b border-border" : "bg-transparent"
      )}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <button onClick={() => navigate("/")} className="text-lg font-bold text-foreground tracking-tight">
              STEF
            </button>

            {/* Desktop links */}
            <div className="hidden lg:flex items-center gap-6">
              <button onClick={() => navigate("/technology")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Technology</button>
              <button onClick={() => navigate("/blog")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Journal</button>
              <button onClick={() => {
                const el = document.getElementById("pricing");
                if (el) el.scrollIntoView({ behavior: "smooth" });
                else navigate("/#pricing");
              }} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Tarification</button>
            </div>

            {/* Desktop auth */}
            <div className="hidden lg:flex items-center gap-3">
              {isAuthenticated ? (
                <>
                  <Button variant="ghost" size="sm" onClick={() => navigate(getDashboardPath())}>
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Dashboard
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleLogout}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Déconnexion
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>Connexion</Button>
                  <RequestQuoteButton size="sm" withArrow={false} />
                </>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              className="lg:hidden flex items-center justify-center w-10 h-10"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile slide-in panel */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden" onClick={() => setIsMobileMenuOpen(false)}>
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/50 transition-opacity" />
        </div>
      )}
      <div
        className={cn(
          "fixed top-0 right-0 z-[70] h-full w-[280px] bg-card border-l border-border flex flex-col transition-transform duration-200 ease-out lg:hidden",
          isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Close */}
        <div className="flex items-center justify-end h-14 px-4">
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex items-center justify-center w-10 h-10"
            aria-label="Fermer"
          >
            <X className="w-5 h-5 text-foreground" />
          </button>
        </div>

        {/* Links */}
        <div className="flex-1 flex flex-col px-4 pt-4 space-y-1">
          <button onClick={() => navTo("/technology")} className="text-left text-lg text-foreground py-3 px-3 rounded-lg hover:bg-muted transition-colors">
            Technology
          </button>
          <button onClick={() => navTo("/blog")} className="text-left text-lg text-foreground py-3 px-3 rounded-lg hover:bg-muted transition-colors">
            Journal
          </button>
          <button onClick={() => {
            setIsMobileMenuOpen(false);
            setTimeout(() => {
              const el = document.getElementById("pricing");
              if (el) el.scrollIntoView({ behavior: "smooth" });
              else navigate("/#pricing");
            }, 100);
          }} className="text-left text-lg text-foreground py-3 px-3 rounded-lg hover:bg-muted transition-colors">
            Tarification
          </button>
        </div>

        {/* Auth buttons at bottom */}
        <div className="px-4 pb-8 space-y-3">
          {isAuthenticated ? (
            <>
              <Button variant="outline" className="w-full h-12" onClick={() => navTo(getDashboardPath())}>
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
              <Button variant="ghost" className="w-full h-12" onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}>
                <LogOut className="w-4 h-4 mr-2" />
                Déconnexion
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" className="w-full h-12" onClick={() => navTo("/auth")}>Connexion</Button>
              <RequestQuoteButton
                size="lg"
                className="w-full h-12"
                onBeforeNavigate={() => setIsMobileMenuOpen(false)}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
};
