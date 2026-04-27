import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import { MaintenanceBanner } from "@/components/MaintenanceBanner";
import { AdminSidebar, AdminMobileNav } from "@/components/admin/AdminSidebar";
import { AdminOverview } from "@/components/admin/AdminOverview";
import { AdminCRM360 } from "@/components/admin/AdminCRM360";
import { AdminExpertsPage } from "@/components/admin/AdminExpertsPage";
import { AdminClientsPage } from "@/components/admin/AdminClientsPage";
import { AdminProjectsPage } from "@/components/admin/AdminProjectsPage";
import { AdminTasksPage } from "@/components/admin/AdminTasksPage";
import { AdminQualityPage } from "@/components/admin/AdminQualityPage";
import { AdminFinancesPage } from "@/components/admin/AdminFinancesPage";
import { AdminLogsPage } from "@/components/admin/AdminLogsPage";
import { AdminSettingsPage } from "@/components/admin/AdminSettingsPage";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { cn } from "@/lib/utils";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { enabled: maintenanceOn, message: maintenanceMsg } = useMaintenanceMode();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [activeSection]);

  const renderSection = () => {
    switch (activeSection) {
      case "overview": return <AdminOverview onNavigate={setActiveSection} />;
      case "crm": return <AdminCRM360 />;
      case "experts": return <AdminExpertsPage />;
      case "clients": return <AdminClientsPage />;
      case "projects": return <AdminProjectsPage />;
      case "tasks": return <AdminTasksPage />;
      case "quality": return <AdminQualityPage />;
      case "finances": return <AdminFinancesPage />;
      case "logs": return <AdminLogsPage />;
      case "settings": return <AdminSettingsPage />;
      default: return <AdminOverview onNavigate={setActiveSection} />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onLogout={handleLogout}
      />

      {/* Mobile header */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-background border-b border-border z-30 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-foreground tracking-tight">STEF</span>
          <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">Admin</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-20 bg-background/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute top-14 left-0 right-0 bg-background border-b border-border p-4 space-y-1" onClick={e => e.stopPropagation()}>
            {["overview","experts","clients","projects","tasks","quality","finances","logs","settings"].map(id => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={cn(
                  "block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                  activeSection === id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"
                )}
              >
                {id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, " ")}
              </button>
            ))}
            <button onClick={handleLogout} className="block w-full text-left px-3 py-2 text-sm text-muted-foreground">Déconnexion</button>
          </div>
        </div>
      )}

      <AdminMobileNav activeSection={activeSection} onSectionChange={setActiveSection} />

      {/* Main content */}
      <main className={cn("flex-1 min-h-screen", "md:ml-60", "pt-14 md:pt-0", "pb-16 md:pb-0")}>
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-8 space-y-6">
            {maintenanceOn && <MaintenanceBanner message={maintenanceMsg} />}
            <ErrorBoundary>
              {renderSection()}
            </ErrorBoundary>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
