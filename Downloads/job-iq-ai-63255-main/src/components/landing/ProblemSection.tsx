import { motion, useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { AlphaBadge } from "./AlphaBadge";

const dimensions = [
  { name: "Correctness", value: 4.2 },
  { name: "Safety", value: 3.8 },
  { name: "Completeness", value: 3.5 },
  { name: "Reasoning", value: 4.0 },
  { name: "Source reliability", value: 3.2 },
  { name: "Communication", value: 4.5 },
];

const AnimatedScore = ({ value, delay }: { value: number; delay: number }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const timeout = setTimeout(() => {
      const start = performance.now();
      const duration = 800;
      const animate = (now: number) => {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        setDisplay(parseFloat((eased * value).toFixed(1)));
        if (t < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }, delay * 1000);
    return () => clearTimeout(timeout);
  }, [inView, value, delay]);

  return <span ref={ref} className="font-mono text-sm text-muted-foreground">{display.toFixed(1)}</span>;
};

const ScoreBar = ({ name, value, delay }: { name: string; value: number; delay: number }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });

  const color =
    value >= 3.5
      ? "hsl(142 71% 45%)"
      : value >= 2.0
        ? "hsl(38 92% 50%)"
        : "hsl(0 72% 51%)";

  return (
    <div ref={ref} className="space-y-1.5">
      <div className="flex justify-between items-baseline">
        <span className="text-[13px] text-muted-foreground">{name}</span>
        <AnimatedScore value={value} delay={delay} />
      </div>
      <div className="h-2 rounded-full bg-border overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, hsl(var(--primary)), ${color})` }}
          initial={{ width: 0 }}
          animate={inView ? { width: `${(value / 5) * 100}%` } : {}}
          transition={{ duration: 0.8, delay, ease: "easeOut" }}
        />
      </div>
    </div>
  );
};

export const ProblemSection = () => {
  return (
    <section className="py-24 lg:py-32 px-4 sm:px-8 lg:px-4">
      <div className="max-w-6xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-foreground text-center mb-16"
        >
          Un label ne vous dit rien.
        </motion.h2>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-8 items-start">
          {/* Left — Crowd-sourcing */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="relative rounded-xl bg-card p-6 sm:p-8 opacity-60 blur-[0.5px] border border-border">
              <div className="text-[13px] text-muted-foreground uppercase tracking-[0.15em] mb-6">
                Crowd-sourcing classique
              </div>

              <div className="space-y-3 text-[13px] text-muted-foreground/70">
                <p>3 annotateurs anonymes</p>
                <p>Aucune certification vérifiée</p>
                <p>Accord inter-annotateurs : ~63%</p>
                <p>Pas de mesure de fiabilité</p>
              </div>

              <div className="my-8 flex justify-center">
                <div className="inline-flex items-center gap-1.5 bg-muted/50 text-muted-foreground/50 text-sm px-4 py-2 rounded-full font-mono">
                  "Bonne réponse" 👍
                </div>
              </div>

              <div className="space-y-2 text-[13px] text-muted-foreground/50">
                <p>Format : CSV brut</p>
                <p>Aucune traçabilité</p>
              </div>

              <div className="absolute -bottom-3 -right-3 bg-destructive/10 text-destructive text-[11px] font-mono px-3 py-1 rounded-full border border-destructive/20 hidden md:block">
                Inutilisable
              </div>
            </div>
          </motion.div>

          {/* Right — STEF */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="rounded-xl bg-card p-6 sm:p-8 border-l-[3px] border-primary border-t border-r border-b border-t-border border-r-border border-b-border hover:border-t-primary/20 hover:border-r-primary/20 hover:border-b-primary/20 transition-colors">
              <div className="text-[13px] text-muted-foreground uppercase tracking-[0.15em] mb-6">
                Annotation STEF
              </div>

              <div className="space-y-3 text-[13px] text-foreground/80 mb-6">
                <p>2–3 experts certifiés par domaine</p>
                <p>Certification 3 phases vérifiée</p>
                <p>Adjudication multi-modèle</p>
              </div>

              {/* Alpha badge */}
              <div className="flex justify-center my-6">
                <AlphaBadge value={0.87} size="md" animated />
              </div>

              {/* Score bars */}
              <div className="space-y-3 mb-6">
                {dimensions.map((d, i) => (
                  <ScoreBar key={d.name} name={d.name} value={d.value} delay={0.3 + i * 0.1} />
                ))}
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-border space-y-2">
                <p className="text-[12px] text-muted-foreground">
                  Export : JSONL · Parquet · HuggingFace
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-[11px] font-mono bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">
                    Format DPO-ready
                  </span>
                  <span className="text-[12px] text-muted-foreground">
                    Chaque datapoint traçable
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
