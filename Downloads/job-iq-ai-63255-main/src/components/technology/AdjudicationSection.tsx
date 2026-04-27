import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const EXAMPLE_EXPERTS = [
  { label: "Expert A", correctness: 4.0, safety: 2.0, reasoning: "Dosage correct mais absence de mise en garde..." },
  { label: "Expert B", correctness: 4.5, safety: 1.5, reasoning: "Information exacte mais potentiellement dangereuse sans..." },
  { label: "Expert C", correctness: 3.0, safety: 4.0, reasoning: "Réponse prudente mais incomplète sur le dosage..." },
];

function ScoreBar({ value, max = 5, color }: { value: number; max?: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${(value / max) * 100}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <span className="text-xs font-mono" style={{ color }}>{value.toFixed(1)}</span>
    </div>
  );
}

function scoreColor(v: number) {
  if (v >= 4) return "#22C55E";
  if (v >= 2.5) return "#F59E0B";
  return "#EF4444";
}

function AdjudicationDiagram() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <div ref={ref} className="max-w-[1100px] mx-auto px-4 py-8">
      <div className="flex flex-col items-center gap-8">
        {/* Experts row */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 w-full">
          {EXAMPLE_EXPERTS.map((expert, i) => (
            <motion.div
              key={expert.label}
              className="flex-1 max-w-[240px] p-4 rounded-xl border border-white/[0.08] bg-white/[0.02]"
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.15, duration: 0.5 }}
            >
              <span className="text-xs font-semibold text-white/40 mb-3 block">{expert.label}</span>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white/30">correctness</span>
                  <ScoreBar value={expert.correctness} color={scoreColor(expert.correctness)} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white/30">safety</span>
                  <ScoreBar value={expert.safety} color={scoreColor(expert.safety)} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Convergence arrows */}
        <motion.div
          className="flex flex-col items-center gap-1"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.6 }}
        >
          <div className="w-[1px] h-6 bg-white/10" />
          <div className="w-2 h-2 rounded-full bg-primary/60" />
          <div className="w-[1px] h-6 bg-white/10" />
        </motion.div>

        {/* Adjudicator result */}
        <motion.div
          className="p-5 rounded-xl border border-primary/20 bg-primary/[0.04] max-w-[400px] w-full"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-white/60">Adjudication</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#F59E0B]/10 text-[#F59E0B]">
              α = 0.72
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/30">correctness</span>
              <ScoreBar value={4.0} color="#22C55E" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/30">safety</span>
              <ScoreBar value={2.0} color="#EF4444" />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-white/[0.06]">
            <p className="text-[11px] text-[#EF4444]/80 font-mono">
              → Flag review humain : désaccord significatif sur safety
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export function AdjudicationSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <div className="py-24 sm:py-32 border-t border-white/[0.04]" ref={ref}>
      <div className="max-w-[800px] mx-auto px-4 mb-16">
        <motion.h2
          className="text-[28px] font-bold text-white/90 mb-3"
          initial={{ opacity: 0, y: 15 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
        >
          Aucune annotation n'est acceptée sur la foi d'un seul jugement
        </motion.h2>
        <motion.p
          className="text-base text-white/40"
          initial={{ opacity: 0, y: 15 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.1 }}
        >
          Deux experts minimum. Vérification croisée automatique.
        </motion.p>
      </div>

      <AdjudicationDiagram />

      <div className="max-w-[800px] mx-auto px-4 mt-16">
        <div className="grid sm:grid-cols-2 gap-8">
          <div>
            <h3 className="text-base font-semibold text-white/80 mb-3">Quand les experts sont d'accord</h3>
            <p className="text-[15px] leading-[1.7] text-white/50">
              Si les annotations convergent — mêmes scores à ±1 point, même verdict — le système
              valide automatiquement. Le coût est minimal, la vitesse maximale.
            </p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-white/80 mb-3">Quand les experts divergent</h3>
            <p className="text-[15px] leading-[1.7] text-white/50">
              En cas de désaccord significatif, un modèle adjudicateur analyse les raisonnements de chaque expert.
              Il ne fait pas la moyenne — il évalue quel raisonnement est le plus solide et produit une annotation
              finale justifiée. Les items avec un désaccord persistant sont escaladés pour review humain.
            </p>
          </div>
        </div>

        {/* Concrete example */}
        <div className="mt-12 p-5 rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-x-auto">
          <p className="text-xs font-semibold text-white/30 mb-4 uppercase tracking-wider">
            Exemple concret — Évaluation d'une réponse médicale
          </p>
          <pre className="text-[12px] sm:text-[13px] font-mono text-white/50 whitespace-pre leading-relaxed">
{`Expert A  →  correctness: `}<span className="text-[#22C55E]">4.0</span>{`  |  safety: `}<span className="text-[#EF4444]">2.0</span>{`  |  "Dosage correct mais
                                                    absence de mise en garde..."
Expert B  →  correctness: `}<span className="text-[#22C55E]">4.5</span>{`  |  safety: `}<span className="text-[#EF4444]">1.5</span>{`  |  "Information exacte mais
                                                    potentiellement dangereuse sans..."
Expert C  →  correctness: `}<span className="text-[#F59E0B]">3.0</span>{`  |  safety: `}<span className="text-[#22C55E]">4.0</span>{`  |  "Réponse prudente mais
                                                    incomplète sur le dosage..."

Adjudication → correctness: `}<span className="text-[#22C55E]">4.0</span>{`  |  safety: `}<span className="text-[#EF4444]">2.0</span>{`  |  α = `}<span className="text-[#F59E0B]">0.72</span>{` → Flag review humain
               Motif : désaccord significatif sur la dimension safety`}</pre>
        </div>
      </div>
    </div>
  );
}
