import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Check, ChevronDown, X, Loader2,
  Stethoscope, Scale, TrendingUp, Code2,
  Globe, Shield, Mail, Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DemoDialog } from "./DemoDialog";

const plans = [
  {
    name: "Standard",
    price: 28,
    envelope: "15 — 40 k€",
    alpha: "0.75",
    annotators: 2,
    features: [
      "α ≥ 0,75 garanti",
      "2 annotateurs par tâche",
      "Livraison estimée : 5 jours",
      "Enveloppe projet typique : 15 — 40 k€",
      "Support email",
      "Tous formats d'export (JSONL, Parquet, HF)",
      "Rapport de performance basique",
    ],
    highlighted: false,
  },
  {
    name: "Prioritaire",
    price: 38,
    envelope: "40 — 120 k€",
    alpha: "0.80",
    annotators: 2,
    badge: "Recommandé",
    features: [
      "α ≥ 0,80 garanti",
      "2 annotateurs par tâche",
      "Livraison estimée : 3 jours",
      "Enveloppe projet typique : 40 — 120 k€",
      "Support email prioritaire",
      "Tous formats d'export",
      "Rapport de performance complet signé",
    ],
    highlighted: true,
  },
  {
    name: "Express",
    price: 60,
    envelope: "120 — 250 k€+",
    alpha: "0.85",
    annotators: 3,
    features: [
      "α ≥ 0,85 garanti",
      "3 annotateurs par tâche",
      "Livraison estimée : 1-2 jours",
      "Enveloppe projet typique : 120 — 250 k€+",
      "Support dédié + call de debriefing expert",
      "Tous formats d'export",
      "SLA contractuel avec pénalités (15% crédit si manqué)",
    ],
    highlighted: false,
  },
];

type PriceRow = { label: string; standard: number; priority: number; express: number };
type DomainGroup = { domain: string; rows: PriceRow[] };

const priceGrid: DomainGroup[] = [
  {
    domain: "Médical",
    rows: [
      { label: "Scoring", standard: 33, priority: 46, express: 73 },
      { label: "Préférences DPO", standard: 26, priority: 37, express: 58 },
      { label: "Fact-checking", standard: 38, priority: 53, express: 83 },
      { label: "Red-teaming", standard: 56, priority: 79, express: 124 },
      { label: "Génération", standard: 42, priority: 59, express: 93 },
    ],
  },
  {
    domain: "Juridique",
    rows: [
      { label: "Scoring", standard: 28, priority: 39, express: 62 },
      { label: "Préférences DPO", standard: 22, priority: 32, express: 50 },
      { label: "Fact-checking", standard: 33, priority: 46, express: 73 },
      { label: "Red-teaming", standard: 47, priority: 66, express: 103 },
      { label: "Génération", standard: 36, priority: 50, express: 79 },
    ],
  },
  {
    domain: "Finance",
    rows: [
      { label: "Scoring", standard: 28, priority: 39, express: 62 },
      { label: "Préférences DPO", standard: 22, priority: 32, express: 50 },
      { label: "Fact-checking", standard: 33, priority: 46, express: 73 },
      { label: "Red-teaming", standard: 47, priority: 66, express: 103 },
      { label: "Génération", standard: 36, priority: 50, express: 79 },
    ],
  },
  {
    domain: "Code",
    rows: [
      { label: "Scoring", standard: 23, priority: 33, express: 52 },
      { label: "Préférences DPO", standard: 19, priority: 26, express: 41 },
      { label: "Fact-checking", standard: 26, priority: 37, express: 58 },
      { label: "Red-teaming", standard: 39, priority: 55, express: 86 },
      { label: "Génération", standard: 28, priority: 39, express: 62 },
    ],
  },
];

// Calculator config — base prices in EUR, aligned with priceGrid "Scoring Standard" by domain
type Domain = "medical" | "legal" | "finance" | "code";
type Sla = "standard" | "priority" | "express";

const DOMAINS: { id: Domain; label: string; price: number; Icon: typeof Stethoscope }[] = [
  { id: "medical", label: "Médical", price: 33, Icon: Stethoscope },
  { id: "legal", label: "Juridique", price: 28, Icon: Scale },
  { id: "finance", label: "Finance", price: 28, Icon: TrendingUp },
  { id: "code", label: "Code", price: 23, Icon: Code2 },
];

