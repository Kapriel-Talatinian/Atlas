import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle } from "lucide-react";

interface Warning {
  id: string;
  created_at: string;
  warning_type: string;
  severity: number;
  details: string | null;
  acknowledged_at: string | null;
}

interface SanctionsSectionProps {
  warnings: Warning[];
  suspendedUntil?: string | null;
  suspensionReason?: string | null;
}

const typeLabels: Record<string, { label: string; className: string }> = {
  speed_violation: { label: "Vitesse suspecte", className: "bg-amber-500/10 text-amber-500" },
  low_alpha: { label: "Alpha faible", className: "bg-destructive/10 text-destructive" },
  duplicate_reasoning: { label: "Raisonnement dupliqué", className: "bg-destructive/10 text-destructive" },
  monotone_scoring: { label: "Scoring monotone", className: "bg-amber-500/10 text-amber-500" },
  preference_bias: { label: "Biais de préférence", className: "bg-amber-500/10 text-amber-500" },
};

export function SanctionsSection({ warnings, suspendedUntil, suspensionReason }: SanctionsSectionProps) {
  const isSuspended = suspendedUntil && new Date(suspendedUntil) > new Date();

  return (
    <div className="space-y-4">
      {isSuspended && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4">
          <p className="text-sm font-medium text-destructive">
            Votre compte est suspendu jusqu'au {new Date(suspendedUntil!).toLocaleDateString("fr-FR")}.
          </p>
          {suspensionReason && (
            <p className="text-xs text-destructive/80 mt-1">Motif : {suspensionReason}</p>
          )}
        </div>
      )}

      {warnings.length === 0 ? (
        <div className="flex items-center gap-2 py-6 justify-center">
          <CheckCircle className="w-5 h-5 text-emerald-500" />
          <p className="text-sm text-muted-foreground">Aucun avertissement ou sanction.</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[12px] uppercase tracking-wider">Date</TableHead>
                <TableHead className="text-[12px] uppercase tracking-wider">Type</TableHead>
                <TableHead className="text-[12px] uppercase tracking-wider">Sévérité</TableHead>
                <TableHead className="text-[12px] uppercase tracking-wider">Détail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {warnings.slice(0, 10).map((w) => {
                const typeInfo = typeLabels[w.warning_type] || { label: w.warning_type, className: "bg-muted text-muted-foreground" };
                return (
                  <TableRow key={w.id}>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {new Date(w.created_at).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${typeInfo.className}`}>
                        {typeInfo.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <SeverityDot severity={w.severity} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {w.details || "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function SeverityDot({ severity }: { severity: number }) {
  const config =
    severity >= 4
      ? { color: "bg-destructive", label: "Critique" }
      : severity >= 3
      ? { color: "bg-destructive", label: "Élevée" }
      : severity >= 2
      ? { color: "bg-amber-500", label: "Moyenne" }
      : { color: "bg-muted-foreground", label: "Faible" };

  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${config.color} ${severity >= 4 ? "animate-pulse" : ""}`} />
      <span className="text-xs text-muted-foreground">{config.label}</span>
    </div>
  );
}
