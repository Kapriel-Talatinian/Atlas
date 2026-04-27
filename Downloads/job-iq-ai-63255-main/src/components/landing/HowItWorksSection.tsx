import { motion } from "framer-motion";
import { Upload, Users, ShieldCheck } from "lucide-react";

const steps = [
  {
    num: "01",
    icon: Upload,
    title: "Vous uploadez vos données",
    desc: "Vos prompts et réponses de modèle, en CSV, JSON ou via API. Le système valide, nettoie et anonymise automatiquement.",
  },
  {
    num: "02",
    icon: Users,
    title: "Nos experts annotent",
    desc: "Des experts certifiés évaluent chaque réponse sur 10 dimensions. Red-teaming. Préférences. Scoring. Vérification factuelle.",
  },
  {
    num: "03",
    icon: ShieldCheck,
    title: "Vous recevez un dataset vérifié",
    desc: "Chaque annotation est validée par adjudication multi-modèle. Seuls les datapoints avec α ≥ 0.80 entrent dans le livrable.",
  },
];

export const HowItWorksSection = () => {
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
          <h2 className="text-foreground mb-4">Du prompt brut au dataset certifié.</h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Trois étapes pour transformer vos données brutes en dataset d'entraînement fiable.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="group relative rounded-xl border border-border bg-card p-6 sm:p-8 hover:border-primary/20 transition-colors"
            >
              <span className="absolute top-6 right-6 font-mono text-4xl font-bold text-primary/10">
                {step.num}
              </span>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                <step.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-foreground mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
