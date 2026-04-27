import { motion } from "framer-motion";
import { AlphaBadge } from "./AlphaBadge";

const points = [
  "Chaque annotation est produite par au minimum 2 experts indépendants.",
  "L'accord inter-annotateurs est mesuré par Krippendorff's Alpha, la référence en sciences de l'annotation.",
  "Seuls les datapoints avec α ≥ 0.80 entrent dans votre dataset.",
  "Si l'accord est insuffisant, la tâche est automatiquement réassignée.",
];

export const QualitySection = () => {
  return (
    <section className="py-24 lg:py-32 px-4 sm:px-8 lg:px-4 border-t border-border">
      <div className="max-w-5xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-foreground text-center mb-16"
        >
          La fiabilité n'est pas une promesse. C'est un chiffre.
        </motion.h2>

        {/* Mobile / tablet: stacked layout */}
        <div className="flex flex-col items-center md:hidden">
          <AlphaBadge value={0.84} size="lg" animated />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-10">
            {points.map((text, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="text-sm text-muted-foreground leading-relaxed border-l-2 border-primary/20 pl-4"
              >
                {text}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Desktop: 3-column layout */}
        <div className="hidden md:grid md:grid-cols-[1fr_auto_1fr] gap-12 items-center">
          {/* Left points */}
          <div className="space-y-6">
            {points.slice(0, 2).map((text, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="text-sm text-muted-foreground leading-relaxed border-l-2 border-primary/20 pl-4"
              >
                {text}
              </motion.div>
            ))}
          </div>

          {/* Center badge */}
          <div className="flex justify-center">
            <AlphaBadge value={0.84} size="lg" animated />
          </div>

          {/* Right points */}
          <div className="space-y-6">
            {points.slice(2).map((text, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="text-sm text-muted-foreground leading-relaxed border-l-2 border-success/20 pl-4"
              >
                {text}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
