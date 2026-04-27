import { RLHFNavbar } from "@/components/RLHFNavbar";
import { RLHFFooter } from "@/components/RLHFFooter";
import { SEO } from "@/components/SEO";

const LAST_UPDATED = "29 mars 2026";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Politique de Confidentialité — STEF"
        description="Politique de confidentialité et protection des données personnelles de la plateforme STEF, conforme au RGPD."
        path="/legal/confidentialite"
      />
      <RLHFNavbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-24">
        <p className="text-xs text-muted-foreground mb-2">Dernière mise à jour : {LAST_UPDATED} — Version 1.0</p>
        <h1 className="text-3xl font-bold tracking-tight mb-10">
          Politique de Confidentialité
        </h1>

        <div className="prose prose-neutral dark:prose-invert max-w-none text-[15px] leading-relaxed space-y-8">

          <section>
            <h2>1. Responsable de traitement</h2>
            <p>
              Le responsable du traitement des données personnelles est STEF SAS (en cours d'immatriculation), dont le siège social est situé en France.
            </p>
            <p>
              Pour toute question relative à la protection de vos données personnelles, vous pouvez contacter notre Délégué à la Protection des Données à l'adresse : <a href="mailto:privacy@steftalent.fr" className="text-primary hover:underline">privacy@steftalent.fr</a>.
            </p>
          </section>

          <section>
            <h2>2. Données collectées</h2>

            <h3>2.1 Données des Experts</h3>
            <ul>
              <li><strong>Données d'identification</strong> : nom, prénom, adresse email, pays de résidence.</li>
              <li><strong>Données de certification</strong> : résultats d'assessment, domaine de certification, date d'obtention et d'expiration.</li>
              <li><strong>Données d'activité</strong> : annotations réalisées, temps passé par tâche, scores de qualité, score de confiance (<em>trust score</em>).</li>
              <li><strong>Données de paiement</strong> : les coordonnées bancaires (IBAN, BIC) sont stockées de manière sécurisée. Seuls l'historique des paiements et les informations nécessaires au virement sont conservés.</li>
              <li><strong>Données de connexion</strong> : adresse IP, user agent, horodatage des connexions.</li>
            </ul>

            <h3>2.2 Données des Clients</h3>
            <ul>
              <li><strong>Données d'identification</strong> : nom du contact, adresse email professionnelle, dénomination sociale de l'entreprise.</li>
              <li><strong>Données commerciales</strong> : projets, volumes commandés, historique de facturation.</li>
              <li><strong>Données de connexion</strong> : adresse IP, user agent, horodatage.</li>
              <li><strong>Données techniques</strong> : clé API (stockée sous forme hashée, non réversible).</li>
            </ul>

            <h3>2.3 Données uploadées par les Clients</h3>
            <p>
              Pour les données uploadées par les Clients dans le cadre de leurs Projets, STEF agit en qualité de sous-traitant au sens du RGPD. Ces données sont soumises à un scan automatique de données à caractère personnel (PII scan) et anonymisées avant d'être soumises aux Experts pour annotation.
            </p>
            <p>
              Les données brutes ne sont conservées que pendant la durée du Projet, augmentée de trente (30) jours. Après ce délai, les données brutes sont supprimées. Seules les annotations anonymisées sont conservées pour les besoins du contrôle qualité interne.
            </p>
          </section>

          <section>
            <h2>3. Bases légales des traitements</h2>
            <ul>
              <li><strong>Exécution du contrat</strong> (Article 6.1.b du RGPD) : inscription, certification, exécution des Tâches, paiement.</li>
              <li><strong>Intérêt légitime</strong> (Article 6.1.f du RGPD) : amélioration du service, détection de fraude, production de statistiques anonymisées.</li>
              <li><strong>Consentement</strong> (Article 6.1.a du RGPD) : envoi d'emails marketing (opt-in uniquement).</li>
              <li><strong>Obligation légale</strong> (Article 6.1.c du RGPD) : facturation, obligations fiscales et comptables.</li>
            </ul>
          </section>

          <section>
            <h2>4. Durées de conservation</h2>
            <ul>
              <li><strong>Données de compte</strong> : durée de la relation contractuelle, augmentée de trois (3) ans.</li>
              <li><strong>Données de paiement et de facturation</strong> : dix (10) ans, conformément aux obligations comptables légales.</li>
              <li><strong>Données d'activité (annotations)</strong> : durée du Projet augmentée de trente (30) jours pour les données brutes ; conservation indéfinie sous forme anonymisée.</li>
              <li><strong>Données de connexion (logs)</strong> : douze (12) mois.</li>
              <li><strong>Données de certification</strong> : durée de validité de la certification augmentée d'un (1) an.</li>
            </ul>
          </section>

          <section>
            <h2>5. Destinataires des données</h2>
            <p>Vos données personnelles peuvent être communiquées aux destinataires suivants, dans la stricte mesure nécessaire à l'exécution du service :</p>
            <ul>
              <li><strong>Établissement bancaire</strong> : exécution des virements bancaires.</li>
              <li><strong>Supabase, Inc.</strong> : hébergement de la Plateforme (sous-traitant, serveurs situés en Union européenne).</li>
              <li><strong>Google / Apple</strong> : authentification OAuth, uniquement si l'utilisateur choisit ce mode de connexion.</li>
            </ul>
            <p>
              STEF ne vend pas vos données personnelles à des tiers. Aucun transfert de données hors de l'Union européenne n'est effectué, sauf instruction écrite et explicite du Client.
            </p>
          </section>

          <section>
            <h2>6. Droits des personnes concernées</h2>
            <p>Conformément au RGPD, vous disposez des droits suivants :</p>
            <ul>
              <li><strong>Droit d'accès</strong> (Article 15) : obtenir la confirmation que vos données sont traitées et en recevoir une copie.</li>
              <li><strong>Droit de rectification</strong> (Article 16) : corriger vos données inexactes ou incomplètes.</li>
              <li><strong>Droit à l'effacement</strong> (Article 17) : demander la suppression de vos données, sous réserve des obligations légales de conservation.</li>
              <li><strong>Droit à la limitation du traitement</strong> (Article 18) : demander la suspension du traitement de vos données dans certains cas.</li>
              <li><strong>Droit à la portabilité</strong> (Article 20) : recevoir vos données dans un format structuré et couramment utilisé.</li>
              <li><strong>Droit d'opposition</strong> (Article 21) : vous opposer au traitement de vos données fondé sur l'intérêt légitime.</li>
            </ul>
            <p>
              Pour exercer vos droits, adressez votre demande par email à <a href="mailto:privacy@steftalent.fr" className="text-primary hover:underline">privacy@steftalent.fr</a>. Nous nous engageons à vous répondre dans un délai de trente (30) jours.
            </p>
            <p>
              Vous disposez également du droit d'introduire une réclamation auprès de la Commission Nationale de l'Informatique et des Libertés (CNIL) : <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.cnil.fr</a>.
            </p>
          </section>

          <section>
            <h2>7. Cookies</h2>
            <ul>
              <li><strong>Cookies strictement nécessaires</strong> : session, authentification. Ces cookies sont indispensables au fonctionnement de la Plateforme et ne nécessitent pas de consentement.</li>
              <li><strong>Cookies analytiques</strong> : utilisés à des fins de mesure d'audience avec anonymisation des adresses IP. Ces cookies ne sont déposés qu'après recueil de votre consentement.</li>
              <li><strong>Cookies publicitaires</strong> : STEF n'utilise aucun cookie publicitaire.</li>
            </ul>
            <p>
              Un bandeau de consentement conforme vous est présenté lors de votre première visite. Vous pouvez modifier vos choix à tout moment.
            </p>
          </section>

          <section>
            <h2>8. Mesures de sécurité</h2>
            <p>STEF met en œuvre les mesures techniques et organisationnelles appropriées pour assurer la sécurité de vos données :</p>
            <ul>
              <li>Chiffrement TLS en transit pour toutes les communications ;</li>
              <li>Chiffrement au repos des données stockées ;</li>
              <li>Row Level Security assurant l'isolation des données entre utilisateurs ;</li>
              <li>Scan automatique des données à caractère personnel (PII) ;</li>
              <li>Principe du moindre privilège pour l'accès aux données ;</li>
              <li>Audits de sécurité réguliers.</li>
            </ul>
          </section>

          <section>
            <h2>9. Modifications</h2>
            <p>
              STEF se réserve le droit de modifier la présente Politique de Confidentialité. En cas de modification substantielle, les utilisateurs en seront informés par email ou par notification sur la Plateforme. La version en vigueur est celle publiée sur la Plateforme.
            </p>
          </section>

        </div>
      </main>

      <RLHFFooter />
    </div>
  );
}
