import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useUserDisplayName(role: "expert" | "client") {
  return useQuery({
    queryKey: ["user-display-name", role],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      if (role === "client") {
        const { data } = await supabase
          .from("clients")
          .select("company_name")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1);
        return data?.[0]?.company_name || "Mon Entreprise";
      }

      // Expert
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .single();
      return profile?.full_name || "Utilisateur";
    },
    staleTime: 60_000,
  });
}
