import { Link, useLocation } from "react-router-dom";
import { Home, ClipboardList, Award, DollarSign, User } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const ExpertBottomNav = () => {
  const location = useLocation();
  const { language } = useLanguage();

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["pending-tasks-count"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return 0;
      const { count } = await supabase
        .from("annotation_tasks")
        .select("*", { count: "exact", head: true })
        .eq("assigned_annotator_id", session.user.id)
        .eq("status", "pending");
      return count || 0;
    },
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const navItems = [
    { icon: Home, label: language === "fr" ? "Accueil" : "Home", path: "/expert/home" },
    { icon: ClipboardList, label: language === "fr" ? "Tâches" : "Tasks", path: "/expert/tasks", badge: pendingCount },
    { icon: Award, label: language === "fr" ? "Certif." : "Certs", path: "/expert/certification" },
    { icon: DollarSign, label: language === "fr" ? "Gains" : "Earnings", path: "/expert/earnings" },
    { icon: User, label: language === "fr" ? "Profil" : "Profile", path: "/expert/profile" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t border-border z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[48px] rounded-xl transition-colors active:scale-95 ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <div className="relative">
                <item.icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                {item.badge != null && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] leading-tight ${isActive ? 'font-semibold' : 'font-medium'}`}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
