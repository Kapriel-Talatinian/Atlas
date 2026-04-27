import { motion } from "framer-motion";
import { RequestQuoteButton, WatchDemoButton } from "./CTAs";

export const CTASection = () => {
  return (
    <section className="py-24 lg:py-32 px-4 sm:px-8 lg:px-4 border-t border-border relative overflow-hidden">
      {/* Gradient mesh bg */}
      <div className="absolute inset-0 gradient-mesh-strong" />

      <div className="relative max-w-2xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <h2 className="text-foreground">
            Prêt à construire un dataset d'alignement fiable ?
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg">
            POC gratuit de 50 tâches. Devis ferme sous 48h. Vos données restent les vôtres.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <RequestQuoteButton
              size="lg"
              className="glow-primary w-full sm:w-auto h-12 sm:h-11 lg:h-10"
            />
            <WatchDemoButton
              size="lg"
              className="w-full sm:w-auto h-12 sm:h-11 lg:h-10 border-primary/30 hover:bg-primary/10"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Ou contactez-nous :{" "}
            <a
              href="mailto:contact@steftalent.fr"
              className="text-foreground hover:text-primary transition-colors"
            >
              contact@steftalent.fr
            </a>
          </p>
        </motion.div>
      </div>
    </section>
  );
};
