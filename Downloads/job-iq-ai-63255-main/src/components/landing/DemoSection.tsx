import { useRef, useState } from "react";
import { Play } from "lucide-react";
import { RequestQuoteButton, WatchDemoButton } from "./CTAs";

const STEPS = [
  {
    n: "01",
    title: "Upload & PII scan",
    desc: "Détection automatique des données personnelles avant tout appel LLM",
  },
  {
    n: "02",
    title: "Annotation multi-experts",
    desc: "2 à 3 experts certifiés par tâche selon le SLA",
  },
  {
    n: "03",
    title: "Export & rapport alpha",
    desc: "Dataset JSONL + rapport Krippendorff prêt pour AI Act art. 11",
  },
];

export const DemoSection = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const handlePlay = () => {
    videoRef.current?.play();
    setPlaying(true);
  };

  return (
    <section id="demo" className="relative py-24 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="inline-block text-xs uppercase tracking-wider text-primary font-medium mb-4">
            Démo produit
          </span>
          <h2 className="text-foreground text-3xl md:text-4xl font-semibold mb-4">
            Voyez STEF en action
          </h2>
          <p className="text-muted-foreground text-base md:text-lg">
            Du dataset brut à l'export validé avec score alpha — 2 minutes pour comprendre le pipeline complet.
          </p>
        </div>

        {/* Video player */}
        <div className="relative aspect-video rounded-2xl overflow-hidden border border-primary/20 shadow-[0_0_60px_-15px_rgba(123,111,240,0.4)] bg-zinc-950">
          <video
            ref={videoRef}
            poster="/demo-poster.jpg"
            controls={playing}
            onEnded={() => setPlaying(false)}
            onPause={() => setPlaying(false)}
            className="w-full h-full object-cover"
          >
            <source src="/demo.mp4" type="video/mp4" />
          </video>
          {!playing && (
            <button
              onClick={handlePlay}
              className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/30 transition-colors group"
              aria-label="Lire la vidéo"
            >
              <span className="w-24 h-24 rounded-full bg-primary flex items-center justify-center shadow-[0_0_40px_rgba(123,111,240,0.6)] group-hover:scale-105 transition-transform">
                <Play className="w-10 h-10 text-white fill-white ml-1" />
              </span>
            </button>
          )}
        </div>

        {/* Steps grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          {STEPS.map((step) => (
            <div
              key={step.n}
              className="bg-card border border-border rounded-xl p-5 hover:border-primary/40 transition-colors"
            >
              <div className="text-sm font-mono text-primary mb-2">{step.n}</div>
              <h3 className="text-foreground font-semibold mb-1">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-12">
          <RequestQuoteButton size="lg" className="w-full sm:w-auto" />
          <WatchDemoButton
            size="lg"
            label="Réserver une démo personnalisée"
            className="w-full sm:w-auto border-primary/30 hover:bg-primary/10"
          />
        </div>
      </div>
    </section>
  );
};
