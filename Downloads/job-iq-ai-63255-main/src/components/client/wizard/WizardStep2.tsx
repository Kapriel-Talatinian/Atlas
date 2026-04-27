import { useState } from "react";
import type { WizardData } from "@/pages/client/NewProjectWizard";
import { cn } from "@/lib/utils";
import { Check, ArrowUpDown, BarChart3, LayoutGrid, ShieldAlert, BadgeCheck, PenSquare, MousePointerClick, Table2, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const TASK_TYPES = [
  { key: "ranking", label: "Ranking / DPO", icon: ArrowUpDown, desc: "Comparez deux réponses et choisissez la meilleure. Format DPO-ready.", popular: true,
    detail: "L'expert compare deux réponses au même prompt et choisit laquelle est meilleure, avec une justification détaillée. Les données produites sont directement utilisables pour l'alignement DPO.",
    format: "Vous devrez fournir un prompt et deux réponses par tâche.",
    useCase: "Alignement DPO, reward modeling, Constitutional AI." },
  { key: "rating", label: "Scoring multi-dimensionnel", icon: BarChart3, desc: "Évaluez une réponse sur plusieurs dimensions indépendantes (0-5).", popular: true,
    detail: "L'expert rédige un raisonnement global puis évalue chaque dimension sur une échelle de 0 à 5. La méthodologie 'reason-first' réduit les biais cognitifs.",
    format: "Vous devrez fournir un prompt et une réponse par tâche.",
    useCase: "Évaluation qualité, détection de faiblesses par dimension, benchmarking." },
  { key: "comparison", label: "Comparaison A/B", icon: LayoutGrid, desc: "Scorez deux réponses indépendamment puis donnez votre préférence.",
    detail: "Variante enrichie du ranking : l'expert score les deux réponses sur chaque dimension, puis donne sa préférence globale. Produit des données plus riches que le simple DPO.",
    format: "Vous devrez fournir un prompt et deux réponses par tâche.",
    useCase: "Comparaison fine de modèles, analyse par dimension." },
  { key: "red_teaming", label: "Red-teaming", icon: ShieldAlert, desc: "Testez les limites de votre modèle. Hallucinations, biais, failles.",
    detail: "Les experts tentent activement de faire échouer votre modèle en cherchant hallucinations, biais et failles de sécurité. C'est le type le plus exigeant.",
    format: "Chat en direct avec votre modèle ou revue de réponses pré-générées.",
    useCase: "Safety testing, adversarial evaluation, compliance." },
  { key: "validation", label: "Vérification factuelle", icon: BadgeCheck, desc: "Vérifiez si les affirmations de votre modèle sont factuellement correctes.",
    detail: "L'expert vérifie chaque affirmation, fournit des sources et rédige une correction si nécessaire. Verdicts : Vrai, Partiellement vrai, Faux, Invérifiable.",
    format: "Vous devrez fournir une affirmation (et optionnellement un prompt et un contexte).",
    useCase: "Grounding, réduction des hallucinations, fact-checking." },
  { key: "text_generation", label: "Génération de texte", icon: PenSquare, desc: "Faites écrire ou réécrire des réponses gold par des experts.",
    detail: "L'expert écrit la réponse idéale au prompt donné, ou améliore une réponse existante. Produit des données SFT (Supervised Fine-Tuning).",
    format: "Vous devrez fournir un prompt (et optionnellement une réponse à améliorer).",
    useCase: "Fine-tuning supervisé, création de golden datasets." },
  { key: "span_annotation", label: "Annotation de spans", icon: MousePointerClick, desc: "Marquez et labellisez des portions spécifiques de texte.",
    detail: "L'expert sélectionne des portions de texte et leur assigne un label. Utilisé pour identifier erreurs, entités ou éléments de raisonnement.",
    format: "Vous devrez fournir un texte à annoter et un jeu de labels.",
    useCase: "NER, détection d'erreurs, analyse de raisonnement." },
  { key: "extraction", label: "Extraction", icon: Table2, desc: "Extrayez des données structurées depuis du texte libre.",
    detail: "L'expert extrait des informations structurées selon un schéma que vous définissez. Le formulaire d'extraction est généré dynamiquement.",
    format: "Vous devrez fournir un texte source et un schéma d'extraction.",
    useCase: "NER avancé, slot filling, extraction d'informations médicales/juridiques." },
  { key: "conversation_rating", label: "Notation de conversation", icon: MessageSquare, desc: "Évaluez un dialogue multi-tours, tour par tour et globalement.",
    detail: "L'expert évalue chaque tour d'assistant indépendamment puis donne une note globale. Mesure la cohérence sur l'ensemble de la conversation.",
    format: "Vous devrez fournir un historique de conversation (messages user + assistant).",
    useCase: "Évaluation de chatbots, assistants, agents conversationnels." },
];

interface Props {
  data: WizardData;
  update: (partial: Partial<WizardData>) => void;
}

export function WizardStep2({ data, update }: Props) {
  const selected = TASK_TYPES.find((t) => t.key === data.taskType);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-1">Quel type d'annotation ?</h2>
        <p className="text-sm text-muted-foreground">Choisissez le format d'annotation le plus adapté à votre objectif.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {TASK_TYPES.map((t) => {
          const isSelected = data.taskType === t.key;
          return (
            <button
              key={t.key}
              onClick={() => update({ taskType: t.key })}
              className={cn(
                "relative text-left p-4 rounded-xl border transition-all duration-150",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/30 bg-card"
              )}
            >
              {isSelected && (
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary-foreground" />
                </div>
              )}
              {t.popular && !isSelected && (
                <span className="absolute top-2.5 right-2.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                  Populaire
                </span>
              )}
              <t.icon className="w-5 h-5 text-muted-foreground mb-2" />
              <p className="text-sm font-semibold text-foreground leading-tight">{t.label}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{t.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Detail panel */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-5 rounded-xl border border-border bg-card space-y-3">
              <p className="text-sm text-foreground leading-relaxed">{selected.detail}</p>
              <div className="flex flex-col sm:flex-row gap-4 text-xs text-muted-foreground">
                <div>
                  <span className="font-semibold text-foreground/70 block mb-0.5">Format de données</span>
                  {selected.format}
                </div>
                <div>
                  <span className="font-semibold text-foreground/70 block mb-0.5">Cas d'usage</span>
                  {selected.useCase}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
