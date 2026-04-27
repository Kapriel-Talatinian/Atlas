import { useEffect, useState, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface DataPoint {
  id: number;
  prompt: string;
  status: "incoming" | "annotating" | "qa" | "validated" | "flagged";
  scores: number[];
  alpha: number;
  expert: number;
  progress: number;
}

const PROMPTS = [
  "Effets secondaires du paracétamol",
  "Clause de non-concurrence",
  "Analyse du ratio de Sharpe",
  "Refactoring d'un singleton",
  "Diagnostic de l'hypertension",
  "Interprétation du RGPD art. 17",
  "Calcul de la VAR Monte Carlo",
  "Optimisation d'une requête SQL",
];

const STATUS_COLORS: Record<string, string> = {
  incoming: "bg-muted-foreground/30",
  annotating: "bg-primary/60",
  qa: "bg-[hsl(38,92%,50%)]/60",
  validated: "bg-success/60",
  flagged: "bg-destructive/50",
};

const STATUS_LABELS: Record<string, string> = {
  incoming: "En attente",
  annotating: "Annotation",
  qa: "QA",
  validated: "Validé",
  flagged: "Flaggé",
};

const MiniBar = memo(({ value, delay }: { value: number; delay: number }) => (
  <motion.div className="h-[3px] rounded-full bg-border overflow-hidden flex-1">
    <motion.div
      className="h-full rounded-full"
      style={{
        background: value >= 3.5
          ? "hsl(142 71% 45%)"
          : value >= 2
          ? "hsl(38 92% 50%)"
          : "hsl(0 72% 51%)",
      }}
      initial={{ width: 0 }}
      animate={{ width: `${(value / 5) * 100}%` }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
    />
  </motion.div>
));
MiniBar.displayName = "MiniBar";

const DataCard = memo(({ point }: { point: DataPoint }) => (
  <motion.div
    layout
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.9 }}
    transition={{ duration: 0.4 }}
    className="rounded-lg border border-border bg-card p-3 space-y-2 hover:border-primary/30 transition-colors"
  >
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-muted-foreground truncate flex-1 font-mono">
        {point.prompt}
      </span>
      <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${STATUS_COLORS[point.status]}`} />
    </div>
    <div className="flex gap-[3px] items-center">
      {point.scores.map((s, i) => (
        <MiniBar key={i} value={s} delay={i * 0.05} />
      ))}
    </div>
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-muted-foreground">{STATUS_LABELS[point.status]}</span>
      {point.status === "validated" && (
        <span className="text-[10px] font-mono text-success">
          α {point.alpha.toFixed(2)}
        </span>
      )}
    </div>
  </motion.div>
));
DataCard.displayName = "DataCard";

export const LiveDataGrid = () => {
  const [points, setPoints] = useState<DataPoint[]>([]);
  const [nextId, setNextId] = useState(0);

  const generateScores = useCallback(() => {
    return Array.from({ length: 4 }, () => Math.round((1 + Math.random() * 4) * 10) / 10);
  }, []);

  useEffect(() => {
    const initial: DataPoint[] = Array.from({ length: 6 }, (_, i) => ({
      id: i,
      prompt: PROMPTS[i % PROMPTS.length],
      status: (["validated", "annotating", "qa", "validated", "incoming", "annotating"] as const)[i],
      scores: Array.from({ length: 4 }, () => Math.round((1 + Math.random() * 4) * 10) / 10),
      alpha: 0.75 + Math.random() * 0.15,
      expert: Math.floor(Math.random() * 5) + 1,
      progress: Math.random(),
    }));
    setPoints(initial);
    setNextId(6);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPoints((prev) => {
        const updated = prev.map((p) => {
          if (p.status === "incoming" && Math.random() > 0.5) {
            return { ...p, status: "annotating" as const };
          }
          if (p.status === "annotating" && Math.random() > 0.6) {
            return { ...p, status: "qa" as const };
          }
          if (p.status === "qa" && Math.random() > 0.5) {
            const alpha = 0.65 + Math.random() * 0.25;
            return {
              ...p,
              status: alpha >= 0.8 ? ("validated" as const) : ("flagged" as const),
              alpha,
            };
          }
          return p;
        });

        const active = updated.filter(
          (p) => p.status !== "validated" && p.status !== "flagged"
        );
        const done = updated.filter(
          (p) => p.status === "validated" || p.status === "flagged"
        );

        if (done.length > 3) {
          const keep = done.slice(-3);
          setNextId((id) => {
            const newPoint: DataPoint = {
              id: id,
              prompt: PROMPTS[id % PROMPTS.length],
              status: "incoming",
              scores: generateScores(),
              alpha: 0,
              expert: Math.floor(Math.random() * 5) + 1,
              progress: 0,
            };
            return id + 1;
          });
          return [...active, ...keep];
        }

        return updated;
      });

      if (Math.random() > 0.7) {
        setNextId((id) => {
          setPoints((prev) => {
            if (prev.length >= 8) return prev;
            return [
              ...prev,
              {
                id,
                prompt: PROMPTS[id % PROMPTS.length],
                status: "incoming" as const,
                scores: generateScores(),
                alpha: 0,
                expert: Math.floor(Math.random() * 5) + 1,
                progress: 0,
              },
            ];
          });
          return id + 1;
        });
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [generateScores]);

  return (
    <div className="relative w-full max-w-md">
      <div className="absolute inset-0 rounded-xl bg-primary/5 blur-3xl" />
      <div className="relative grid grid-cols-2 gap-2.5">
        <AnimatePresence mode="popLayout">
          {points.slice(0, 6).map((point) => (
            <DataCard key={point.id} point={point} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
