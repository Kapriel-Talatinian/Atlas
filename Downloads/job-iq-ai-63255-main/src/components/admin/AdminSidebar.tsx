import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  LayoutDashboard, Users, Building2, FolderOpen,
  ClipboardList, Shield, DollarSign, FileText,
  Settings, LogOut, ChevronLeft, ChevronRight, Eye,
} from "lucide-react";
import { useState } from "react";

interface AdminSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  onLogout: () => void;
}

const NAV_ITEMS = [
  { id: "overview", label: "Vue d'ensemble", icon: LayoutDashboard },
  { id: "crm", label: "CRM 360°", icon: Eye },
  { id: "experts", label: "Experts", icon: Users },
  { id: "clients", label: "Clients", icon: Building2 },
  { id: "projects", label: "Projets", icon: FolderOpen },
  { id: "tasks", label: "Tâches", icon: ClipboardList },
  { id: "quality", label: "Qualité", icon: Shield },
  { id: "finances", label: "Finances", icon: DollarSign },
  { id: "logs", label: "Logs", icon: FileText },
  { id: "settings", label: "Paramètres", icon: Settings },
];

export function AdminSidebar({ activeSection, onSectionChange, onLogout }: AdminSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-r border-border bg-background fixed inset-y-0 left-0 z-30 transition-all duration-200",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-foreground tracking-tight">STEF</span>
            <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">Admin</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onSectionChange(item.id)}
            title={collapsed ? item.label : undefined}
            className={cn(
              "w-full flex items-center gap-3 rounded-lg text-sm transition-colors duration-150",
              collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2",
              activeSection === item.id
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <item.icon className="w-5 h-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border space-y-2">
        <div className={cn("flex items-center", collapsed ? "justify-center" : "px-3")}>
          <ThemeToggle />
        </div>
        <button
          onClick={onLogout}
          className={cn(
            "w-full flex items-center gap-3 rounded-lg text-sm text-muted-foreground hover:text-destructive transition-colors duration-150",
            collapsed ? "justify-center py-2" : "px-3 py-2"
          )}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Déconnexion</span>}
        </button>
      </div>
    </aside>
  );
}

// Mobile bottom nav for admin
export function AdminMobileNav({ activeSection, onSectionChange }: { activeSection: string; onSectionChange: (s: string) => void }) {
  const mobileItems = NAV_ITEMS.slice(0, 5);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border z-30">
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {mobileItems.map((item) => {
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 min-w-[48px] py-1 transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className={cn("w-5 h-5", active && "stroke-[2.5]")} />
              <span className={cn("text-[10px]", active ? "font-semibold" : "font-medium")}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
