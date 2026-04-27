import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Upload, ShieldCheck, GitBranch, Pen, Scale, Database } from "lucide-react";

const STEPS = [
  { icon: Upload, label: "Ingestion", color: "#7B6FF0" },
  { icon: ShieldCheck, label: "PII Scan", color: "#22C55E" },
  { icon: GitBranch, label: "Triage", color: "#F59E0B" },
  { icon: Pen, label: "Annotation", color: "#7B6FF0" },
  { icon: Scale, label: "Adjudication", color: "#3B82F6" },
  { icon: Database, label: "Dataset", color: "#22C55E" },
];

const DETAILS = [
  {
    num: "01",
    title: "Ingestion",
    text: "Les données arrivent en CSV, JSON ou JSONL, ou directement via l'API. Le système détecte automatiquement le format, valide le schéma, supprime les doublons et normalise l'encodage. Les fichiers contenant plus de 10% de lignes invalides sont rejetés avec un rapport d'erreurs détaillé.",
  },
  {
    num: "02",
    title: "Scan PII",
    text: "Avant toute annotation, chaque texte est scanné pour détecter les données personnelles identifiables. Noms, emails, numéros de téléphone, adresses, identifiants — tout est détecté et anonymisé automatiquement. Les données originales ne sont jamais exposées aux annotateurs.",
  },
  {
    num: "03",
    title: "Triage",
    text: "Chaque tâche est analysée et classée en trois niveaux de complexité. Les tâches simples sont traitées par un modèle rapide. Les tâches complexes mobilisent plusieurs modèles simultanément. Ce routage optimise le rapport coût-qualité de chaque annotation.",
    code: `Niveau 1 → 1 modèle    → auto-validation si confiance > 0.95
Niveau 2 → 2 modèles   → adjudication si désaccord
Niveau 3 → 3 modèles   → adjudication systématique`,
  },
  {
    num: "04",
    title: "Annotation",
    text: "Les experts certifiés annotent chaque tâche depuis zéro, sans pré-annotation. Chaque tâche est traitée par au minimum deux experts indépendants qui ne voient pas le travail de l'autre. L'annotation est guidée par un raisonnement obligatoire avant tout scoring — l'expert doit analyser avant de juger.",
  },
  {
    num: "05",
    title: "Adjudication",
    text: "Les annotations de chaque expert sont comparées par le système d'adjudication multi-modèle. Les concordances sont conservées. Les désaccords sont résolus par un modèle adjudicateur qui analyse les raisonnements de chaque expert et produit l'annotation finale.",
  },
  {
    num: "06",
    title: "Dataset",
    text: "Seuls les datapoints dont la fiabilité est mathématiquement vérifiée entrent dans le dataset final. Les données sont versionnées, exportables en JSONL, Parquet et au format HuggingFace, et accessibles via API en temps réel.",
  },
];

function PipelineDiagram() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <div ref={ref} className="max-w-[1100px] mx-auto px-4 py-8">
      {/* Desktop: horizontal */}
      <div className="hidden sm:block">
        <div className="relative flex items-center justify-between">
          {/* Connection line */}
          <motion.div
            className="absolute top-1/2 left-[40px] right-[40px] h-[1px] -translate-y-1/2"
            style={{ background: "linear-gradient(90deg, #7B6FF0 0%, #22C55E 100%)", opacity: 0.2, transformOrigin: "left" }}
            initial={{ scaleX: 0 }}
            animate={isInView ? { scaleX: 1 } : {}}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
          
          {/* Animated particles */}
          {isInView && [0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary"
              style={{ boxShadow: "0 0 8px hsl(248 80% 68%)" }}
              initial={{ left: "40px", opacity: 0 }}
              animate={{ left: "calc(100% - 40px)", opacity: [0, 1, 1, 0] }}
              transition={{
                duration: 3,
                delay: i * 1.2,
                repeat: Infinity,
                repeatDelay: 1.5,
                ease: "linear",
              }}
            />
          ))}

          {/* Nodes */}
          {STEPS.map((step, i) => (
            <motion.div
              key={step.label}
              className="relative z-10 flex flex-col items-center gap-2 group"
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.15, duration: 0.5 }}
            >
              <div
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl border border-white/[0.08] bg-[#0F0F12] flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:border-white/20"
                style={{ boxShadow: `0 0 20px ${step.color}10` }}
              >
                <step.icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: step.color }} />
              </div>
              <span className="text-[11px] sm:text-xs font-semibold text-white/60 group-hover:text-white/90 transition-colors">
                {step.label}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Mobile: vertical */}
      <div className="sm:hidden flex flex-col items-center gap-1">
        {STEPS.map((step, i) => (
          <div key={step.label}>
            <motion.div
              className="flex items-center gap-4"
              initial={{ opacity: 0, x: -10 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: i * 0.1, duration: 0.4 }}
            >
              <div
                className="w-12 h-12 rounded-xl border border-white/[0.08] bg-[#0F0F12] flex items-center justify-center flex-shrink-0"
                style={{ boxShadow: `0 0 20px ${step.color}10` }}
              >
                <step.icon className="w-5 h-5" style={{ color: step.color }} />
              </div>
              <span className="text-sm font-semibold text-white/60">{step.label}</span>
            </motion.div>
            {i < STEPS.length - 1 && (
              <div className="w-[1px] h-4 bg-white/[0.08] ml-6 my-1" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StepBlock({ num, title, text, code }: { num: string; title: string; text: string; code?: string; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      className="relative"
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: 0.05, duration: 0.5 }}
    >
      <span className="absolute -left-2 sm:left-0 top-0 text-[48px] sm:text-[56px] font-bold text-primary/[0.08] leading-none select-none pointer-events-none">
        {num}
      </span>
      <div className="pl-12 sm:pl-16">
        <h3 className="text-lg font-semibold text-white/90 mb-2">{title}</h3>
        <p className="text-[15px] leading-[1.7] text-white/50">{text}</p>
        {code && (
          <pre className="mt-4 p-4 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[13px] font-mono text-white/60 overflow-x-auto">
            {code}
          </pre>
        )}
      </div>
    </motion.div>
  );
}

export function PipelineSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <div className="py-24 sm:py-32" ref={ref}>
      <div className="max-w-[800px] mx-auto px-4 mb-16">
        <motion.h2
          className="text-[22px] sm:text-[28px] font-bold text-white/90 mb-3"
          initial={{ opacity: 0, y: 15 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          Du prompt brut au datapoint certifié
        </motion.h2>
        <motion.p
          className="text-base text-white/40"
          initial={{ opacity: 0, y: 15 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          Six étapes. Aucun raccourci.
        </motion.p>
      </div>

      <PipelineDiagram />

      <div className="max-w-[800px] mx-auto px-4 mt-20 space-y-16">
        {DETAILS.map((d, i) => (
          <StepBlock key={d.num} {...d} index={i} />
        ))}
      </div>
    </div>
  );
}
