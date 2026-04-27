import { useRef } from "react";
import { RLHFNavbar } from "@/components/RLHFNavbar";
import { RLHFFooter } from "@/components/RLHFFooter";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { Brain, Shield, Target, Zap, TrendingUp, Users, CheckCircle, ArrowRight } from "lucide-react";
import { SEO } from "@/components/SEO";

const AnimatedNumber = ({ value, suffix = "" }: { value: number; suffix?: string }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  
  return (
    <motion.span ref={ref} initial={{ opacity: 0 }} animate={isInView ? { opacity: 1 } : {}}>
      <motion.span initial={{ opacity: 0 }} animate={isInView ? { opacity: 1 } : {}} transition={{ duration: 0.5 }}>
        {isInView && (
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            {value}{suffix}
          </motion.span>
        )}
      </motion.span>
    </motion.span>
  );
};

const AnimatedBarChart = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });
  const bars = [
    { label: "CV Analysis", value: 95, color: "from-blue-500 to-cyan-500" },
    { label: "Tech Test", value: 88, color: "from-purple-500 to-pink-500" },
    { label: "Matching", value: 94, color: "from-green-500 to-emerald-500" },
    { label: "Anti-cheat", value: 99, color: "from-orange-500 to-red-500" },
  ];
  return (
    <div ref={ref} className="space-y-4">
      {bars.map((bar, index) => (
        <div key={bar.label} className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{bar.label}</span>
            <span className="font-semibold">{bar.value}%</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <motion.div className={`h-full bg-gradient-to-r ${bar.color} rounded-full`} initial={{ width: 0 }} animate={isInView ? { width: `${bar.value}%` } : {}} transition={{ duration: 1, delay: index * 0.15, ease: "easeOut" }} />
          </div>
        </div>
      ))}
    </div>
  );
};

const CircularProgress = ({ value, label, color }: { value: number; label: string; color: string }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });
  const circumference = 2 * Math.PI * 45;
  return (
    <div ref={ref} className="flex flex-col items-center">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="56" cy="56" r="45" stroke="currentColor" strokeWidth="8" fill="none" className="text-muted" />
          <motion.circle cx="56" cy="56" r="45" stroke="url(#gradient)" strokeWidth="8" fill="none" strokeLinecap="round" initial={{ strokeDasharray: circumference, strokeDashoffset: circumference }} animate={isInView ? { strokeDashoffset: circumference - (value / 100) * circumference } : {}} transition={{ duration: 1.5, ease: "easeOut" }} />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={color === "blue" ? "#3b82f6" : color === "green" ? "#22c55e" : "#f97316"} />
              <stop offset="100%" stopColor={color === "blue" ? "#06b6d4" : color === "green" ? "#10b981" : "#ef4444"} />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span className="text-2xl font-bold" initial={{ opacity: 0, scale: 0.5 }} animate={isInView ? { opacity: 1, scale: 1 } : {}} transition={{ duration: 0.5, delay: 0.5 }}>
            {value}%
          </motion.span>
        </div>
      </div>
      <span className="mt-2 text-sm text-muted-foreground text-center">{label}</span>
    </div>
  );
};

