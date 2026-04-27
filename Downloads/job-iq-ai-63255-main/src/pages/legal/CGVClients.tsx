import { RLHFNavbar } from "@/components/RLHFNavbar";
import { RLHFFooter } from "@/components/RLHFFooter";
import { SEO } from "@/components/SEO";

const LAST_UPDATED = "29 mars 2026";

export default function CGVClients() {
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="CGV Clients — STEF"
        description="Conditions générales de vente pour les clients de la plateforme STEF RLHF-as-a-Service."
        path="/legal/cgv-clients"
      />
      <RLHFNavbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-24">
        <p className="text-xs text-muted-foreground mb-2">Dernière mise à jour : {LAST_UPDATED} — Version 1.0</p>
        <h1 className="text-3xl font-bold tracking-tight mb-10">
          Conditions Générales de Vente — Clients
        </h1>

        <div className="prose prose-neutral dark:prose-invert max-w-none text-[15px] leading-relaxed space-y-8">

          <section>
            <h2>Article 1 — Objet</h2>
            <p>
              STEF SAS (ci-après « STEF ») fournit un service de production de datasets annotés par des experts humains certifiés, destinés à l'entraînement, l'évaluation et l'alignement de modèles d'intelligence artificielle.
            </p>
            <p>
              Les présentes Conditions Générales de Vente (ci-après « les CGV ») régissent la relation commerciale entre STEF et toute personne morale utilisant ses services (ci-après « le Client »). Toute commande implique l'acceptation pleine et entière des présentes CGV.
            </p>
          </section>

          <section>
            <h2>Article 2 — Définitions</h2>
            <p>Les termes définis dans les CGU Experts s'appliquent aux présentes CGV. En complément :</p>
            <ul>
              <li><strong>Services</strong> : l'ensemble des prestations d'annotation fournies par STEF dans le cadre d'un Projet.</li>
              <li><strong>SLA</strong> : niveaux de service définis (Standard, Prioritaire, Express) déterminant les engagements de qualité et de délai.</li>
              <li><strong>Livrable</strong> : le Dataset annoté livré au Client à l'issue d'un Projet.</li>
            </ul>
          </section>

          <section>
            <h2>Article 3 — Commande</h2>
            <p>
              Le Client crée un Projet via le dashboard de la Plateforme ou via l'API STEF. Chaque Projet est configuré avec un domaine d'expertise, un type de tâche, un volume de données, une langue et un niveau de SLA.
            </p>
            <p>
              Le Client uploade les données à annoter (prompts et/ou réponses de modèles). Après validation automatique des données et confirmation par le Client, le Projet est considéré comme commandé. La confirmation engage le Client sur le volume de Tâches validé.
            </p>
          </section>

          <section>
            <h2>Article 4 — Tarification et paiement</h2>
            <p>
              La tarification est basée sur le nombre de Tâches, le domaine d'expertise, le type de tâche, la langue et le niveau de SLA choisi. Des remises volume progressives s'appliquent selon les paliers en vigueur, consultables sur la Plateforme.
            </p>
            <p>Les conditions de paiement sont les suivantes :</p>
            <ul>
              <li>Pour les projets d'un montant supérieur ou égal à 5 000 USD : <strong>40%</strong> à la confirmation du projet, <strong>30%</strong> à l'atteinte de 50% d'avancement, et <strong>30%</strong> à la livraison du dataset final.</li>
              <li>Pour les projets d'un montant inférieur à 5 000 USD : <strong>50%</strong> à la confirmation du projet et <strong>50%</strong> à la livraison du dataset final.</li>
            </ul>
            <p>
              L'exécution du projet ne débute qu'après réception de l'acompte. En cas de non-paiement du paiement intermédiaire ou du solde final dans un délai de sept (7) jours après son exigibilité, STEF se réserve le droit de suspendre l'exécution du projet.
            </p>
            <p>
              Les prix sont indiqués en USD, hors taxes. Le règlement s'effectue par virement bancaire sur le compte indiqué sur la facture, en mentionnant obligatoirement le numéro de facture comme référence. Le projet ne débute qu'après réception effective du virement sur le compte de STEF SAS.
            </p>
            <p>
              En cas de retard de paiement : pénalités de retard au taux légal majoré de trois (3) points, exigibles de plein droit sans mise en demeure préalable, et indemnité forfaitaire de recouvrement de quarante (40) euros conformément à l'article D.441-5 du Code de commerce.
            </p>
          </section>

          <section>
            <h2>Article 5 — SLA et engagements de qualité</h2>
            <p>
              STEF s'engage sur un niveau de qualité minimum mesuré par le coefficient Alpha de Krippendorff moyen du Projet. Trois niveaux de SLA sont proposés :
            </p>
            <ul>
              <li><strong>Standard</strong> : α ≥ 0,75, livraison dans le délai estimé, deux annotateurs par tâche. Prix de base.</li>
              <li><strong>Prioritaire</strong> : α ≥ 0,80, livraison accélérée (×0,7 du délai standard), deux annotateurs par tâche. Prix majoré de 30 %.</li>
              <li><strong>Express</strong> : α ≥ 0,85, livraison rapide (×0,4 du délai standard), trois annotateurs par tâche. Prix majoré de 80 %.</li>
            </ul>
            <p>
              Le délai de livraison communiqué est une estimation fondée sur la capacité disponible au moment de la commande. En cas de dépassement de plus de cinquante pour cent (50 %) du délai estimé pour une raison imputable à STEF, le Client bénéficie d'une remise de dix pour cent (10 %) sur le montant du Projet concerné.
            </p>
            <p>
              Si le coefficient Alpha moyen final du Projet est inférieur au seuil garanti par le SLA choisi, STEF s'engage à ré-annoter les Tâches défaillantes sans frais supplémentaires pour le Client.
            </p>
          </section>

          <section>
            <h2>Article 6 — Propriété intellectuelle</h2>
            <p>
              Les données uploadées par le Client (prompts, réponses de modèles, instructions) restent la propriété exclusive du Client. Le Client garantit qu'il dispose de tous les droits nécessaires sur les données qu'il fournit à STEF.
            </p>
            <p>
              Les annotations produites dans le cadre du Projet sont cédées au Client à la livraison et au paiement complet du Projet. STEF conserve le droit d'utiliser les annotations de manière anonymisée et agrégée exclusivement à des fins d'amélioration de ses systèmes internes de contrôle qualité, sans possibilité de revente à des tiers.
            </p>
          </section>

          <section>
            <h2>Article 7 — Confidentialité</h2>
            <p>
              STEF s'engage à traiter les données du Client de manière strictement confidentielle. Les données d'un Client ne sont jamais partagées avec d'autres Clients. Les Experts n'ont accès qu'aux données strictement nécessaires à l'exécution de leurs Tâches.
            </p>
            <p>
              Les données sont soumises à un scan automatique de données à caractère personnel (PII scan) et anonymisées avant d'être soumises aux Experts pour annotation. STEF peut signer un accord de confidentialité (NDA) spécifique à la demande du Client.
            </p>
            <p>
              Cette obligation de confidentialité survit à la fin de la relation contractuelle pendant une durée de cinq (5) ans.
            </p>
          </section>

          <section>
            <h2>Article 8 — Protection des données personnelles</h2>
            <p>
              Lorsque les données uploadées par le Client contiennent des données à caractère personnel, STEF agit en qualité de sous-traitant au sens du Règlement (UE) 2016/679 (RGPD). Un accord de sous-traitance (Data Processing Agreement) est disponible sur demande.
            </p>
            <p>
              Les données sont hébergées en Union européenne (infrastructure Supabase Cloud EU). STEF ne transfère pas de données hors de l'Union européenne, sauf instruction écrite et explicite du Client. En cas de violation de données à caractère personnel, STEF notifie le Client dans un délai de soixante-douze (72) heures.
            </p>
          </section>

          <section>
            <h2>Article 9 — Sécurité</h2>
            <p>STEF met en œuvre les mesures de sécurité suivantes :</p>
            <ul>
              <li>Hébergement en Union européenne avec chiffrement au repos et en transit ;</li>
              <li>Isolation des données clients par Row Level Security ;</li>
              <li>Scan PII automatique avant annotation ;</li>
              <li>Content Security Policy et en-têtes de sécurité HTTP ;</li>
              <li>Journaux d'audit sur toutes les opérations sensibles ;</li>
              <li>Absence de recours à la reconnaissance faciale ou aux données biométriques.</li>
            </ul>
          </section>

          <section>
            <h2>Article 10 — Livraison et recette</h2>
            <p>
              Le Dataset annoté est livré au Client via le dashboard de la Plateforme (téléchargement) ou via l'API. Les formats de livraison disponibles sont : JSONL, Parquet et HuggingFace Datasets.
            </p>
            <p>
              Le Client dispose d'un délai de quatorze (14) jours calendaires à compter de la livraison pour signaler tout défaut de qualité. Passé ce délai, le Livrable est réputé accepté sans réserve. En cas de défaut signalé dans les délais, STEF s'engage à corriger ou ré-annoter les items concernés dans un délai raisonnable.
            </p>
          </section>

          <section>
            <h2>Article 11 — Résiliation</h2>
            <p>
              Le Client peut annuler un Projet en statut « brouillon » sans frais. Pour un Projet en cours (« actif »), l'annulation entraîne la facturation de l'ensemble des Tâches déjà complétées et validées.
            </p>
            <p>
              STEF peut suspendre un Projet en cas de non-paiement, après une relance restée sans effet pendant quinze (15) jours. Chaque partie peut résilier la relation contractuelle avec un préavis écrit de trente (30) jours.
            </p>
          </section>

          <section>
            <h2>Article 12 — Limitation de responsabilité</h2>
            <p>
              La responsabilité totale de STEF au titre d'un Projet est limitée au montant effectivement payé par le Client pour ledit Projet. STEF ne saurait être tenue responsable des dommages indirects, y compris mais sans s'y limiter la perte de profit, la perte de données, le préjudice d'image ou le manque à gagner.
            </p>
            <p>
              Les annotations fournies représentent le jugement d'experts humains et sont accompagnées de métriques de fiabilité statistique. STEF ne garantit pas que les annotations sont exemptes de toute erreur.
            </p>
          </section>

          <section>
            <h2>Article 13 — Force majeure</h2>
            <p>
              Aucune partie ne sera tenue responsable de l'inexécution de ses obligations si cette inexécution résulte d'un cas de force majeure au sens de l'article 1218 du Code civil, notamment en cas de catastrophe naturelle, pandémie, guerre, grève générale, panne majeure d'infrastructure, ou décision des autorités publiques.
            </p>
          </section>

          <section>
            <h2>Article 14 — Droit applicable et juridiction</h2>
            <p>
              Les présentes CGV sont régies par le droit français. En cas de litige, les parties s'engagent à rechercher une solution amiable pendant un délai de trente (30) jours. À défaut d'accord amiable, le litige sera soumis au Tribunal de Commerce de Paris.
            </p>
          </section>

        </div>
      </main>

      <RLHFFooter />
    </div>
  );
}
