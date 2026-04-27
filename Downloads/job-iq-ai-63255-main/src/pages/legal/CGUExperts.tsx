import { RLHFNavbar } from "@/components/RLHFNavbar";
import { RLHFFooter } from "@/components/RLHFFooter";
import { SEO } from "@/components/SEO";

const LAST_UPDATED = "29 mars 2026";

export default function CGUExperts() {
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="CGU Experts — STEF"
        description="Conditions générales d'utilisation pour les experts annotateurs de la plateforme STEF."
        path="/legal/cgu-experts"
      />
      <RLHFNavbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-24">
        <p className="text-xs text-muted-foreground mb-2">Dernière mise à jour : {LAST_UPDATED} — Version 1.0</p>
        <h1 className="text-3xl font-bold tracking-tight mb-10">
          Conditions Générales d'Utilisation — Experts
        </h1>

        <div className="prose prose-neutral dark:prose-invert max-w-none text-[15px] leading-relaxed space-y-8">

          <section>
            <h2>Article 1 — Objet</h2>
            <p>
              STEF (ci-après « la Plateforme ») est un service en ligne édité par STEF SAS, accessible à l'adresse steftalent.fr, qui permet à des experts certifiés (ci-après « les Experts ») d'effectuer des tâches d'annotation de données d'intelligence artificielle pour le compte de clients tiers.
            </p>
            <p>
              Les présentes Conditions Générales d'Utilisation (ci-après « les CGU ») régissent la relation entre STEF et l'Expert. Toute inscription sur la Plateforme implique l'acceptation pleine et entière des présentes CGU.
            </p>
          </section>

          <section>
            <h2>Article 2 — Définitions</h2>
            <ul>
              <li><strong>Plateforme</strong> : le site steftalent.fr et l'ensemble de ses services associés (dashboard, API, applications mobiles le cas échéant).</li>
              <li><strong>Expert</strong> : toute personne physique inscrite sur la Plateforme en qualité d'annotateur.</li>
              <li><strong>Client</strong> : toute personne morale qui commande des services d'annotation via la Plateforme.</li>
              <li><strong>Tâche</strong> : unité de travail d'annotation assignée à un Expert (scoring, préférence, vérification factuelle ou red-teaming).</li>
              <li><strong>Projet</strong> : ensemble de Tâches commandé par un Client dans un domaine et un type donnés.</li>
              <li><strong>Certification</strong> : validation des compétences de l'Expert dans un domaine spécifique, obtenue après réussite d'un assessment sur la Plateforme.</li>
              <li><strong>Dataset</strong> : ensemble de données annotées produites dans le cadre d'un Projet.</li>
            </ul>
          </section>

          <section>
            <h2>Article 3 — Inscription et certification</h2>
            <p>
              L'inscription sur la Plateforme est gratuite et ouverte à toute personne physique majeure. L'Expert s'engage à fournir des informations exactes et à jour lors de son inscription.
            </p>
            <p>
              L'accès aux Tâches d'annotation est conditionné à la réussite d'un assessment de certification dans au moins un domaine d'expertise parmi les suivants : médical, juridique, finance ou code. La certification comprend trois phases : un questionnaire à choix multiples, une évaluation d'une réponse IA, et un test d'annotation en conditions réelles.
            </p>
            <p>
              STEF se réserve le droit de refuser une inscription ou de révoquer une certification à tout moment, sans obligation de motivation. La certification est valable douze (12) mois à compter de sa date d'obtention et peut être renouvelée par le passage d'un nouvel assessment.
            </p>
          </section>

          <section>
            <h2>Article 4 — Statut de l'Expert</h2>
            <p>
              L'Expert intervient en qualité de prestataire indépendant. Il n'existe aucun lien de subordination entre STEF et l'Expert. L'Expert est seul responsable de ses obligations fiscales et sociales, notamment la déclaration de ses revenus et le paiement des cotisations afférentes.
            </p>
            <p>
              L'Expert est libre d'accepter ou de refuser les Tâches qui lui sont proposées, sans pénalité. L'Expert peut exercer son activité pour d'autres plateformes ou clients, y compris concurrents de STEF.
            </p>
          </section>

          <section>
            <h2>Article 5 — Obligations de l'Expert</h2>
            <p>L'Expert s'engage à :</p>
            <ul>
              <li>Réaliser les Tâches d'annotation avec diligence, professionnalisme et dans le respect des consignes fournies pour chaque Projet ;</li>
              <li>Consacrer un temps raisonnable à chaque Tâche et fournir un raisonnement justifié pour chaque annotation ;</li>
              <li>Ne pas utiliser d'outils d'intelligence artificielle (ChatGPT, Claude, Gemini, etc.) pour remplir les annotations à sa place, sauf autorisation explicite dans les consignes du Projet ;</li>
              <li>Ne pas copier-coller le même raisonnement sur plusieurs Tâches distinctes ;</li>
              <li>Respecter la confidentialité des données Client conformément à l'Article 7 ;</li>
              <li>Maintenir un niveau de qualité suffisant, mesuré par le score de confiance et le coefficient Alpha de Krippendorff.</li>
            </ul>
          </section>

          <section>
            <h2>Article 6 — Rémunération</h2>
            <p>
              L'Expert est rémunéré à la Tâche selon la grille tarifaire en vigueur, consultable sur la Plateforme. La rémunération varie selon le domaine d'expertise et le type de Tâche.
            </p>
            <p>
              STEF se réserve le droit de modifier la grille tarifaire avec un préavis de trente (30) jours calendaires. Le paiement est effectué via Stripe Connect vers le compte bancaire renseigné par l'Expert. Le montant minimum de retrait est fixé à cinquante (50) USD ou EUR. Les paiements automatiques sont effectués tous les quinze (15) jours lorsque le solde disponible atteint le montant minimum.
            </p>
            <p>
              Une Tâche n'est rémunérée que si elle satisfait au contrôle qualité automatisé de la Plateforme (QA). En cas de fraude avérée, STEF se réserve le droit de retenir les paiements en cours et d'exiger le remboursement des sommes indûment versées.
            </p>
          </section>

          <section>
            <h2>Article 7 — Confidentialité et propriété intellectuelle</h2>
            <p>
              L'Expert s'engage à ne pas divulguer, copier, stocker localement ou transmettre à des tiers les données auxquelles il a accès dans le cadre de l'exécution de ses Tâches. Les données des Clients (prompts, réponses de modèles, instructions) sont strictement confidentielles.
            </p>
            <p>
              Il est interdit à l'Expert de prendre des captures d'écran des données Client, de discuter du contenu des Tâches sur les réseaux sociaux, forums, ou tout autre espace public ou privé.
            </p>
            <p>
              Les annotations produites par l'Expert sont la propriété de STEF et/ou du Client commanditaire. L'Expert cède à STEF, de manière irrévocable et à titre exclusif, l'ensemble des droits de propriété intellectuelle portant sur ses annotations dès leur soumission sur la Plateforme.
            </p>
            <p>
              Cette obligation de confidentialité survit à la fin de la relation contractuelle pendant une durée de trois (3) ans.
            </p>
          </section>

          <section>
            <h2>Article 8 — Contrôle qualité et sanctions</h2>
            <p>
              STEF utilise un système automatisé de contrôle qualité reposant sur l'adjudication multi-annotateurs et le coefficient Alpha de Krippendorff. L'Expert dispose d'un score de confiance (<em>trust score</em>) calculé en continu sur la base de la qualité, la rapidité et la cohérence de ses annotations.
            </p>
            <p>En cas de qualité insuffisante ou de comportement suspect, les sanctions suivantes s'appliquent de manière graduelle :</p>
            <ul>
              <li><strong>Premier avertissement</strong> : notification par email, réduction du score de confiance.</li>
              <li><strong>Deuxième incident dans les 30 jours</strong> : suspension temporaire de sept (7) jours.</li>
              <li><strong>Troisième incident dans les 60 jours</strong> : suspension de trente (30) jours.</li>
              <li><strong>Comportement frauduleux grave</strong> : exclusion définitive de la Plateforme et retenue des paiements en cours.</li>
            </ul>
            <p>
              L'Expert peut contester une sanction en adressant un email motivé à support@steftalent.fr dans un délai de sept (7) jours calendaires suivant la notification de la sanction.
            </p>
          </section>

          <section>
            <h2>Article 9 — Résiliation</h2>
            <p>
              L'Expert peut supprimer son compte à tout moment depuis les paramètres de la Plateforme. Les Tâches en cours au moment de la résiliation seront réassignées à d'autres Experts. Le solde disponible sera versé dans les trente (30) jours suivant la résiliation effective du compte.
            </p>
            <p>
              STEF peut résilier le compte d'un Expert à tout moment en cas de violation des présentes CGU, avec ou sans préavis selon la gravité de la violation.
            </p>
          </section>

          <section>
            <h2>Article 10 — Protection des données personnelles</h2>
            <p>
              Les modalités de collecte et de traitement des données personnelles de l'Expert sont décrites dans la <a href="/legal/confidentialite" className="text-primary hover:underline">Politique de Confidentialité</a> de STEF, accessible à l'adresse steftalent.fr/legal/confidentialite.
            </p>
            <p>
              STEF collecte les données nécessaires à l'inscription, à la certification, à l'exécution des Tâches et au paiement. La base légale de ces traitements est l'exécution du contrat (Article 6.1.b du RGPD).
            </p>
          </section>

          <section>
            <h2>Article 11 — Responsabilité</h2>
            <p>
              STEF ne garantit pas un volume minimum de Tâches ni un revenu minimum à l'Expert. La Plateforme est fournie « en l'état », sans garantie d'aucune sorte quant à sa disponibilité ou à l'absence d'erreurs.
            </p>
            <p>
              STEF ne saurait être tenue responsable des erreurs commises par l'Expert dans l'exécution de ses annotations, ni des conséquences directes ou indirectes qui pourraient en résulter.
            </p>
          </section>

          <section>
            <h2>Article 12 — Droit applicable et juridiction</h2>
            <p>
              Les présentes CGU sont régies par le droit français. En cas de litige relatif à l'interprétation ou à l'exécution des présentes, les parties s'engagent à rechercher une solution amiable. À défaut d'accord amiable dans un délai de trente (30) jours, le litige sera soumis aux tribunaux compétents de Paris.
            </p>
          </section>

        </div>
      </main>

      <RLHFFooter />
    </div>
  );
}
