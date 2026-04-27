import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  {
    q: "Comment garantissez-vous la qualité des annotations ?",
    a: "Trois mécanismes : (1) certification stricte des annotateurs (3 phases, taux d'échec ~70%), (2) double ou triple annotation avec calcul du Krippendorff α en temps réel, (3) adjudication LLM pour α entre 0,67 et 0,80, revue humaine sénior pour α < 0,67. Chaque livraison s'accompagne d'un rapport qualité signé.",
  },
  {
    q: "Comment fonctionne le POC gratuit ?",
    a: "50 tâches annotées gratuitement, sur vos données réelles, dans le domaine de votre choix. Livraison sous 5 jours ouvrés avec rapport qualité complet. Aucun engagement, aucune carte bancaire requise. Objectif : valider la qualité avant tout engagement budgétaire.",
  },
  {
    q: "Combien coûte un projet type ?",
    a: "L'enveloppe varie de 15 k€ (POC étendu, ~500 tâches) à 250 k€+ (programme annuel, 10 000+ tâches). L'estimateur ci-dessus donne une estimation précise selon domaine, volume et SLA. Devis ferme sous 48h après cadrage.",
  },
  {
    q: "Êtes-vous conformes à l'AI Act et au GDPR ?",
    a: "Oui. Documentation Article 11 de l'AI Act (gouvernance des données d'entraînement, traçabilité, biais), DPA signé pour le GDPR, et audit trail complet par tâche : qui a annoté, quand, avec quelle confiance, et avec quel raisonnement. Mode souverain (Mistral France) disponible pour les données réglementées.",
  },
  {
    q: "Qui détient la propriété des datasets produits ?",
    a: "Vous, à 100%. Annotations, métadonnées, raisonnements — tout vous appartient. STEF n'utilise jamais vos données pour entraîner ses propres modèles ni ne les revend. Clause contractuelle inscrite dans le DPA.",
  },
  {
    q: "Que se passe-t-il si la qualité est sous le SLA ?",
    a: "SLA Express : si l'α moyen est sous le seuil garanti (0,85), nous re-annotons gratuitement les tâches concernées et créditons 15% du montant facturé. SLA Standard et Prioritaire : re-annotation gratuite, sans crédit. Engagement contractuel, pas une promesse marketing.",
  },
];

export const FAQSection = () => {
  return (
    <section id="faq" className="relative py-24 px-4 sm:px-6 border-t border-border">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <span className="inline-block text-xs uppercase tracking-wider text-primary font-medium mb-4">
            Questions fréquentes
          </span>
          <h2 className="text-foreground text-3xl md:text-4xl font-semibold mb-4">
            Les 6 questions qui reviennent
          </h2>
          <p className="text-muted-foreground text-base">
            Qualité, prix, conformité, propriété. Le reste se traite en appel.
          </p>
        </div>

        <Accordion type="single" collapsible className="space-y-2">
          {faqs.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="border border-border rounded-xl px-5 bg-card data-[state=open]:border-primary/30 transition-colors"
            >
              <AccordionTrigger className="text-left text-foreground hover:no-underline py-5 text-base font-medium">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed text-sm pb-5">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <p className="text-center text-sm text-muted-foreground mt-8">
          Une question spécifique ?{" "}
          <a
            href="mailto:contact@steftalent.fr?subject=Question%20STEF"
            className="text-foreground underline-offset-4 hover:text-primary hover:underline transition-colors"
          >
            contact@steftalent.fr
          </a>
        </p>
      </div>
    </section>
  );
};