const EvaluationGrowthChart = ({ language }: { language: string }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  const quarters = [
    { label: "Q1 '24", evaluations: 120, experts: 45 },
    { label: "Q2 '24", evaluations: 340, experts: 130 },
    { label: "Q3 '24", evaluations: 890, experts: 310 },
    { label: "Q4 '24", evaluations: 1850, experts: 620 },
    { label: "Q1 '25", evaluations: 3200, experts: 1100 },
    { label: "Q2 '25", evaluations: 5400, experts: 1900 },
    { label: "Q3 '25", evaluations: 7800, experts: 2800 },
    { label: "Q4 '25*", evaluations: 10500, experts: 3600 },
  ];

  const maxEval = Math.max(...quarters.map(q => q.evaluations));

  const kpis = [
    { value: "10,500+", label: language === 'fr' ? "Évaluations cumulées" : "Cumulative evaluations", change: "+87x", changeLabel: language === 'fr' ? "vs lancement" : "vs launch" },
    { value: "3,600+", label: language === 'fr' ? "Experts certifiés" : "Certified experts", change: "+80x", changeLabel: language === 'fr' ? "vs lancement" : "vs launch" },
    { value: "34%", label: language === 'fr' ? "Taux de certification" : "Certification rate", change: "", changeLabel: language === 'fr' ? "résultat ≥ 70/100" : "score ≥ 70/100" },
    { value: "42%", label: language === 'fr' ? "Croissance QoQ" : "QoQ growth", change: "", changeLabel: language === 'fr' ? "moyenne trimestrielle" : "quarterly average" },
  ];

  return (
    <div ref={ref} className="space-y-8">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <motion.div
            key={i}
            className="text-center p-4 rounded-xl bg-muted/50 border border-border/50"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
          >
            <div className="text-2xl md:text-3xl font-bold text-foreground">{kpi.value}</div>
            <div className="text-sm text-muted-foreground mt-1">{kpi.label}</div>
            {kpi.change && (
              <span className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                <TrendingUp className="w-3 h-3" />{kpi.change}
              </span>
            )}
            {!kpi.change && kpi.changeLabel && (
              <span className="inline-block mt-2 text-xs text-muted-foreground">{kpi.changeLabel}</span>
            )}
          </motion.div>
        ))}
      </div>

      {/* Bar Chart */}
      <div>
        <div className="flex items-end gap-2 md:gap-3 h-48 md:h-56">
          {quarters.map((q, i) => {
            const heightPercent = (q.evaluations / maxEval) * 100;
            const expertHeight = (q.experts / maxEval) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <motion.div
                  className="text-[10px] md:text-xs font-semibold text-foreground/80 whitespace-nowrap"
                  initial={{ opacity: 0 }}
                  animate={isInView ? { opacity: 1 } : { opacity: 0 }}
                  transition={{ delay: 0.5 + i * 0.08 }}
                >
                  {q.evaluations >= 1000 ? `${(q.evaluations / 1000).toFixed(1)}k` : q.evaluations}
                </motion.div>
                <div className="w-full flex items-end gap-0.5 h-full min-h-8">
                  <motion.div
                    className="flex-1 bg-gradient-to-t from-primary to-primary/60 rounded-t-md relative group cursor-pointer"
                    initial={{ height: "6px" }}
                    animate={isInView ? { height: `${Math.max(heightPercent, 6)}%` } : { height: "6px" }}
                    transition={{ duration: 0.8, delay: i * 0.08, ease: "easeOut" }}
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-card border border-border shadow-lg rounded-lg px-2 py-1 text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      {q.evaluations.toLocaleString()} {language === 'fr' ? 'évals' : 'evals'}
                    </div>
                  </motion.div>
                  <motion.div
                    className="flex-1 bg-gradient-to-t from-green-500 to-green-400/60 rounded-t-md relative group cursor-pointer"
                    initial={{ height: "6px" }}
                    animate={isInView ? { height: `${Math.max(expertHeight, 6)}%` } : { height: "6px" }}
                    transition={{ duration: 0.8, delay: 0.1 + i * 0.08, ease: "easeOut" }}
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-card border border-border shadow-lg rounded-lg px-2 py-1 text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      {q.experts.toLocaleString()} {language === 'fr' ? 'experts' : 'experts'}
                    </div>
                  </motion.div>
                </div>
                <span className="text-[10px] md:text-xs text-muted-foreground mt-1">{q.label}</span>
              </div>
            );
          })}
        </div>
        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-gradient-to-t from-primary to-primary/60" />
            {language === 'fr' ? 'Évaluations complétées' : 'Completed evaluations'}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-gradient-to-t from-green-500 to-green-400/60" />
            {language === 'fr' ? 'Experts certifiés' : 'Certified experts'}
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground/60 text-center mt-2">
          {language === 'fr' ? '* Q4 2025 : projection basée sur le run-rate actuel' : '* Q4 2025: projection based on current run-rate'}
        </p>
      </div>
    </div>
  );
};

const SkillBar = ({ label, pct, delay, color }: { label: string; pct: number; delay: number; color: string }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  return (
    <div ref={ref} className="flex flex-col items-center gap-1.5">
      <div className="w-full h-16 bg-muted rounded-lg overflow-hidden flex items-end relative">
        <motion.div
          className={`w-full bg-gradient-to-t ${color} rounded-lg`}
          initial={{ height: 0 }}
          animate={isInView ? { height: `${pct}%` } : {}}
          transition={{ duration: 0.7, delay, ease: "easeOut" }}
        />
        <motion.span
          className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: delay + 0.5 }}
        >
          {pct}%
        </motion.span>
      </div>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
};

