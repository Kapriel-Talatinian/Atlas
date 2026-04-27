import { Check, X, Minus } from "lucide-react";

type Cell = "yes" | "no" | "partial" | string;

const renderCell = (v: Cell) => {
  if (v === "yes") return <Check className="w-4 h-4 text-emerald-500 mx-auto" />;
  if (v === "no") return <X className="w-4 h-4 text-red-500 mx-auto" />;
  if (v === "partial") return <Minus className="w-4 h-4 text-amber-500 mx-auto" />;
  return <span className="text-sm text-foreground font-mono">{v}</span>;
};

const rows: { label: string; stef: Cell; scale: Cell; surge: Cell; internal: Cell; freelance: Cell }[] = [
  { label: "Experts certifiés par domaine", stef: "yes", scale: "partial", surge: "yes", internal: "yes", freelance: "no" },
  { label: "Hébergement souverain UE (Mistral)", stef: "yes", scale: "no", surge: "no", internal: "partial", freelance: "no" },
  { label: "AI Act art. 11 prêt", stef: "yes", scale: "partial", surge: "no", internal: "partial", freelance: "no" },
  { label: "Krippendorff α garanti par SLA", stef: "yes", scale: "no", surge: "partial", internal: "no", freelance: "no" },
  { label: "Time-to-first-delivery", stef: "5 jours", scale: "3-4 sem.", surge: "2-3 sem.", internal: "12 sem.", freelance: "Variable" },
  { label: "Prix moyen / tâche", stef: "30 €", scale: "55-80 €", surge: "60-90 €", internal: "85 €", freelance: "20-50 €" },
  { label: "GDPR DPA signé", stef: "yes", scale: "partial", surge: "partial", internal: "yes", freelance: "no" },
  { label: "Audit trail complet", stef: "yes", scale: "partial", surge: "yes", internal: "partial", freelance: "no" },
  { label: "Engagement minimum", stef: "POC 50 tâches", scale: "10k$ min", surge: "5k$ min", internal: "3 ETP", freelance: "Aucun" },
  { label: "Rapport qualité signé", stef: "yes", scale: "no", surge: "partial", internal: "no", freelance: "no" },
];

export const ComparisonSection = () => {
  return (
    <section id="comparison" className="relative py-24 px-4 sm:px-6 border-t border-border">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="inline-block text-xs uppercase tracking-wider text-primary font-medium mb-4">
            Comparaison
          </span>
          <h2 className="text-foreground text-3xl md:text-4xl font-semibold mb-4">
            STEF vs alternatives
          </h2>
          <p className="text-muted-foreground text-base md:text-lg">
            Comparaison objective face aux leaders US et aux solutions internes/freelances.
          </p>
        </div>

        <div className="border border-border rounded-2xl overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left text-xs text-muted-foreground uppercase tracking-wider font-medium px-5 py-4">
                    Critère
                  </th>
                  <th className="text-center text-xs uppercase tracking-wider font-semibold px-3 py-4 bg-primary/10">
                    <span className="text-primary">STEF</span>
                  </th>
                  <th className="text-center text-xs text-muted-foreground uppercase tracking-wider font-medium px-3 py-4">
                    Scale AI
                  </th>
                  <th className="text-center text-xs text-muted-foreground uppercase tracking-wider font-medium px-3 py-4">
                    Surge AI
                  </th>
                  <th className="text-center text-xs text-muted-foreground uppercase tracking-wider font-medium px-3 py-4">
                    Équipe interne
                  </th>
                  <th className="text-center text-xs text-muted-foreground uppercase tracking-wider font-medium px-3 py-4">
                    Freelances
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.label} className={i % 2 === 0 ? "bg-muted/20" : ""}>
                    <td className="px-5 py-3.5 text-sm text-foreground">{row.label}</td>
                    <td className="px-3 py-3.5 text-center bg-primary/[0.06]">{renderCell(row.stef)}</td>
                    <td className="px-3 py-3.5 text-center">{renderCell(row.scale)}</td>
                    <td className="px-3 py-3.5 text-center">{renderCell(row.surge)}</td>
                    <td className="px-3 py-3.5 text-center">{renderCell(row.internal)}</td>
                    <td className="px-3 py-3.5 text-center">{renderCell(row.freelance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-center gap-6 mt-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" /> Inclus</div>
          <div className="flex items-center gap-1.5"><Minus className="w-3.5 h-3.5 text-amber-500" /> Partiel</div>
          <div className="flex items-center gap-1.5"><X className="w-3.5 h-3.5 text-red-500" /> Non disponible</div>
        </div>
      </div>
    </section>
  );
};
