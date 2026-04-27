import { ShieldCheck, FileText, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const COMPLIANCE = [
  { label: "RGPD" },
  { label: "AI Act art. 11" },
  { label: "ISO 27001-ready" },
  { label: "DPA signable" },
];

export const NDABanner = () => {
  return (
    <section className="border-y border-border/60 bg-muted/20 py-8 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-foreground text-sm font-medium leading-snug">
              3 case studies anonymisés disponibles sur demande
            </p>
            <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
              Métriques détaillées (alpha par dimension, délais, coûts) sur projets réels — labs IA, fintech, secteur public.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            {COMPLIANCE.map((c, i) => (
              <span key={c.label} className="flex items-center gap-2">
                {i > 0 && <span className="text-border">·</span>}
                <span>{c.label}</span>
              </span>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            asChild
            className="border-primary/30 hover:bg-primary/10 whitespace-nowrap"
          >
            <a href="mailto:contact@steftalent.fr?subject=Demande%20case%20studies%20STEF&body=Bonjour%2C%0A%0AJe%20souhaite%20recevoir%20les%203%20case%20studies%20anonymis%C3%A9s.%0A%0AContexte%20%3A%20%5Bpr%C3%A9cisez%20votre%20domaine%20et%20volume%5D%0A%0AMerci.">
              Recevoir les case studies
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
};
