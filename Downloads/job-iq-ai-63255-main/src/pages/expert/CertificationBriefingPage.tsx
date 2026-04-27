import { useParams, useNavigate, Link } from "react-router-dom";
import { ExpertDashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Stethoscope, Scale, TrendingUp, Code2, GraduationCap, Search,
  ClipboardCheck, ChevronRight, Clock, Zap, ShieldAlert, FileText, Layers, Shield
} from "lucide-react";
import { motion } from "framer-motion";

const domainData: Record<string, {
  label: string;
  icon: any;
  color: string;
  description: string;
  validates: string;
  outcome: string;
  prerequisites: string;
  phases: { title: string; badge: string; duration: string; icon: any; description: string; evaluated: string; threshold: string; tip: string }[];
}> = {
  medical: {
    label: "Médecine",
    icon: Stethoscope,
    color: "#3B82F6",
    description: "Cette certification vérifie votre capacité à évaluer des réponses générées par des modèles d'intelligence artificielle dans le domaine médical. Vous serez testé sur votre aptitude à identifier des erreurs factuelles, à juger la sécurité d'un conseil médical pour un patient, à évaluer la fiabilité des sources citées, et à détecter les hallucinations typiques des LLM en contexte médical.",
    validates: "À l'issue de la certification, vous serez qualifié pour annoter des tâches médicales sur STEF et recevoir la rémunération correspondante.",
    prerequisites: "Cette certification s'adresse aux professionnels de santé, étudiants avancés en médecine (4ème année minimum), pharmaciens, infirmiers spécialisés, ou toute personne avec une formation médicale solide. Une familiarité avec les erreurs typiques des LLM en contexte médical est un atout.",
    outcome: "",
    phases: [
      {
        title: "QCM Domaine",
        badge: "Phase 1",
        duration: "~20 minutes",
        icon: GraduationCap,
        description: "15 questions à choix multiple sur les fondamentaux du domaine. Les questions sont générées dynamiquement — elles sont uniques à chaque passation. Vous devez obtenir au moins 70% de bonnes réponses (11/15) pour accéder à la phase suivante.",
        evaluated: "Terminologie, principes fondamentaux, capacité à identifier des informations incorrectes, compréhension des enjeux de sécurité.",
        threshold: "11/15 minimum (70%)",
        tip: "Prenez le temps de lire chaque question. Les distracteurs sont réalistes et basés sur les erreurs courantes des LLM.",
      },
      {
        title: "Évaluation d'une réponse IA",
        badge: "Phase 2",
        duration: "~25 minutes",
        icon: Search,
        description: "Vous recevez un prompt et une réponse IA contenant des erreurs intentionnelles. Vous devez identifier les erreurs, scorer la réponse sur 6 dimensions (0-5), rédiger un raisonnement, puis évaluer un scénario éthique. Votre évaluation est comparée à une évaluation de référence.",
        evaluated: "Capacité à détecter des erreurs subtiles, rigueur du scoring, qualité du raisonnement, cohérence entre les scores et le raisonnement, jugement éthique.",
        threshold: "Écart moyen ≤ 1.0 point par dimension. Aucune erreur critique manquée. Verdict éthique dans la marge.",
        tip: "Rédigez votre raisonnement AVANT d'attribuer vos scores. La profondeur de votre analyse compte autant que la précision de vos scores.",
      },
      {
        title: "Annotation en conditions réelles",
        badge: "Phase 3",
        duration: "~20 minutes",
        icon: ClipboardCheck,
        description: "Vous complétez 3 tâches d'annotation réelles. Vos annotations sont évaluées par notre système de contrôle qualité multi-modèle. L'accord inter-annotateurs (Krippendorff's Alpha) doit atteindre au minimum 0.75.",
        evaluated: "Qualité de vos annotations en conditions réelles, cohérence, temps passé, rigueur du raisonnement.",
        threshold: "α ≥ 0.75",
        tip: "Travaillez comme si c'était une tâche rémunérée. La qualité prime sur la vitesse.",
      },
    ],
  },
  legal: {
    label: "Droit",
    icon: Scale,
    color: "#F59E0B",
    description: "Cette certification vérifie votre capacité à évaluer des réponses générées par des modèles d'intelligence artificielle dans le domaine juridique. Vous serez testé sur votre aptitude à identifier des erreurs de droit, à juger la pertinence d'un raisonnement juridique, à évaluer la fiabilité des références citées, et à détecter les hallucinations des LLM en contexte légal.",
    validates: "À l'issue de la certification, vous serez qualifié pour annoter des tâches juridiques sur STEF et recevoir la rémunération correspondante.",
    prerequisites: "Cette certification s'adresse aux juristes diplômés, avocats, étudiants avancés en droit (Master 1 minimum), notaires, ou professionnels du juridique. Une connaissance des principes généraux du droit (civil, pénal, commercial) est nécessaire. La connaissance d'une juridiction spécifique n'est pas requise.",
    outcome: "",
    phases: [
      {
        title: "QCM Domaine", badge: "Phase 1", duration: "~20 minutes", icon: GraduationCap,
        description: "15 questions à choix multiple sur les fondamentaux du droit. Les questions sont générées dynamiquement et uniques à chaque passation. Vous devez obtenir au moins 70% de bonnes réponses (11/15).",
        evaluated: "Concepts juridiques, raisonnement légal, identification d'erreurs, compréhension des nuances entre juridictions.",
        threshold: "11/15 minimum (70%)",
        tip: "Les questions couvrent le droit civil, pénal et commercial. Lisez attentivement les nuances dans chaque proposition.",
      },
      {
        title: "Évaluation d'une réponse IA", badge: "Phase 2", duration: "~25 minutes", icon: Search,
        description: "Vous recevez un prompt et une réponse IA contenant des erreurs intentionnelles. Vous devez identifier les erreurs, scorer la réponse sur 6 dimensions, rédiger un raisonnement, puis évaluer un scénario éthique.",
        evaluated: "Détection d'erreurs juridiques, rigueur du scoring, qualité du raisonnement, jugement éthique.",
        threshold: "Écart moyen ≤ 1.0 point par dimension. Verdict éthique dans la marge.",
        tip: "Vérifiez systématiquement les références légales citées. Les LLM inventent souvent des articles de loi.",
      },
      {
        title: "Annotation en conditions réelles", badge: "Phase 3", duration: "~20 minutes", icon: ClipboardCheck,
        description: "Vous complétez 3 tâches d'annotation réelles. L'accord inter-annotateurs doit atteindre au minimum 0.75.",
        evaluated: "Qualité des annotations, cohérence, rigueur du raisonnement.",
        threshold: "α ≥ 0.75",
        tip: "Travaillez comme si c'était une tâche rémunérée. La qualité prime sur la vitesse.",
      },
    ],
  },
  finance: {
    label: "Finance",
    icon: TrendingUp,
    color: "#10B981",
    description: "Cette certification vérifie votre capacité à évaluer des réponses générées par des modèles d'intelligence artificielle dans le domaine financier. Vous serez testé sur votre aptitude à identifier des erreurs de calcul, à juger la pertinence d'un conseil financier, à évaluer la fiabilité des données citées, et à détecter les biais et hallucinations des LLM.",
    validates: "À l'issue de la certification, vous serez qualifié pour annoter des tâches financières sur STEF et recevoir la rémunération correspondante.",
    prerequisites: "Cette certification s'adresse aux professionnels de la finance, analystes, gestionnaires de risques, étudiants en Master finance ou équivalent, candidats CFA/FRM, ou toute personne avec une formation en marchés financiers, valorisation et réglementation.",
    outcome: "",
    phases: [
      {
        title: "QCM Domaine", badge: "Phase 1", duration: "~20 minutes", icon: GraduationCap,
        description: "15 questions à choix multiple sur les fondamentaux de la finance. Questions uniques à chaque passation. Seuil de 70% (11/15).",
        evaluated: "Marchés financiers, instruments, réglementation, calculs de base, gestion des risques.",
        threshold: "11/15 minimum (70%)",
        tip: "Les questions mélangent théorie et cas pratiques. Attention aux pièges sur les calculs de rendement.",
      },
      {
        title: "Évaluation d'une réponse IA", badge: "Phase 2", duration: "~25 minutes", icon: Search,
        description: "Vous recevez un prompt et une réponse IA contenant des erreurs intentionnelles. Scoring sur 6 dimensions, raisonnement, puis scénario éthique.",
        evaluated: "Détection d'erreurs financières, rigueur du scoring, jugement éthique sur les conseils financiers.",
        threshold: "Écart moyen ≤ 1.0 point par dimension. Verdict éthique dans la marge.",
        tip: "Vérifiez les chiffres et les pourcentages. Les LLM font régulièrement des erreurs de calcul en finance.",
      },
      {
        title: "Annotation en conditions réelles", badge: "Phase 3", duration: "~20 minutes", icon: ClipboardCheck,
        description: "3 tâches d'annotation réelles. Accord inter-annotateurs minimum 0.75.",
        evaluated: "Qualité des annotations, cohérence, rigueur.",
        threshold: "α ≥ 0.75",
        tip: "Travaillez comme si c'était une tâche rémunérée. La qualité prime sur la vitesse.",
      },
    ],
  },
  code: {
    label: "Code",
    icon: Code2,
    color: "#7B6FF0",
    description: "Cette certification vérifie votre capacité à évaluer du code généré par des modèles d'intelligence artificielle. Vous serez testé sur votre aptitude à identifier des bugs, des failles de sécurité, des problèmes de performance, et à juger la qualité générale du code produit.",
    validates: "À l'issue de la certification, vous serez qualifié pour annoter des tâches de code sur STEF et recevoir la rémunération correspondante.",
    prerequisites: "Cette certification s'adresse aux développeurs avec au moins 2 ans d'expérience professionnelle ou un parcours académique équivalent. Vous devez être à l'aise avec la lecture de code dans au moins un langage courant (Python, JavaScript, Java, C#). La certification teste le jugement, pas la capacité à écrire du code.",
    outcome: "",
    phases: [
      {
        title: "QCM Domaine", badge: "Phase 1", duration: "~20 minutes", icon: GraduationCap,
        description: "15 questions à choix multiple sur les fondamentaux du développement. Questions générées dynamiquement. Seuil de 70% (11/15).",
        evaluated: "Algorithmes, architecture, bonnes pratiques, sécurité, écosystème.",
        threshold: "11/15 minimum (70%)",
        tip: "Les questions couvrent plusieurs langages. Concentrez-vous sur les concepts, pas la syntaxe.",
      },
      {
        title: "Évaluation d'une réponse IA", badge: "Phase 2", duration: "~25 minutes", icon: Search,
        description: "Vous recevez un prompt et du code IA contenant des erreurs intentionnelles. Scoring sur 6 dimensions, raisonnement, puis scénario éthique.",
        evaluated: "Détection de bugs, failles de sécurité, problèmes de performance, jugement éthique.",
        threshold: "Écart moyen ≤ 1.0 point par dimension. Verdict éthique dans la marge.",
        tip: "Lisez le code ligne par ligne. Les erreurs les plus critiques sont souvent les plus subtiles.",
      },
      {
        title: "Annotation en conditions réelles", badge: "Phase 3", duration: "~20 minutes", icon: ClipboardCheck,
        description: "3 tâches d'annotation réelles. Accord inter-annotateurs minimum 0.75.",
        evaluated: "Qualité des annotations, cohérence, rigueur.",
        threshold: "α ≥ 0.75",
        tip: "Travaillez comme si c'était une tâche rémunérée. La qualité prime sur la vitesse.",
      },
    ],
  },
  generaliste: {
    label: "Généraliste",
    icon: FileText,
    color: "#71717A",
    description: "Cette certification vérifie votre capacité à évaluer des réponses générées par des modèles d'intelligence artificielle dans un contexte généraliste. Vous serez testé sur votre aptitude à classifier des contenus, détecter des erreurs factuelles, évaluer la cohérence logique et la qualité rédactionnelle des réponses IA.",
    validates: "À l'issue de la certification, vous serez qualifié pour annoter des tâches généralistes sur STEF et recevoir la rémunération correspondante.",
    prerequisites: "Cette certification est ouverte à tous les profils. Un bon esprit critique, de solides compétences rédactionnelles et une familiarité avec les forces et faiblesses des modèles de langage sont les principaux prérequis.",
    outcome: "",
    phases: [
      {
        title: "QCM Domaine", badge: "Phase 1", duration: "~20 minutes", icon: GraduationCap,
        description: "15 questions à choix multiple sur l'évaluation de contenus IA. Questions générées dynamiquement. Seuil de 70% (11/15).",
        evaluated: "Classification, cohérence logique, détection d'erreurs factuelles, qualité rédactionnelle.",
        threshold: "11/15 minimum (70%)",
        tip: "Concentrez-vous sur la logique et la cohérence des affirmations plutôt que sur les connaissances spécialisées.",
      },
      {
        title: "Évaluation d'une réponse IA", badge: "Phase 2", duration: "~25 minutes", icon: Search,
        description: "Vous recevez un prompt et une réponse IA contenant des erreurs intentionnelles. Scoring sur 6 dimensions, raisonnement, puis scénario éthique.",
        evaluated: "Détection d'erreurs factuelles, évaluation de la cohérence, qualité du raisonnement, jugement éthique.",
        threshold: "Écart moyen ≤ 1.0 point par dimension. Verdict éthique dans la marge.",
        tip: "Vérifiez chaque affirmation indépendamment. Les erreurs sont souvent mélangées à des informations correctes.",
      },
      {
        title: "Annotation en conditions réelles", badge: "Phase 3", duration: "~20 minutes", icon: ClipboardCheck,
        description: "3 tâches d'annotation réelles. Accord inter-annotateurs minimum 0.75.",
        evaluated: "Qualité des annotations, cohérence, rigueur du raisonnement.",
        threshold: "α ≥ 0.75",
        tip: "Travaillez comme si c'était une tâche rémunérée. La qualité prime sur la vitesse.",
      },
    ],
  },
  rlhf_preference: {
    label: "RLHF Preference",
    icon: Layers,
    color: "#8B5CF6",
    description: "Cette certification vérifie votre capacité à comparer et classer des réponses générées par des modèles d'intelligence artificielle. Vous serez testé sur votre aptitude à évaluer des réponses sur plusieurs dimensions, à identifier des préférences fondées, et à détecter les biais dans les comparaisons.",
    validates: "À l'issue de la certification, vous serez qualifié pour annoter des tâches de préférence RLHF (Reinforcement Learning from Human Feedback) sur STEF et recevoir la rémunération correspondante.",
    prerequisites: "Cette certification s'adresse aux professionnels familiers avec l'évaluation qualitative de contenus textuels. Une compréhension des principes de l'alignement IA et du RLHF est un atout. Aucune compétence technique en machine learning n'est requise.",
    outcome: "",
    phases: [
      {
        title: "QCM Domaine", badge: "Phase 1", duration: "~20 minutes", icon: GraduationCap,
        description: "15 questions à choix multiple sur les fondamentaux de l'évaluation de préférences et du RLHF. Questions générées dynamiquement. Seuil de 70% (11/15).",
        evaluated: "Comparaison de réponses, détection de biais, ranking par préférence, évaluation multi-dimensionnelle.",
        threshold: "11/15 minimum (70%)",
        tip: "Les questions testent votre capacité à justifier un choix de préférence de manière objective et structurée.",
      },
      {
        title: "Évaluation d'une réponse IA", badge: "Phase 2", duration: "~25 minutes", icon: Search,
        description: "Vous recevez deux réponses IA à un même prompt. Vous devez les évaluer individuellement sur 6 dimensions, justifier votre préférence, puis évaluer un scénario éthique.",
        evaluated: "Rigueur de la comparaison, objectivité du ranking, qualité du raisonnement, jugement éthique.",
        threshold: "Écart moyen ≤ 1.0 point par dimension. Verdict éthique dans la marge.",
        tip: "Évaluez chaque réponse indépendamment avant de les comparer. Évitez les biais de position (A vs B).",
      },
      {
        title: "Annotation en conditions réelles", badge: "Phase 3", duration: "~20 minutes", icon: ClipboardCheck,
        description: "3 tâches de comparaison réelles. Accord inter-annotateurs minimum 0.75.",
        evaluated: "Qualité des comparaisons, cohérence des préférences, rigueur du raisonnement.",
        threshold: "α ≥ 0.75",
        tip: "Travaillez comme si c'était une tâche rémunérée. La qualité prime sur la vitesse.",
      },
    ],
  },
  red_teaming_safety: {
    label: "Red Team Safety",
    icon: Shield,
    color: "#EF4444",
    description: "Cette certification vérifie votre capacité à tester la robustesse des modèles d'intelligence artificielle face aux prompts adversariaux. Vous serez testé sur votre aptitude à identifier des contenus dangereux, des biais discriminatoires, de la désinformation, et à évaluer la sécurité des réponses IA.",
    validates: "À l'issue de la certification, vous serez qualifié pour annoter des tâches de red-teaming et sécurité IA sur STEF et recevoir la rémunération correspondante.",
    prerequisites: "Cette certification s'adresse aux professionnels sensibilisés aux enjeux éthiques de l'IA, aux chercheurs en sécurité, aux spécialistes de la modération de contenu, ou à toute personne avec une expertise en détection de biais, manipulation et désinformation.",
    outcome: "",
    phases: [
      {
        title: "QCM Domaine", badge: "Phase 1", duration: "~20 minutes", icon: GraduationCap,
        description: "15 questions à choix multiple sur la sécurité IA, les biais, la désinformation et les prompts adversariaux. Questions générées dynamiquement. Seuil de 70% (11/15).",
        evaluated: "Détection de biais, contenus dangereux, techniques adversariales, taxonomie des risques IA.",
        threshold: "11/15 minimum (70%)",
        tip: "Les questions couvrent un large spectre de risques : biais, toxicité, manipulation, confidentialité. Pensez systématiquement aux cas limites.",
      },
      {
        title: "Évaluation d'une réponse IA", badge: "Phase 2", duration: "~25 minutes", icon: Search,
        description: "Vous recevez un prompt adversarial et la réponse du modèle. Vous devez évaluer si le modèle a résisté, identifier les failles, scorer sur 6 dimensions, puis évaluer un scénario éthique.",
        evaluated: "Détection de failles de sécurité, évaluation de la résistance du modèle, jugement éthique, qualité du raisonnement.",
        threshold: "Écart moyen ≤ 1.0 point par dimension. Verdict éthique dans la marge.",
        tip: "Ne vous limitez pas aux risques évidents. Les failles les plus dangereuses sont souvent subtiles et contextuelles.",
      },
      {
        title: "Annotation en conditions réelles", badge: "Phase 3", duration: "~20 minutes", icon: ClipboardCheck,
        description: "3 tâches d'évaluation de sécurité réelles. Accord inter-annotateurs minimum 0.75.",
        evaluated: "Qualité des évaluations de sécurité, cohérence, rigueur du raisonnement.",
        threshold: "α ≥ 0.75",
        tip: "Travaillez comme si c'était une tâche rémunérée. La qualité prime sur la vitesse.",
      },
    ],
  },
};

