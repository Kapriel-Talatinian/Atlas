import { motion } from "framer-motion";
import { Shield, BarChart3, Search, AlertTriangle } from "lucide-react";

const tasks = [
  {
    icon: AlertTriangle,
    title: "Red-teaming",
    desc: "Nos experts tentent de faire échouer votre modèle. Hallucinations, biais, failles de sécurité. Chaque vulnérabilité est documentée.",
  },
  {
    icon: BarChart3,
    title: "Préférences DPO",
    desc: "Comparaison pairée de réponses. Le format exact pour Direct Preference Optimization. Prêt à l'emploi.",
  },
  {
    icon: Search,
    title: "Scoring multi-dimensionnel",
    desc: "Chaque réponse évaluée sur 10 axes indépendants. Correction, sécurité, raisonnement, edge cases. Pas un score. Un profil.",
  },
  {
    icon: Shield,
    title: "Vérification factuelle",
    desc: "Vos réponses sont-elles vraies ? Nos experts vérifient, sourcent, et classifient. Vrai. Partiellement vrai. Faux. Invérifiable.",
  },
];

export const TaskTypesSection = () => {
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
          <h2 className="text-foreground mb-4">Alignement complet.</h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Quatre types de tâches pour couvrir l'ensemble de votre pipeline d'entraînement.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {tasks.map((t, i) => (
            <motion.div
              key={t.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="rounded-xl border border-border bg-card p-6 sm:p-8 hover:border-primary/20 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                <t.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-foreground mb-3">{t.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