const SLAS: { id: Sla; label: string; mult: number; desc: string }[] = [
  { id: "standard", label: "Standard", mult: 1.0, desc: "5 jours · α ≥ 0,75 · 2 annotateurs" },
  { id: "priority", label: "Prioritaire", mult: 1.4, desc: "3 jours · α ≥ 0,80 · 2 annotateurs" },
  { id: "express", label: "Express", mult: 2.2, desc: "1-2 jours · α ≥ 0,85 · 3 annotateurs · SLA contractuel" },
];

type Hosting = "standard" | "sovereign";
const HOSTINGS: {
  id: Hosting;
  label: string;
  mult: number;
  Icon: typeof Globe;
  badge: string;
  desc: string;
  bullets: string[];
}[] = [
  {
    id: "standard",
    label: "Standard",
    mult: 1.0,
    Icon: Globe,
    badge: "×1,0",
    desc: "Hébergement UE multi-LLM",
    bullets: ["Centres de données UE", "Multi-modèles (GPT, Claude, Gemini)", "Conforme RGPD"],
  },
  {
    id: "sovereign",
    label: "Souverain",
    mult: 1.2,
    Icon: Shield,
    badge: "×1,2",
    desc: "100% France · Mistral",
    bullets: ["Inférence Mistral France", "Données médicales / défense", "Conforme HDS · SecNumCloud"],
  },
];

const SLA_DELIVERY: Record<Sla, string> = {
  standard: "5 jours",
  priority: "3 jours",
  express: "1-2 jours",
};

const formatEUR = (n: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n));

function getVolumeDiscount(volume: number) {
  if (volume >= 5000) return { pct: 20, label: "Remise volume −20%" };
  if (volume >= 2000) return { pct: 15, label: "Remise volume −15%" };
  if (volume >= 1000) return { pct: 10, label: "Remise volume −10%" };
  if (volume >= 500) return { pct: 5, label: "Remise volume −5%" };
  return { pct: 0, label: "Aucune remise volume" };
}

function roundToHundred(n: number) {
  return Math.round(n / 100) * 100;
}

// Quote request modal
const QuoteModal = ({ plan, onClose }: { plan: string; onClose: () => void }) => {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    domain: "",
    estimated_volume: "",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.company) return;
    setLoading(true);
    try {
      await supabase.from("quote_requests").insert({
        ...form,
        plan,
      });
      setSent(true);
    } catch {
      toast.error("Erreur lors de l'envoi. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="bg-card border border-border rounded-2xl p-6 sm:p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground">Demander un devis</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {sent ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
              <Check className="w-6 h-6 text-success" />
            </div>
            <p className="text-foreground font-medium mb-1">Merci.</p>
            <p className="text-muted-foreground text-sm">Nous vous répondons sous 24 heures.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              Plan sélectionné : <span className="text-foreground font-medium">{plan}</span>
            </p>
            <div>
              <label className="text-sm text-foreground mb-1 block">Nom *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full h-11 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-sm text-foreground mb-1 block">Email professionnel *</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full h-11 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-sm text-foreground mb-1 block">Entreprise *</label>
              <input
                required
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="w-full h-11 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-foreground mb-1 block">Domaine</label>
                <select
                  value={form.domain}
                  onChange={(e) => setForm({ ...form, domain: e.target.value })}
                  className="w-full h-11 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Sélectionner</option>
                  <option value="medical">Médecine</option>
                  <option value="legal">Droit</option>
                  <option value="finance">Finance</option>
                  <option value="code">Code</option>
                  <option value="multiple">Plusieurs domaines</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-foreground mb-1 block">Volume estimé</label>
                <select
                  value={form.estimated_volume}
                  onChange={(e) => setForm({ ...form, estimated_volume: e.target.value })}
                  className="w-full h-11 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Sélectionner</option>
                  <option value="<500">{"< 500 tâches"}</option>
                  <option value="500-2000">500 – 2 000</option>
                  <option value="2000-5000">2 000 – 5 000</option>
                  <option value="5000-10000">5 000 – 10 000</option>
                  <option value="10000+">10 000+</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm text-foreground mb-1 block">Message (optionnel)</label>
              <textarea
                rows={3}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <Button type="submit" className="w-full h-12 sm:h-10" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Envoyer la demande
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Nous vous répondons sous 24 heures.
            </p>
          </form>
        )}
      </motion.div>
    </motion.div>
  );
};

