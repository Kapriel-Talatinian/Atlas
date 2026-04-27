import { RLHFNavbar } from "@/components/RLHFNavbar";
import { RLHFFooter } from "@/components/RLHFFooter";
import { SEO } from "@/components/SEO";

const LAST_UPDATED = "29 mars 2026";

export default function ApiTerms() {
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Conditions d'utilisation de l'API — STEF"
        description="Conditions d'utilisation de l'API STEF pour les clients enterprise."
        path="/legal/api-terms"
      />
      <RLHFNavbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-24">
        <p className="text-xs text-muted-foreground mb-2">Dernière mise à jour : {LAST_UPDATED} — Version 1.0</p>
        <h1 className="text-3xl font-bold tracking-tight mb-10">
          Conditions d'Utilisation de l'API
        </h1>

        <div className="prose prose-neutral dark:prose-invert max-w-none text-[15px] leading-relaxed space-y-8">

          <section>
            <h2>1. Accès à l'API</h2>
            <p>
              L'API STEF est accessible uniquement aux Clients disposant d'un compte entreprise actif sur la Plateforme. L'accès est authentifié par une clé API unique et confidentielle, générée depuis le dashboard Client.
            </p>
            <p>
              Le Client est seul responsable de la sécurité de sa clé API. La clé ne doit en aucun cas être partagée avec des tiers, intégrée dans du code source accessible publiquement, ou stockée de manière non sécurisée.
            </p>
            <p>
              En cas de compromission suspectée de la clé API, le Client doit immédiatement la régénérer depuis son dashboard. L'ancienne clé sera révoquée et cessera de fonctionner.
            </p>
          </section>

          <section>
            <h2>2. Utilisation autorisée</h2>
            <p>L'API STEF peut être utilisée pour :</p>
            <ul>
              <li>Créer et gérer des projets d'annotation ;</li>
              <li>Uploader des données à annoter ;</li>
              <li>Suivre l'avancement des projets et consulter les métriques de qualité ;</li>
              <li>Récupérer les résultats et datasets annotés ;</li>
              <li>Configurer des webhooks pour recevoir des notifications ;</li>
              <li>Consulter la facturation et l'historique des commandes.</li>
            </ul>
          </section>

          <section>
            <h2>3. Utilisation interdite</h2>
            <p>Il est interdit au Client de :</p>
            <ul>
              <li>Tenter d'accéder aux données d'autres Clients ;</li>
              <li>Effectuer du scraping, de la collecte automatisée ou de l'extraction de données au-delà de l'usage normal de l'API ;</li>
              <li>Partager sa clé API avec des tiers non autorisés ;</li>
              <li>Utiliser l'API pour des activités illégales, contraires à l'ordre public ou aux bonnes mœurs ;</li>
              <li>Dépasser intentionnellement et de manière répétée les limites de requêtes (rate limiting) ;</li>
              <li>Tenter d'exploiter des vulnérabilités de sécurité de l'API ou de la Plateforme.</li>
            </ul>
            <p>
              Toute découverte de vulnérabilité de sécurité doit être signalée de manière responsable à <a href="mailto:security@steftalent.fr" className="text-primary hover:underline">security@steftalent.fr</a>.
            </p>
          </section>

          <section>
            <h2>4. Limites de requêtes</h2>
            <p>
              Les limites de requêtes (rate limiting) sont définies selon le plan du Client. Le plan standard autorise cent (100) requêtes par minute. Le plan Enterprise autorise cinq cents (500) requêtes par minute.
            </p>
            <p>
              Le dépassement des limites entraîne un rejet temporaire de la requête avec un code de réponse HTTP 429. Les en-têtes de réponse <code>X-RateLimit-Limit</code>, <code>X-RateLimit-Remaining</code> et <code>X-RateLimit-Reset</code> permettent au Client de gérer sa consommation.
            </p>
            <p>
              Les abus répétés et intentionnels de rate limiting peuvent entraîner une suspension temporaire de l'accès à l'API.
            </p>
          </section>

          <section>
            <h2>5. Disponibilité</h2>
            <p>
              STEF vise une disponibilité de l'API de 99,5 % sur une base mensuelle. Les maintenances planifiées sont annoncées au minimum quarante-huit (48) heures à l'avance par email ou via le dashboard.
            </p>
            <p>
              STEF ne saurait être tenue responsable des interruptions de service liées à ses fournisseurs tiers (Supabase, Stripe), à des cas de force majeure, ou à une utilisation non conforme de l'API par le Client.
            </p>
          </section>

          <section>
            <h2>6. Modifications de l'API</h2>
            <p>
              STEF se réserve le droit de modifier l'API (endpoints, formats de requête et de réponse, paramètres). Les modifications rétrocompatibles peuvent être déployées sans préavis.
            </p>
            <p>
              Les modifications non rétrocompatibles (breaking changes) sont annoncées au minimum soixante (60) jours à l'avance. Les versions d'API obsolètes restent accessibles pendant quatre-vingt-dix (90) jours suivant l'annonce de leur dépréciation.
            </p>
          </section>

          <section>
            <h2>7. Responsabilité</h2>
            <p>
              L'API est fournie « en l'état », sans garantie d'aucune sorte, expresse ou implicite. STEF ne garantit pas l'absence d'erreurs, d'interruptions ou de défauts dans le fonctionnement de l'API. La responsabilité de STEF au titre de l'utilisation de l'API est limitée conformément aux dispositions des Conditions Générales de Vente.
            </p>
          </section>

          <section>
            <h2>8. Droit applicable</h2>
            <p>
              Les présentes conditions sont régies par le droit français. Tout litige sera soumis aux tribunaux compétents de Paris.
            </p>
          </section>

        </div>
      </main>

      <RLHFFooter />
    </div>
  );
}
