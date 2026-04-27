import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SLASelectorProps {
  domain: string;
  taskType: string;
  numTasks: number;
  basePrice: number;
  selectedTier: string;
  onSelect: (tier: string) => void;
}

const TIER_LABELS: Record<string, string> = {
  standard: "Standard",
  priority: "Prioritaire",
  express: "Express",
};

const TIER_PREMIUMS: Record<string, string> = {
  standard: "",
  priority: "+30%",
  express: "+80%",
};

export const SLASelector = ({ domain, taskType, numTasks, basePrice, selectedTier, onSelect }: SLASelectorProps) => {
  const { data: tiers, isLoading } = useQuery({
    queryKey: ["sla-tiers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sla_tiers")
        .select("*")
        .eq("active", true)
        .order("price_multiplier", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: estimates } = useQuery({
    queryKey: ["sla-estimates", domain, taskType, numTasks],
    enabled: !!domain && !!taskType && numTasks > 0,
    queryFn: async () => {
      const results: Record<string, any> = {};
      for (const tier of ["standard", "priority", "express"]) {
        const { data } = await supabase.rpc("estimate_delivery_v2", {
          p_domain: domain,
          p_task_type: taskType,
          p_num_tasks: numTasks,
          p_sla_tier: tier,
        });
        if (data?.[0]) results[tier] = data[0];
      }
      return results;
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium mb-1">Niveau de service</h3>
        <p className="text-xs text-muted-foreground">
          Choisissez le SLA adapté à vos besoins en termes de délai et de qualité.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(tiers || []).map((tier: any) => {
          const estimate = estimates?.[tier.tier_name];
          const cost = basePrice * (tier.price_multiplier || 1);
          const isSelected = selectedTier === tier.tier_name;

          return (
            <Card
              key={tier.id}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                isSelected && "ring-2 ring-primary border-primary"
              )}
              onClick={() => onSelect(tier.tier_name)}
            >
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">
                    {TIER_LABELS[tier.tier_name] || tier.tier_name}
                  </span>
                  {TIER_PREMIUMS[tier.tier_name] && (
                    <Badge variant="secondary" className="text-xs">
                      {TIER_PREMIUMS[tier.tier_name]}
                    </Badge>
                  )}
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Livraison estimée</span>
                    <span className="font-mono font-medium text-foreground">
                      {estimate?.estimated_days || "—"} jours
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Qualité garantie</span>
                    <span className="font-mono font-medium text-foreground">
                      α ≥ {tier.guaranteed_min_alpha}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Annotateurs/tâche</span>
                    <span className="font-mono font-medium text-foreground">
                      {tier.min_annotators_per_task}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-border">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-muted-foreground">Coût estimé</span>
                    <span className="text-lg font-semibold font-mono">
                      {cost.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} $
                    </span>
                  </div>
                </div>

                {estimate?.capacity_warning && (
                  <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{estimate.capacity_message}</span>
                  </div>
                )}

                {isSelected && (
                  <div className="flex justify-center">
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
