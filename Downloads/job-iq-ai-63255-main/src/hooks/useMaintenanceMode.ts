import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface MaintenanceState {
  enabled: boolean;
  message: string;
  loading: boolean;
}

export function useMaintenanceMode() {
  const [state, setState] = useState<MaintenanceState>({ enabled: false, message: "", loading: true });
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const check = async () => {
      // Check maintenance setting
      const { data: settings } = await supabase
        .from("platform_settings" as any)
        .select("key, value")
        .in("key", ["maintenance_mode", "maintenance_message"]);

      let enabled = false;
      let message = "";
      if (settings) {
        for (const row of settings as any[]) {
          if (row.key === "maintenance_mode") enabled = row.value === true || row.value === "true";
          if (row.key === "maintenance_message") message = typeof row.value === "string" ? row.value : "";
        }
      }

      // Check if current user is admin
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        const admin = roles?.some((r: any) => r.role === "admin") ?? false;
        setIsAdmin(admin);
      }

      setState({ enabled, message, loading: false });
    };
    check();
  }, []);

  return { ...state, isAdmin };
}
