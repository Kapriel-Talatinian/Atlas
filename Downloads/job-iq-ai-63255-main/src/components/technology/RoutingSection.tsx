import { useRef, useState, useEffect } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";

const LEVELS = [
  { level: 1, models: 1, condition: "Confiance > 0.95", usage: "QCM, scoring simple", color: "#22C55E" },
  { level: 2, models: 2, condition: "Accord entre modèles", usage: "Code review, fact-checking", color: "#F59E0B" },
  { level: 3, models: 3, condition: "Adjudication systématique", usage: "Red-teaming, médical, juridique", color: "#EF4444" },
];

function RoutingDiagram() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [activeLevel, setActiveLevel] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const interval = setInterval(() => {
      setActiveLevel((prev) => (prev + 1) % 3);
    }, 3000);
    return () => clearInterval(interval);
  }, [isInView]);

  return (
    <div ref={ref} className="max-w-[1100px] mx-auto px-4 py-8">
      <div className="relative flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16">
        {/* Task dot */}
        <motion.div
          className="flex flex-col items-center gap-2"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5 }}
        >
          <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-primary" style={{ boxShadow: "0 0 12px hsl(248 80% 68%)" }} />
          </div>
          <span className="text-[11px] font-semibold text-white/50">Tâche</span>
        </motion.div>

        {/* Triage box */}
        <motion.div
          className="flex flex-col items-center gap-2"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <div className="px-5 py-3 rounded-lg border border-white/[0.1] bg-white/[0.03]">
            <span className="text-sm font-semibold text-white/70">Triage</span>
          </div>
        </motion.div>

        {/* Levels */}
        <div className="flex flex-col gap-4">
          {LEVELS.map((lvl, i) => (
            <motion.div
              key={lvl.level}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all duration-500 ${
                activeLevel === i
                  ? "border-white/20 bg-white/[0.05]"
                  : "border-white/[0.06] bg-transparent"
              }`}
              initial={{ opacity: 0, x: 20 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
            >
              <span className="text-xs font-mono text-white/40 w-16">Niveau {lvl.level}</span>
              <div className="flex gap-1.5">
                {Array.from({ length: lvl.models }).map((_, j) => (
                  <motion.div
                    key={j}
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: lvl.color, opacity: activeLevel === i ? 1 : 0.2 }}
                    animate={activeLevel === i ? { scale: [1, 1.2, 1] } : {}}
                    transition={{ delay: j * 0.15, duration: 0.6 }}
                  />
                ))}
              </div>
              <span className="text-[11px] text-white/40 hidden sm:inline">→</span>
              <span className="text-[11px] text-white/50 hidden sm:inline">{lvl.condition}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Animated indicator */}
      <div className="flex justify-center mt-4 gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
              activeLevel === i ? "bg-white/60 w-4" : "bg-white/15"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export function RoutingSection() {
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
          Chaque tâche au bon niveau de vérification
        </motion.h2>
        <motion.p
          className="text-base text-white/40"
          initial={{ opacity: 0, y: 15 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.1 }}
        >
          Pas de sur-traitement. Pas de sous-traitement.
        </motion.p>
      </div>

      <RoutingDiagram />

      <div className="max-w-[800px] mx-auto px-4 mt-16 space-y-6">
        <p className="text-[15px] leading-[1.7] text-white/50">
          Le moteur de triage analyse chaque tâche avant de la distribuer. Un QCM simple ne nécessite pas
          le même niveau de vérification qu'une code review de 200 lignes ou qu'un red-teaming sur un modèle médical.
        </p>
        <p className="text-[15px] leading-[1.7] text-white/50">
          Le routage est automatique. Les tâches touchant à la sécurité ou au domaine médical sont
          systématiquement routées au niveau 3, indépendamment de leur complexité apparente.
        </p>

        {/* Table */}
        <div className="mt-10 overflow-x-auto">
          <table className="w-full text-[13px] font-mono">
            <thead>
              <tr className="border-b border-white/[0.08]">
                <th className="text-left py-3 px-3 text-white/40 font-medium">Niveau</th>
                <th className="text-left py-3 px-3 text-white/40 font-medium">Modèles</th>
                <th className="text-left py-3 px-3 text-white/40 font-medium">Condition de validation</th>
                <th className="text-left py-3 px-3 text-white/40 font-medium">Cas d'usage typique</th>
              </tr>
            </thead>
            <tbody>
              {LEVELS.map((lvl) => (
                <tr key={lvl.level} className="border-b border-white/[0.04]">
                  <td className="py-3 px-3 text-white/60">{lvl.level}</td>
                  <td className="py-3 px-3 text-white/60">{lvl.models}</td>
                  <td className="py-3 px-3 text-white/60">{lvl.condition}</td>
                  <td className="py-3 px-3 text-white/60">{lvl.usage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