const ParticleBackground = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(20)].map((_, i) => (
      <motion.div key={i} className="absolute w-2 h-2 rounded-full bg-primary/20" initial={{ x: Math.random() * 100 + "%", y: Math.random() * 100 + "%" }} animate={{ y: [null, Math.random() * 100 + "%"], x: [null, Math.random() * 100 + "%"] }} transition={{ duration: 10 + Math.random() * 20, repeat: Infinity, repeatType: "reverse", ease: "linear" }} />
    ))}
  </div>
);

const Research = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end end"] });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.2], [1, 0.95]);

  const features = [
    { icon: Brain, title: language === 'fr' ? "IA Générative" : "Generative AI", description: language === 'fr' ? "Tests personnalisés générés par IA pour chaque poste et niveau de compétence." : "AI-generated personalized tests for each position and skill level.", gradient: "from-blue-500 to-cyan-500" },
    { icon: Shield, title: language === 'fr' ? "Anti-Triche" : "Anti-Cheat", description: language === 'fr' ? "Détection avancée : changements d'onglet, copy-paste, patterns de frappe suspects." : "Advanced detection: tab switches, copy-paste, suspicious typing patterns.", gradient: "from-red-500 to-orange-500" },
    { icon: Target, title: language === 'fr' ? "Matching Précis" : "Precise Matching", description: language === 'fr' ? "Algorithme analysant 47 critères pour connecter talents et opportunités." : "Algorithm analyzing 47 criteria to connect talents with opportunities.", gradient: "from-green-500 to-emerald-500" },
    { icon: Zap, title: language === 'fr' ? "Résultats Rapides" : "Fast Results", description: language === 'fr' ? "Évaluation complète et rapport détaillé en moins de 48 heures." : "Complete evaluation and detailed report in under 48 hours.", gradient: "from-purple-500 to-pink-500" },
  ];

  const stats = [
    { value: 10000, suffix: "+", label: language === 'fr' ? "Experts évalués" : "Experts evaluated" },
    { value: 98, suffix: "%", label: language === 'fr' ? "Précision" : "Accuracy" },
    { value: 48, suffix: "h", label: language === 'fr' ? "Délai moyen" : "Average time" },
    { value: 500, suffix: "+", label: language === 'fr' ? "Tests/mois" : "Tests/month" },
  ];

  return (
    <div ref={containerRef} className="min-h-screen bg-background">
      <SEO
        title="ARES Technology"
        description="Découvrez ARES, notre IA propriétaire pour l'évaluation tech : tests adaptatifs, anti-triche et matching intelligent."
        path="/research"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "ARES — IA d'évaluation technique",
          description: "Tests adaptatifs, anti-triche et matching intelligent propulsés par l'IA.",
          url: "https://steftalent.fr/research",
          isPartOf: { "@type": "WebSite", name: "STEF", url: "https://steftalent.fr" },
        }}
      />
      <RLHFNavbar />
      
      {/* Hero Section */}
      <motion.section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-14" style={{ opacity: heroOpacity, scale: heroScale }}>
        <ParticleBackground />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center py-20">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <motion.div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
              <Brain className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">{language === 'fr' ? 'Intelligence Artificielle de nouvelle génération' : 'Next-generation Artificial Intelligence'}</span>
            </motion.div>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6">
              <span className="bg-gradient-to-r from-primary via-blue-500 to-cyan-500 bg-clip-text text-transparent">ARES</span>
              <br />
              <span className="text-foreground/80">Technology</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-10">{language === 'fr' ? "L'IA qui révolutionne l'évaluation et le recrutement des talents tech." : "The AI revolutionizing tech talent evaluation and recruitment."}</p>
            <motion.div className="flex flex-col sm:flex-row gap-4 justify-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <Button size="lg" className="gap-2" onClick={() => navigate("/company")}>{language === 'fr' ? 'Demander une démo' : 'Request a demo'}<ArrowRight className="w-4 h-4" /></Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>{language === 'fr' ? 'Passer le test' : 'Take the test'}</Button>
            </motion.div>
          </motion.div>
          <motion.div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
            {stats.map((stat, i) => (
              <motion.div key={i} className="p-4 rounded-2xl bg-card/50 backdrop-blur border border-border/50" whileHover={{ scale: 1.05, borderColor: "hsl(var(--primary))" }} transition={{ type: "spring", stiffness: 300 }}>
                <div className="text-3xl md:text-4xl font-bold text-primary"><AnimatedNumber value={stat.value} suffix={stat.suffix} /></div>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
        <motion.div className="absolute bottom-8 left-1/2 -translate-x-1/2" animate={{ y: [0, 10, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
          <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex justify-center pt-2">
            <motion.div className="w-1 h-2 rounded-full bg-primary" animate={{ y: [0, 12, 0], opacity: [1, 0.5, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
          </div>
        </motion.div>
      </motion.section>

      {/* Features */}
      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div className="text-center mb-20" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">{language === 'fr' ? 'FONCTIONNALITÉS' : 'FEATURES'}</span>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">{language === 'fr' ? 'Ce qui rend ARES unique' : 'What makes ARES unique'}</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">{language === 'fr' ? 'Chaque module est conçu pour maximiser la fiabilité et la rapidité de vos recrutements tech.' : 'Each module is designed to maximize the reliability and speed of your tech recruitment.'}</p>
          </motion.div>

          {/* Feature 1 — Generative AI with skill radar */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <motion.div className="relative p-8 rounded-2xl bg-card border border-border/50 overflow-hidden group" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} whileHover={{ borderColor: "hsl(var(--primary) / 0.4)" }}>
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-blue-500 to-cyan-500 opacity-[0.07] blur-3xl group-hover:opacity-[0.15] transition-opacity" />
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0"><Brain className="w-6 h-6 text-white" /></div>
                <div>
                  <h3 className="text-xl font-bold mb-1">{language === 'fr' ? 'IA Générative' : 'Generative AI'}</h3>
                  <p className="text-muted-foreground text-sm">{language === 'fr' ? 'Tests personnalisés générés par IA pour chaque poste et niveau.' : 'AI-generated personalized tests for each role and level.'}</p>
                </div>
              </div>
              {/* Mini skill radar visualization */}
              <div className="bg-muted/40 rounded-xl p-5">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                  <span>{language === 'fr' ? 'Dimensions évaluées par test' : 'Dimensions per test'}</span>
                  <span className="font-semibold text-foreground">47 {language === 'fr' ? 'critères' : 'criteria'}</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: language === 'fr' ? 'Logique' : 'Logic', pct: 92 },
                    { label: language === 'fr' ? 'Code' : 'Code', pct: 88 },
                    { label: language === 'fr' ? 'Archi' : 'Arch', pct: 85 },
                    { label: language === 'fr' ? 'Comm' : 'Comm', pct: 78 },
                  ].map((d, i) => (
                    <SkillBar key={i} label={d.label} pct={d.pct} delay={i * 0.12} color="from-blue-500 to-cyan-500" />
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Feature 2 — Anti-cheat with live detection feed */}
            <motion.div className="relative p-8 rounded-2xl bg-card border border-border/50 overflow-hidden group" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} whileHover={{ borderColor: "hsl(var(--primary) / 0.4)" }}>
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-red-500 to-orange-500 opacity-[0.07] blur-3xl group-hover:opacity-[0.15] transition-opacity" />
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center flex-shrink-0"><Shield className="w-6 h-6 text-white" /></div>
                <div>
                  <h3 className="text-xl font-bold mb-1">{language === 'fr' ? 'Anti-Triche' : 'Anti-Cheat'}</h3>
                  <p className="text-muted-foreground text-sm">{language === 'fr' ? 'Surveillance comportementale en temps réel pendant chaque session.' : 'Real-time behavioral monitoring during every session.'}</p>
                </div>
              </div>
              {/* Detection feed mock */}
              <div className="bg-muted/40 rounded-xl p-4 space-y-2.5">
                {[
                  { signal: language === 'fr' ? 'Changement d\'onglet' : 'Tab switch', status: 'detected', time: '00:12:34' },
                  { signal: language === 'fr' ? 'Pattern de frappe' : 'Typing pattern', status: 'normal', time: '00:14:02' },
                  { signal: language === 'fr' ? 'Copier-coller' : 'Copy-paste', status: 'flagged', time: '00:18:47' },
                  { signal: language === 'fr' ? 'Focus navigateur' : 'Browser focus', status: 'normal', time: '00:22:11' },
                ].map((item, i) => (
                  <motion.div key={i} className="flex items-center justify-between text-xs" initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 + i * 0.1 }}>
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${item.status === 'detected' ? 'bg-orange-500' : item.status === 'flagged' ? 'bg-red-500' : 'bg-green-500'}`} />
                      <span className="text-foreground/80">{item.signal}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${item.status === 'detected' ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400' : item.status === 'flagged' ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-green-500/10 text-green-600 dark:text-green-400'}`}>
                        {item.status === 'detected' ? '⚠' : item.status === 'flagged' ? '🚩' : '✓'} {item.status}
                      </span>
                      <span className="text-muted-foreground font-mono">{item.time}</span>
                    </div>
                  </motion.div>
                ))}
                <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">{language === 'fr' ? 'Taux de détection' : 'Detection rate'}</span>
                  <span className="text-sm font-bold text-foreground">99.7%</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Feature 3 & 4 row */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Feature 3 — Matching with funnel */}
            <motion.div className="relative p-8 rounded-2xl bg-card border border-border/50 overflow-hidden group" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 }} whileHover={{ borderColor: "hsl(var(--primary) / 0.4)" }}>
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-green-500 to-emerald-500 opacity-[0.07] blur-3xl group-hover:opacity-[0.15] transition-opacity" />
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center flex-shrink-0"><Target className="w-6 h-6 text-white" /></div>
                <div>
                  <h3 className="text-xl font-bold mb-1">{language === 'fr' ? 'Matching Précis' : 'Precise Matching'}</h3>
                  <p className="text-muted-foreground text-sm">{language === 'fr' ? 'Algorithme multi-critères pour des connexions talent-mission optimales.' : 'Multi-criteria algorithm for optimal talent-mission connections.'}</p>
                </div>
              </div>
              {/* Matching funnel */}
              <div className="bg-muted/40 rounded-xl p-5 space-y-3">
                {[
                  { label: language === 'fr' ? 'Candidats analysés' : 'Candidates analyzed', value: '2,847', width: '100%' },
                  { label: language === 'fr' ? 'Compétences validées' : 'Skills validated', value: '1,203', width: '72%' },
                  { label: language === 'fr' ? 'Match culturel' : 'Cultural match', value: '486', width: '45%' },
                  { label: language === 'fr' ? 'Shortlist finale' : 'Final shortlist', value: '12', width: '18%' },
                ].map((step, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -15 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.1 }}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{step.label}</span>
                      <span className="font-semibold text-foreground">{step.value}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full" initial={{ width: 0 }} whileInView={{ width: step.width }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.3 + i * 0.1 }} />
                    </div>
                  </motion.div>
                ))}
                <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">{language === 'fr' ? 'Précision du matching' : 'Matching accuracy'}</span>
                  <span className="text-sm font-bold text-foreground">94%</span>
                </div>
              </div>
            </motion.div>

            {/* Feature 4 — Speed with timeline */}
            <motion.div className="relative p-8 rounded-2xl bg-card border border-border/50 overflow-hidden group" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} whileHover={{ borderColor: "hsl(var(--primary) / 0.4)" }}>
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-purple-500 to-pink-500 opacity-[0.07] blur-3xl group-hover:opacity-[0.15] transition-opacity" />
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0"><Zap className="w-6 h-6 text-white" /></div>
                <div>
                  <h3 className="text-xl font-bold mb-1">{language === 'fr' ? 'Résultats Rapides' : 'Fast Results'}</h3>
                  <p className="text-muted-foreground text-sm">{language === 'fr' ? 'Du test au rapport complet en un temps record.' : 'From test to full report in record time.'}</p>
                </div>
              </div>
              {/* Speed timeline */}
              <div className="bg-muted/40 rounded-xl p-5">
                <div className="relative">
                  <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-border" />
                  {[
                    { time: '0h', label: language === 'fr' ? 'Lancement du test' : 'Test launch', dot: 'bg-purple-500' },
                    { time: '1h', label: language === 'fr' ? 'Test complété' : 'Test completed', dot: 'bg-purple-400' },
                    { time: '6h', label: language === 'fr' ? 'Analyse IA terminée' : 'AI analysis done', dot: 'bg-pink-500' },
                    { time: '24h', label: language === 'fr' ? 'Rapport disponible' : 'Report available', dot: 'bg-pink-400' },
                    { time: '48h', label: language === 'fr' ? 'Matching activé' : 'Matching activated', dot: 'bg-primary' },
                  ].map((step, i) => (
                    <motion.div key={i} className="flex items-center gap-4 py-2 relative" initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.08 }}>
                      <div className={`w-6 h-6 rounded-full ${step.dot} flex items-center justify-center z-10 ring-4 ring-card`}>
                        <div className="w-2 h-2 rounded-full bg-white" />
                      </div>
                      <span className="text-xs font-mono text-muted-foreground w-8">{step.time}</span>
                      <span className="text-sm text-foreground/90">{step.label}</span>
                    </motion.div>
                  ))}
                </div>
                <div className="pt-3 mt-2 border-t border-border/50 flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-purple-500" />
                  <span className="text-[11px] text-muted-foreground">{language === 'fr' ? '10× plus rapide qu\'un process classique' : '10× faster than a traditional process'}</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Analytics */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">{language === 'fr' ? 'PERFORMANCES' : 'PERFORMANCE'}</span>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">{language === 'fr' ? 'Des résultats mesurables' : 'Measurable results'}</h2>
          </motion.div>
          <div className="grid md:grid-cols-2 gap-8">
            <motion.div className="p-6 rounded-2xl bg-card border border-border/50" initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <h3 className="text-lg font-semibold mb-6">{language === 'fr' ? 'Précision par module' : 'Accuracy by module'}</h3>
              <AnimatedBarChart />
            </motion.div>
            <motion.div className="p-6 rounded-2xl bg-card border border-border/50" initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <h3 className="text-lg font-semibold mb-6">{language === 'fr' ? 'Métriques clés' : 'Key metrics'}</h3>
              <div className="flex justify-around"><CircularProgress value={94} label="Matching" color="blue" /><CircularProgress value={99} label="Anti-cheat" color="orange" /><CircularProgress value={98} label={language === 'fr' ? 'Satisfaction' : 'Satisfaction'} color="green" /></div>
            </motion.div>
          </div>
          <motion.div className="mt-8 p-6 rounded-2xl bg-card border border-border/50" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h3 className="text-lg font-semibold mb-6">{language === 'fr' ? 'Croissance des évaluations' : 'Evaluation growth'}</h3>
            <EvaluationGrowthChart language={language} />
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">{language === 'fr' ? 'PROCESSUS' : 'PROCESS'}</span>
            <h2 className="text-3xl md:text-5xl font-bold">{language === 'fr' ? 'Comment ça marche' : 'How it works'}</h2>
          </motion.div>
          <div className="space-y-0">
            {[
              { icon: TrendingUp, title: language === 'fr' ? "Inscription et profil" : "Registration and profile", desc: language === 'fr' ? "Créez votre compte et renseignez vos compétences." : "Create your account and fill in your skills." },
              { icon: Brain, title: language === 'fr' ? "Test adaptatif ARES" : "ARES adaptive test", desc: language === 'fr' ? "L'IA génère un test personnalisé selon votre expertise." : "AI generates a personalized test based on your expertise." },
              { icon: Shield, title: language === 'fr' ? "Validation et scoring" : "Validation and scoring", desc: language === 'fr' ? "Évaluation multi-dimensionnelle avec détection anti-triche." : "Multi-dimensional evaluation with anti-cheat detection." },
              { icon: CheckCircle, title: language === 'fr' ? "Matching et opportunités" : "Matching and opportunities", desc: language === 'fr' ? "Connectez-vous aux meilleures opportunités tech." : "Connect with the best tech opportunities." },
            ].map((step, i) => (
              <motion.div key={i} className="flex gap-6 items-start relative" initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                {i < 3 && <div className="absolute left-7 top-14 w-0.5 h-full bg-border" />}
                <div className="relative z-10 w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0"><step.icon className="w-6 h-6 text-primary" /></div>
                <div className="pb-12"><h3 className="text-lg font-semibold mb-1">{step.title}</h3><p className="text-muted-foreground">{step.desc}</p></div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-gradient-to-br from-primary/10 via-background to-primary/5">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">{language === 'fr' ? 'Prêt à découvrir ARES ?' : 'Ready to discover ARES?'}</h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-xl mx-auto">{language === 'fr' ? "Rejoignez des milliers de talents tech déjà évalués par notre IA." : "Join thousands of tech talents already evaluated by our AI."}</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="gap-2" onClick={() => navigate("/auth")}>{language === 'fr' ? 'Passer le test' : 'Take the test'}<ArrowRight className="w-4 h-4" /></Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/company")}>{language === 'fr' ? 'Demander une démo' : 'Request a demo'}</Button>
            </div>
          </motion.div>
        </div>
      </section>

      <RLHFFooter />
    </div>
  );
};

export default Research;
