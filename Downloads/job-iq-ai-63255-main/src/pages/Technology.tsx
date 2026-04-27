import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import { PipelineSection } from "@/components/technology/PipelineSection";
import { RoutingSection } from "@/components/technology/RoutingSection";
import { AdjudicationSection } from "@/components/technology/AdjudicationSection";
import { ReliabilitySection } from "@/components/technology/ReliabilitySection";
import { SEO } from "@/components/SEO";

const NAV_ITEMS = [
  { id: "pipeline", label: "Pipeline" },
  { id: "routing", label: "Routage" },
  { id: "adjudication", label: "Adjudication" },
  { id: "reliability", label: "Fiabilité" },
];

export default function Technology() {
  const [activeSection, setActiveSection] = useState("pipeline");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { threshold: 0.3, rootMargin: "-80px 0px -40% 0px" }
    );

    NAV_ITEMS.forEach(({ id }) => {
      const el = sectionRefs.current[id];
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileNavOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-[#FAFAFA] selection:bg-primary/30 overflow-x-hidden">
      <SEO title="ARES Technology — STEF" description="Le moteur de fiabilité derrière chaque datapoint STEF." path="/technology" />

      {/* Sticky nav */}
      <nav className="sticky top-0 z-50 bg-[#09090B]/90 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-[1100px] mx-auto px-4 h-12 flex items-center justify-between">
          <Link to="/" className="text-sm font-semibold text-white/50 hover:text-white/80 transition-colors">
            STEF
          </Link>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-1">
            {NAV_ITEMS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition-all duration-200 ${
                  activeSection === id
                    ? "text-white bg-white/[0.08]"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Mobile nav toggle */}
          <button
            className="sm:hidden flex items-center justify-center w-10 h-10"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            aria-label="Navigation"
          >
            {mobileNavOpen ? <X className="w-5 h-5 text-white/70" /> : <Menu className="w-5 h-5 text-white/70" />}
          </button>

          <div className="w-[40px] hidden sm:block" />
        </div>

        {/* Mobile nav dropdown */}
        {mobileNavOpen && (
          <div className="sm:hidden border-t border-white/[0.06] px-4 py-2 space-y-1">
            {NAV_ITEMS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className={`block w-full text-left px-3 py-3 text-sm rounded-md transition-colors ${
                  activeSection === id
                    ? "text-white bg-white/[0.08]"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* Header */}
      <header className="relative pt-20 sm:pt-32 pb-16 sm:pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-[#22C55E]/[0.03]" />
        <div className="max-w-[800px] mx-auto px-4 relative">
          <motion.h1
            className="text-[40px] sm:text-[64px] lg:text-[80px] font-bold tracking-[0.15em] text-white/[0.12] leading-none mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
          >
            {"ARES".split("").map((char, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.5 }}
                className="inline-block"
              >
                {char}
              </motion.span>
            ))}
          </motion.h1>
          <motion.p
            className="text-lg sm:text-xl lg:text-2xl font-semibold text-white/90 mb-4 max-w-[600px]"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            Le moteur de fiabilité derrière chaque datapoint STEF.
          </motion.p>
          <motion.p
            className="text-[15px] leading-relaxed text-white/50 max-w-[560px]"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
          >
            ARES est l'infrastructure qui garantit que chaque annotation produite sur STEF
            est vérifiable, mesurable et reproductible. Voici comment il fonctionne.
          </motion.p>
        </div>
      </header>

      {/* Sections */}
      <div className="space-y-0">
        <section id="pipeline" ref={(el) => { sectionRefs.current.pipeline = el; }}>
          <PipelineSection />
        </section>
        <section id="routing" ref={(el) => { sectionRefs.current.routing = el; }}>
          <RoutingSection />
        </section>
        <section id="adjudication" ref={(el) => { sectionRefs.current.adjudication = el; }}>
          <AdjudicationSection />
        </section>
        <section id="reliability" ref={(el) => { sectionRefs.current.reliability = el; }}>
          <ReliabilitySection />
        </section>
      </div>

      {/* Footer */}
      <footer className="py-16 sm:py-24 border-t border-white/[0.06]">
        <div className="max-w-[800px] mx-auto px-4 text-center">
          <p className="text-[15px] text-white/40 leading-relaxed mb-10">
            ARES est développé et amélioré en continu. Chaque projet, chaque annotation,
            chaque mesure renforce le système.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
            <Link
              to="/"
              className="text-sm text-white/40 hover:text-white/70 transition-colors flex items-center gap-1.5 min-h-[44px]"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Retour à l'accueil
            </Link>
            <Link
              to="/client/api"
              className="text-sm text-white/40 hover:text-white/70 transition-colors flex items-center gap-1.5 min-h-[44px]"
            >
              Documentation API <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