export const PricingSection = () => {
  const [gridOpen, setGridOpen] = useState(false);
  const [quoteModal, setQuoteModal] = useState<string | null>(null);

  // Calculator state
  const [domain, setDomain] = useState<Domain>("medical");
  const [volume, setVolume] = useState(500);
  const [sla, setSla] = useState<Sla>("standard");
  const [hosting, setHosting] = useState<Hosting>("standard");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const calc = useMemo(() => {
    const d = DOMAINS.find((x) => x.id === domain)!;
    const s = SLAS.find((x) => x.id === sla)!;
    const h = HOSTINGS.find((x) => x.id === hosting)!;
    const discount = getVolumeDiscount(volume);
    const total = d.price * volume * s.mult * h.mult * (1 - discount.pct / 100);
    const low = roundToHundred(total * 0.92);
    const high = roundToHundred(total * 1.08);
    return {
      basePrice: d.price,
      multSla: s.mult,
      multMode: h.mult,
      discountPct: discount.pct,
      discountLabel: discount.label,
      total,
      low,
      high,
    };
  }, [domain, volume, sla, hosting]);

  const handleSubmitEmail = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Email invalide");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("submit-pricing-lead", {
        body: {
          email: email.trim(),
          domain,
          volume,
          sla,
          mode: hosting,
          estimatedLow: calc.low,
          estimatedHigh: calc.high,
          basePrice: calc.basePrice,
          multSla: calc.multSla,
          multMode: calc.multMode,
          discountPct: calc.discountPct,
        },
      });
      if (error) throw error;
      toast.success("Devis envoyé ! Vérifiez votre boîte mail.");
      setEmailDialogOpen(false);
      setEmail("");
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de l'envoi");
    } finally {
      setSubmitting(false);
    }
  };

  // On mobile, show Prioritaire first
  const mobileOrderedPlans = [plans[1], plans[0], plans[2]];

  return (
    <section id="pricing" className="py-24 lg:py-32 px-4 sm:px-8 lg:px-4 border-t border-border">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-foreground mb-4">Tarification transparente</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Trois plans selon votre SLA. Estimateur en bas de section pour votre cas précis.
          </p>
        </motion.div>

        {/* Mobile: stacked, Prioritaire first */}
        <div className="flex flex-col gap-6 md:hidden">
          {mobileOrderedPlans.map((plan, i) => (
            <PlanCard key={plan.name} plan={plan} index={i} onQuote={setQuoteModal} />
          ))}
        </div>

        {/* Desktop: 3 columns */}
        <div className="hidden md:grid md:grid-cols-3 gap-6 items-start">
          {plans.map((plan, i) => (
            <PlanCard key={plan.name} plan={plan} index={i} onQuote={setQuoteModal} />
          ))}
        </div>

        {/* Info line */}
        <p className="text-center mt-12 text-[13px] text-muted-foreground max-w-2xl mx-auto">
          Remises volume disponibles dès 500 tâches. Le prix varie selon le domaine et le type de tâche. Conditions de paiement : 50% à la commande, 50% à la livraison.
        </p>

        {/* Integrated Calculator */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mt-16 pt-16 border-t border-border"
        >
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="inline-block text-xs uppercase tracking-wider text-primary font-medium mb-3">
              Estimateur
            </span>
            <h3 className="text-foreground text-2xl md:text-3xl font-semibold mb-3">
              Estimez votre projet en 30 secondes
            </h3>
            <p className="text-muted-foreground text-sm md:text-base">
              Pricing transparent, sans engagement. Devis détaillé envoyé par email.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
            {/* Controls */}
            <div className="lg:col-span-3 flex flex-col gap-4">
              {/* Domain */}
              <div className="bg-card border border-border rounded-xl p-6">
                <Label className="text-foreground text-sm font-medium mb-4 block">Domaine</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {DOMAINS.map((d) => {
                    const selected = d.id === domain;
                    return (
                      <button
                        key={d.id}
                        onClick={() => setDomain(d.id)}
                        className={cn(
                          "flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors",
                          selected
                            ? "bg-primary/10 border-primary text-foreground"
                            : "bg-background border-border text-muted-foreground hover:border-muted-foreground/40"
                        )}
                      >
                        <d.Icon className="w-5 h-5" />
                        <span className="text-sm font-medium">{d.label}</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {d.price} €
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Volume */}
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-baseline justify-between mb-4">
                  <Label className="text-foreground text-sm font-medium">
                    Nombre de tâches : <strong className="text-foreground font-semibold">{volume.toLocaleString("fr-FR")}</strong>
                  </Label>
                  <span className="text-xs text-muted-foreground font-mono">50 → 5 000</span>
                </div>
                <Slider
                  value={[volume]}
                  onValueChange={(v) => setVolume(v[0])}
                  min={50}
                  max={5000}
                  step={50}
                  className="mb-3"
                />
                <p className="text-sm text-primary">{calc.discountLabel}</p>
              </div>

              {/* SLA */}
              <div className="bg-card border border-border rounded-xl p-6">
                <Label className="text-foreground text-sm font-medium mb-4 block">Niveau de service</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {SLAS.map((s) => {
                    const selected = s.id === sla;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setSla(s.id)}
                        className={cn(
                          "text-left p-4 rounded-lg border transition-colors",
                          selected
                            ? "border-primary bg-primary/10"
                            : "border-border bg-background hover:border-muted-foreground/40"
                        )}
                      >
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="text-foreground font-medium text-sm">{s.label}</span>
                          <span className="text-xs text-muted-foreground font-mono">×{s.mult.toFixed(1)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Hosting */}
              <div className="bg-card border border-border rounded-xl p-6">
                <Label className="text-foreground text-sm font-medium mb-4 block">
                  Mode d'hébergement
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {HOSTINGS.map((h) => {
                    const selected = h.id === hosting;
                    return (
                      <button
                        key={h.id}
                        onClick={() => setHosting(h.id)}
                        className={cn(
                          "text-left p-4 rounded-lg border transition-colors",
                          selected
                            ? "border-primary bg-primary/10"
                            : "border-border bg-background hover:border-muted-foreground/40"
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <h.Icon
                              className={cn(
                                "w-4 h-4",
                                selected ? "text-primary" : "text-muted-foreground"
                              )}
                            />
                            <span className="text-foreground font-medium text-sm">{h.label}</span>
                          </div>
                          <span className="text-xs text-muted-foreground font-mono">{h.badge}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2 leading-relaxed">{h.desc}</p>
                        <ul className="space-y-1">
                          {h.bullets.map((b) => (
                            <li
                              key={b}
                              className="text-[11px] text-muted-foreground flex items-start gap-1.5"
                            >
                              <Check className="w-3 h-3 text-emerald-500 flex-shrink-0 mt-0.5" />
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Result card */}
            <div className="lg:col-span-2">
              <div className="lg:sticky lg:top-24 bg-gradient-to-br from-primary/10 to-card border border-primary/30 rounded-2xl p-6 sm:p-8">
                <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">Estimation</p>
                <div className="flex items-baseline gap-2 mb-3 flex-wrap">
                  <span className="text-3xl md:text-4xl font-semibold text-foreground">
                    {formatEUR(calc.low)} – {formatEUR(calc.high)} €
                  </span>
                  <span className="text-base text-muted-foreground">HT</span>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  Hors TVA · {volume.toLocaleString("fr-FR")} tâches · livraison sous {SLA_DELIVERY[sla]}
                </p>

                <ul className="space-y-1.5 text-sm text-muted-foreground mb-6">
                  <li className="flex justify-between gap-2">
                    <span>Prix de base</span>
                    <span className="font-mono text-foreground/80">{calc.basePrice} € × {volume.toLocaleString("fr-FR")}</span>
                  </li>
                  <li className="flex justify-between gap-2">
                    <span>SLA {SLAS.find((s) => s.id === sla)?.label}</span>
                    <span className="font-mono text-foreground/80">×{calc.multSla.toFixed(1)}</span>
                  </li>
                  <li className="flex justify-between gap-2">
                    <span>Mode {hosting === "sovereign" ? "souverain" : "standard"}</span>
                    <span className="font-mono text-foreground/80">×{calc.multMode.toFixed(2)}</span>
                  </li>
                  {calc.discountPct > 0 && (
                    <li className="flex justify-between gap-2">
                      <span>Remise volume</span>
                      <span className="font-mono text-primary">−{calc.discountPct}%</span>
                    </li>
                  )}
                </ul>

                <Separator className="bg-border mb-6" />

                <div className="flex flex-col gap-3">
                  <Button
                    onClick={() => setEmailDialogOpen(true)}
                    className="w-full"
                  >
                    <Mail className="w-4 h-4" />
                    Recevoir le devis par email
                  </Button>
                  <DemoDialog
                    trigger={
                      <Button variant="outline" className="w-full border-primary/30 hover:bg-primary/10">
                        <Calendar className="w-4 h-4" />
                        Réserver une démo
                      </Button>
                    }
                  />
                </div>

                <p className="text-xs text-muted-foreground italic mt-6 leading-relaxed">
                  Estimation indicative. Devis ferme après cadrage du dataset et des dimensions de scoring.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Collapsible price grid */}
        <div className="mt-10 text-center">
          <button
            onClick={() => setGridOpen(!gridOpen)}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
          >
            Voir la grille complète par domaine
            <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", gridOpen && "rotate-180")} />
          </button>

          <AnimatePresence>
            {gridOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-6 border border-border rounded-xl overflow-x-auto bg-card">
                  <table className="w-full text-left min-w-[500px]">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider" />
                        <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Standard</th>
                        <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right bg-primary/[0.03]">Prioritaire</th>
                        <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Express</th>
                      </tr>
                    </thead>
                    <tbody>
                      {priceGrid.map((group) => (
                        <>
                          <tr key={group.domain} className="border-b border-border bg-muted/30">
                            <td colSpan={4} className="px-4 py-2 text-sm font-semibold text-foreground">
                              {group.domain}
                            </td>
                          </tr>
                          {group.rows.map((row) => (
                            <tr key={`${group.domain}-${row.label}`} className="border-b border-border last:border-b-0">
                              <td className="px-4 py-2 text-sm text-muted-foreground pl-8">{row.label}</td>
                              <td className="px-4 py-2 text-sm text-right font-mono">
                                {row.standard} €
                              </td>
                              <td className="px-4 py-2 text-sm text-right bg-primary/[0.03] font-mono">
                                {row.priority} €
                              </td>
                              <td className="px-4 py-2 text-sm text-right font-mono">
                                {row.express} €
                              </td>
                            </tr>
                          ))}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Quote modal (from cards) */}
      <AnimatePresence>
        {quoteModal && <QuoteModal plan={quoteModal} onClose={() => setQuoteModal(null)} />}
      </AnimatePresence>

      {/* Email dialog (from calculator) */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recevoir le devis par email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Nous vous envoyons le détail de cette estimation ({formatEUR(calc.low)} – {formatEUR(calc.high)} € HT) avec tous les paramètres choisis.
            </p>
            <div>
              <Label htmlFor="quote-email" className="mb-2 block">Email professionnel</Label>
              <Input
                id="quote-email"
                type="email"
                placeholder="vous@entreprise.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !submitting && handleSubmitEmail()}
                disabled={submitting}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEmailDialogOpen(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmitEmail}
              disabled={submitting || !email}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};

function PlanCard({ plan, index, onQuote }: { plan: typeof plans[0]; index: number; onQuote: (name: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className={cn(
        "relative rounded-2xl border p-6 sm:p-8 transition-all",
        plan.highlighted
          ? "border-primary/50 bg-card shadow-[0_0_40px_rgba(123,111,240,0.08)] md:scale-[1.02] z-10"
          : "border-border bg-card hover:border-primary/20"
      )}
    >
      {plan.badge && (
        <div className="absolute -top-3 left-6 text-xs font-medium text-primary-foreground bg-primary px-3 py-0.5 rounded-full">
          {plan.badge}
        </div>
      )}
      <h3 className="text-foreground text-lg font-semibold mb-4">{plan.name}</h3>
      <div className="mb-6">
        <span className="text-xs text-muted-foreground block mb-1">À partir de</span>
        <div className="flex items-baseline gap-1.5">
          <span className="text-5xl font-bold text-foreground font-mono">
            {plan.price}
          </span>
          <span className="text-sm text-muted-foreground">€ / tâche</span>
        </div>
        <span className="text-xs text-[#7B6FF0] font-mono mt-2 block">
          Enveloppe : {plan.envelope}
        </span>
      </div>
      <div className="space-y-3 mb-8">
        {plan.features.map((f) => (
          <div key={f} className="flex items-start gap-2.5 text-sm text-muted-foreground">
            <Check className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
            {f}
          </div>
        ))}
      </div>
      <Button
        variant={plan.highlighted ? "default" : "outline"}
        className="w-full h-12 sm:h-10"
        onClick={() => onQuote(plan.name)}
      >
        Demander un devis
      </Button>
    </motion.div>
  );
}
