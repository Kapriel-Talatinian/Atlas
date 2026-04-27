import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Menu, X, LayoutDashboard, User, Settings, LogOut } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userInitials, setUserInitials] = useState("U");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isLanding = location.pathname === "/";

  // Scroll detection
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 80);
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Auth
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
      if (session) {
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .single();
        setUserRole(data?.role || null);
        const email = session.user.email || "";
        setUserInitials(email.substring(0, 2).toUpperCase());
      }
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      if (session) {
        supabase.from("user_roles").select("role").eq("user_id", session.user.id).single()
          .then(({ data }) => setUserRole(data?.role || null));
        setUserInitials((session.user.email || "").substring(0, 2).toUpperCase());
      } else {
        setUserRole(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isDropdownOpen) return;
    const handler = () => setIsDropdownOpen(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [isDropdownOpen]);

  // Close dropdown on escape
  useEffect(() => {
    if (!isDropdownOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setIsDropdownOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isDropdownOpen]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Déconnexion réussie");
    navigate("/");
  };

  const getDashboardLink = () => {
    if (userRole === "admin") return "/admin";
    if (userRole === "client" || userRole === "company") return "/client/dashboard";
    return "/expert/home";
  };

  const getProfileLink = () => {
    if (userRole === "client" || userRole === "company") return "/client/settings";
    return "/expert/profile";
  };

  const handleAnchorNav = useCallback((hash: string) => {
    setIsMobileMenuOpen(false);
    if (location.pathname === "/") {
      const el = document.getElementById(hash);
      el?.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate(`/#${hash}`);
    }
  }, [location.pathname, navigate]);

  const navLinks = [
    { label: "Technology", href: "/technology", isRoute: true },
    { label: "Tarification", href: "pricing", isRoute: false },
    { label: "API", href: isAuthenticated && (userRole === "client" || userRole === "company") ? "/client/api" : "integration", isRoute: isAuthenticated && (userRole === "client" || userRole === "company") },
  ];

  const isActive = (link: typeof navLinks[0]) => {
    if (link.isRoute) return location.pathname === link.href || location.pathname.startsWith(link.href + "/");
    return false;
  };

  const showOpaque = !isLanding || isScrolled;

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 h-16 transition-all duration-200 ${
          showOpaque
            ? "bg-background/80 backdrop-blur-xl border-b border-border"
            : "bg-transparent border-b border-transparent"
        }`}
        aria-label="Navigation principale"
      >
        <div className="mx-auto max-w-[1200px] h-full px-6 flex items-center justify-between">
          {/* Logo */}
          <a
            href="/"
            onClick={(e) => { e.preventDefault(); navigate("/"); }}
            className={`text-xl font-bold tracking-[0.08em] transition-opacity duration-150 hover:opacity-80 ${
              showOpaque ? "text-foreground" : "text-white"
            }`}
            style={{ fontFamily: "'Satoshi', sans-serif" }}
          >
            STEF
          </a>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => {
                  if (link.isRoute) navigate(link.href);
                  else handleAnchorNav(link.href);
                }}
                className={`relative text-sm font-medium transition-colors duration-150 bg-transparent border-none cursor-pointer ${
                  isActive(link)
                    ? showOpaque ? "text-foreground" : "text-white"
                    : showOpaque ? "text-muted-foreground hover:text-foreground" : "text-white/60 hover:text-white"
                }`}
              >
                {link.label}
                {isActive(link) && (
                  <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* Desktop right actions */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <button
                  onClick={() => navigate(getDashboardLink())}
                  className={`flex items-center gap-1.5 text-sm font-medium transition-colors duration-150 bg-transparent border-none cursor-pointer ${
                    showOpaque ? "text-muted-foreground hover:text-foreground" : "text-white/60 hover:text-white"
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </button>
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsDropdownOpen(!isDropdownOpen); }}
                    className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold cursor-pointer border-none"
                    aria-expanded={isDropdownOpen}
                    aria-controls="user-dropdown"
                  >
                    {userInitials}
                  </button>
                  <AnimatePresence>
                    {isDropdownOpen && (
                      <motion.div
                        id="user-dropdown"
                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-9 w-[200px] bg-card border border-border rounded-lg shadow-lg py-1 z-50"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => { setIsDropdownOpen(false); navigate(getProfileLink()); }}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors bg-transparent border-none cursor-pointer text-left"
                        >
                          <User className="w-4 h-4 text-muted-foreground" /> Mon profil
                        </button>
                        <button
                          onClick={() => { setIsDropdownOpen(false); navigate(getProfileLink()); }}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors bg-transparent border-none cursor-pointer text-left"
                        >
                          <Settings className="w-4 h-4 text-muted-foreground" /> Paramètres
                        </button>
                        <div className="border-t border-border my-1" />
                        <button
                          onClick={() => { setIsDropdownOpen(false); handleLogout(); }}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-destructive hover:bg-muted transition-colors bg-transparent border-none cursor-pointer text-left"
                        >
                          <LogOut className="w-4 h-4" /> Se déconnecter
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/auth")}
                  className={`text-sm font-medium ${
                    showOpaque ? "text-muted-foreground hover:text-foreground" : "text-white/60 hover:text-white hover:bg-white/10"
                  }`}
                >
                  Se connecter
                </Button>
                <Button
                  size="sm"
                  onClick={() => navigate("/auth")}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium rounded-lg px-4"
                >
                  Démarrer
                </Button>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className={`md:hidden bg-transparent border-none cursor-pointer ${
              showOpaque ? "text-foreground" : "text-white"
            }`}
            onClick={() => setIsMobileMenuOpen(true)}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-menu"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-background flex flex-col md:hidden"
          >
            <div className="h-16 px-6 flex items-center justify-between border-b border-border">
              <a
                href="/"
                onClick={(e) => { e.preventDefault(); setIsMobileMenuOpen(false); navigate("/"); }}
                className="text-xl font-bold tracking-[0.08em] text-foreground"
              >
                STEF
              </a>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-foreground bg-transparent border-none cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 flex flex-col px-6 pt-8 gap-2">
              {navLinks.map((link) => (
                <button
                  key={link.label}
                  onClick={() => {
                    if (link.isRoute) { navigate(link.href); setIsMobileMenuOpen(false); }
                    else handleAnchorNav(link.href);
                  }}
                  className={`text-left text-lg font-medium py-4 bg-transparent border-none cursor-pointer transition-colors ${
                    isActive(link) ? "text-primary" : "text-foreground"
                  }`}
                >
                  {link.label}
                </button>
              ))}

              <div className="border-t border-border my-4" />

              {isAuthenticated ? (
                <>
                  <button
                    onClick={() => { navigate(getDashboardLink()); setIsMobileMenuOpen(false); }}
                    className="text-left text-lg font-medium py-4 text-foreground bg-transparent border-none cursor-pointer"
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                    className="text-left text-lg font-medium py-4 text-destructive bg-transparent border-none cursor-pointer"
                  >
                    Se déconnecter
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { navigate("/auth"); setIsMobileMenuOpen(false); }}
                    className="text-left text-lg font-medium py-4 text-foreground bg-transparent border-none cursor-pointer"
                  >
                    Se connecter
                  </button>
                  <Button
                    size="lg"
                    className="w-full mt-2 bg-primary text-primary-foreground"
                    onClick={() => { navigate("/auth"); setIsMobileMenuOpen(false); }}
                  >
                    Démarrer
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
