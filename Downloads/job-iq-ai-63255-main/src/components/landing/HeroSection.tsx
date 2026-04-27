import { motion } from "framer-motion";
import { FlaskConical, Building2, Landmark } from "lucide-react";
import { LiveDataGrid } from "./LiveDataGrid";
import { RequestQuoteButton, WatchDemoButton } from "./CTAs";

const wordVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.4, ease: "easeOut" as const },
  }),
};

const TITLE_WORDS = "Vos modèles IA méritent des données d'alignement vérifiées.".split(" ");

const CASE_STUDIES = [
  {
    Icon: FlaskConical,
    label: "Lab IA · UE",
    metric: "12k datapoints · α 0.89 · J+4",
  },
  {
    Icon: Building2,
    label: "FinTech · Série B",
    metric: "Red-teaming · 2k tâches · α 0.91",
  },
  {
    Icon: Landmark,
    label: "GovTech · UE",
    metric: "DPO médical · 5k pairs · α 0.87",
  },
];

export const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center pt-20 pb-16 px-4 sm:px-8 lg:px-4 overflow-hidden">
      {/* Background mesh */}
      <div className="absolute inset-0 gradient-mesh" />

      <div className="relative max-w-6xl mx-auto w-full">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Text */}
          <div className="space-y-7 text-center lg:text-left">
            <h1 className="text-foreground text-[28px] sm:text-[40px] lg:text-[clamp(32px,5vw,56px)] leading-[1.1] font-extrabold tracking-[-0.035em]">
              {TITLE_WORDS.map((word, i) => (
                <motion.span
                  key={i}
                  custom={i}
                  initial="hidden"
                  animate="visible"
                  variants={wordVariants}
                  className="inline-block mr-[0.3em]"
                >
                  {word}
                </motion.span>
              ))}
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-lg mx-auto lg:mx-0"
            >
              Des experts certifiés annotent vos données sur 10 dimensions.
              Chaque datapoint est validé mathématiquement avant d'entrer dans votre dataset.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.5 }}
              className="flex flex-col sm:flex-row gap-3 sm:justify-center lg:justify-start"
            >
              <RequestQuoteButton
                size="lg"
                className="w-full sm:w-auto h-12 sm:h-11 lg:h-10"
              />
              <WatchDemoButton
                size="lg"
                label="Voir la démo (2 min)"
                className="w-full sm:w-auto h-12 sm:h-11 lg:h-10 border-primary/30 hover:bg-primary/10"
              />
            </motion.div>

            {/* POC mention */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.85, duration: 0.5 }}
              className="text-[13px] text-muted-foreground"
            >
              <span className="text-foreground/80 font-medium">POC gratuit</span> · 50 tâches · sans engagement
            </motion.p>

            {/* Anonymized case studies */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.5 }}
              className="pt-4 space-y-2.5"
            >
              <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground/70">
                Déjà déployé chez
              </p>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                {CASE_STUDIES.map((c) => (
                  <div
                    key={c.label}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border bg-card/50 backdrop-blur-sm"
                  >
                    <c.Icon className="w-4 h-4 text-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-foreground truncate">{c.label}</p>
                      <p className="text-[11px] text-muted-foreground font-mono truncate">{c.metric}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Compliance trustline */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.15, duration: 0.5 }}
              className="flex flex-wrap items-center justify-center lg:justify-start gap-x-4 gap-y-1 text-[12px] text-muted-foreground/80 pt-2"
            >
              <span>UE · RGPD</span>
              <span className="text-border">·</span>
              <span className="font-mono">α ≥ 0.80</span>
              <span className="text-border">·</span>
              <span>AI Act art. 11</span>
            </motion.div>
          </div>

          {/* Visual — hidden on mobile/tablet */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6, duration: 0.7 }}
            className="hidden lg:flex justify-end"
          >
            <LiveDataGrid />
          </motion.div>
        </div>
      </div>
    </section>
  );
};