export default function CertificationBriefingPage() {
  const { domain } = useParams<{ domain: string }>();
  const navigate = useNavigate();
  const config = domain ? domainData[domain] : null;

  if (!config) {
    return (
      <ExpertDashboardLayout>
        <div className="px-4 py-12 text-center">
          <p className="text-muted-foreground">Domaine introuvable.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/expert/certification")}>Retour</Button>
        </div>
      </ExpertDashboardLayout>
    );
  }

  const Icon = config.icon;

  return (
    <ExpertDashboardLayout>
      <div className="px-4 md:px-8 py-6 max-w-[760px] mx-auto space-y-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link to="/expert/certification" className="hover:text-foreground transition-colors">Certifications</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-foreground font-medium">{config.label}</span>
        </nav>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl" style={{ backgroundColor: `${config.color}10` }}>
              <Icon className="w-10 h-10" style={{ color: config.color }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Certification {config.label}</h1>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className="gap-1 text-xs"><Clock className="w-3 h-3" />Durée estimée : 60 minutes</Badge>
                <Badge variant="outline" className="gap-1 text-xs"><Zap className="w-3 h-3" />Résultat immédiat</Badge>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Section 1 — Ce que cette certification valide */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Ce que cette certification valide</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{config.description}</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{config.validates}</p>
        </motion.section>

        {/* Section 2 — Les 3 phases */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Les 3 phases</h2>
          <div className="space-y-4">
            {config.phases.map((phase, i) => {
              const PhaseIcon = phase.icon;
              return (
                <Card key={i} className="border-border">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <PhaseIcon className="w-5 h-5 text-primary" />
                        <h3 className="font-semibold text-foreground">{phase.title}</h3>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-xs">{phase.badge}</Badge>
                        <Badge variant="outline" className="text-xs">{phase.duration}</Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{phase.description}</p>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium text-foreground">Ce qui est évalué : </span>
                        <span className="text-muted-foreground">{phase.evaluated}</span>
                      </div>
                      <div>
                        <span className="font-medium text-foreground">Seuil : </span>
                        <span className="text-muted-foreground font-mono text-xs">{phase.threshold}</span>
                      </div>
                      <div className="bg-muted/50 rounded-lg px-3 py-2 border border-border">
                        <span className="font-medium text-foreground">Conseil : </span>
                        <span className="text-muted-foreground">{phase.tip}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </motion.section>

        {/* Section 3 — Règles */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Règles</h2>
          <div className="bg-muted/50 rounded-xl p-5 space-y-4 text-sm text-muted-foreground leading-relaxed" style={{ borderLeft: `3px solid ${config.color}` }}>
            <p>L'assessment doit être complété en une seule session. Si vous quittez avant la fin, votre progression est sauvegardée et vous pouvez reprendre dans les 24 heures. Au-delà, l'assessment est annulé.</p>
            <p>L'utilisation d'outils d'IA (ChatGPT, Claude, Gemini, etc.) pour répondre aux questions est strictement interdite. Toute détection entraîne un échec immédiat et une interdiction de 90 jours.</p>
            <p>En cas d'échec, vous devez attendre 14 jours avant de retenter. Les questions seront entièrement différentes.</p>
            <p>La certification est valable 12 mois. Un renouvellement simplifié (Phase 1 uniquement) est proposé avant l'expiration.</p>
          </div>
        </motion.section>

        {/* Section 4 — Prérequis */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Prérequis recommandés</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{config.prerequisites}</p>
        </motion.section>

        {/* CTA */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="space-y-3 pt-4 pb-8">
          <Button
            size="lg"
            className="w-full h-12 text-base font-semibold gap-2"
            onClick={() => navigate(`/expert/certification/${domain}/assessment`)}
          >
            <ShieldAlert className="w-5 h-5" />
            Démarrer l'assessment
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            En cliquant, vous confirmez avoir lu les consignes ci-dessus et vous engagez à ne pas utiliser d'outils d'IA.
          </p>
        </motion.div>
      </div>
    </ExpertDashboardLayout>
  );
}
