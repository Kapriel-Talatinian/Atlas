import { motion } from "framer-motion";
import { Stethoscope, Scale, TrendingUp, Code } from "lucide-react";

const domains = [
  {
    icon: Stethoscope,
    name: "Médecine",
    req: "Médecins, pharmaciens et IDE seniors certifiés",
    status: "120 experts actifs",
  },
  {
    icon: Scale,
    name: "Droit",
    req: "Avocats, juristes d'entreprise et fiscalistes",
    status: "80 experts actifs",
  },
  {
    icon: TrendingUp,
    name: "Finance",
    req: "Analystes, auditeurs CAC et risk managers",
    status: "95 experts actifs",
  },
  {
    icon: Code,
    name: "Code",
    req: "Développeurs seniors 5+ ans, dont 30% en sécurité",
    status: "140 experts actifs",
  },
];

export const DomainsSection = () => {
  return (
    <section className="py-24 lg:py-32 px-4 sm:px-8 lg:px-4 border-t border-border">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-foreground mb-4">Des experts, pas des crowd workers.</h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Chaque annotateur passe un assessment de certification spécifique à son domaine.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {domains.map((d, i) => (
            <motion.div
              key={d.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="rounded-xl border border-border bg-card p-6 hover:border-primary/20 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <d.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-foreground text-base mb-2">{d.name}</h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">{d.req}</p>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] text-muted-foreground font-mono">{d.status}</span>
              </div>
              <div className="mt-3 text-[10px] text-muted-foreground/60 font-mono border border-border rounded-md px-2 py-0.5 w-fit">
                Certification requise
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
