import { RLHFNavbar } from "@/components/RLHFNavbar";
import { RLHFFooter } from "@/components/RLHFFooter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SEO } from "@/components/SEO";

const Terms = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Conditions générales"
        description="Conditions générales d'utilisation de la plateforme STEF. Mentions légales, politique de confidentialité et RGPD."
        path="/terms"
      />
      <RLHFNavbar />
      
      <main className="container mx-auto px-4 py-24 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8 text-foreground">
          Conditions Générales d'Utilisation
        </h1>
        <p className="text-muted-foreground mb-8">
          Dernière mise à jour : 6 février 2026
        </p>

        {/* Section 1: Présentation */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>1. Présentation du service</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              STEF (Skills & Talent Evaluation Framework) est une <strong>plateforme d'évaluation technique</strong>{" "}
              qui permet aux professionnels de la tech de valider et certifier leurs compétences via des tests pratiques.
            </p>
            <p className="text-destructive font-medium">
              ⚠️ STEF n'est PAS un organisme de formation officiel. Les certifications délivrées sont des 
              attestations de compétences internes à la plateforme et ne constituent pas des diplômes reconnus par l'État.
            </p>
            <p>
              STEF n'est PAS un employeur et ne garantit pas l'obtention d'un emploi, d'une mission ou d'un revenu.
            </p>
          </CardContent>
        </Card>

        {/* Section 2: Évaluation */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>2. Processus d'évaluation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              Le processus d'évaluation comprend :
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Un test technique adapté au profil et au niveau déclaré</li>
              <li>Des questions ouvertes nécessitant raisonnement et justification</li>
              <li>Une durée minimum de 30 à 90 minutes selon le test</li>
              <li>Des mécanismes anti-triche (détection onglets, proctoring optionnel)</li>
            </ul>
            <p>
              Le score est calculé automatiquement par notre système d'évaluation IA, 
              supervisé par des experts humains pour le contrôle qualité.
            </p>
          </CardContent>
        </Card>

        {/* Section 3: Données */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>3. Utilisation des données</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              En utilisant STEF, vous consentez à ce que vos données soient utilisées comme suit :
            </p>
            
            <div className="bg-muted p-4 rounded-lg space-y-3">
              <h4 className="font-semibold text-foreground">Données personnelles (identifiantes)</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Nom, email, pays : utilisés pour la gestion de compte</li>
                <li>CV et profil : visibles par les entreprises partenaires (si vous l'autorisez)</li>
                <li>Jamais vendues à des tiers non partenaires</li>
              </ul>
            </div>

            <div className="bg-accent/10 p-4 rounded-lg space-y-3">
              <h4 className="font-semibold text-foreground">Données d'évaluation (anonymisées)</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Réponses aux tests techniques</li>
                <li>Scores et feedback</li>
                <li>Patterns de raisonnement</li>
              </ul>
              <p className="text-sm">
                Ces données sont <strong>anonymisées</strong> (sans nom, email, ou identifiant direct) 
                et peuvent être utilisées pour :
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                <li>Améliorer nos algorithmes d'évaluation</li>
                <li>Constituer des datasets de formation pour l'IA (RLHF)</li>
                <li>Être licenciées à des partenaires (labs IA, entreprises tech) sous forme agrégée</li>
              </ul>
            </div>

            <p className="font-medium text-foreground">
              Vous pouvez demander la suppression de vos données personnelles à tout moment 
              via privacy@stef.dev. Les données anonymisées agrégées ne peuvent pas être supprimées.
            </p>
          </CardContent>
        </Card>

        {/* Section 4: Certification */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>4. Certifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              Les certifications STEF attestent d'un niveau de compétence technique évalué à un instant T.
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Score minimum requis : 80/100 pour obtenir une certification</li>
              <li>Validité : 24 mois (sauf indication contraire)</li>
              <li>Vérifiable publiquement via un ID unique et une signature cryptographique</li>
              <li>Non-transférable et non-falsifiable</li>
            </ul>
            <p className="text-destructive font-medium">
              Une certification STEF ne garantit pas l'embauche, un salaire minimum, 
              ou la réussite à d'autres évaluations techniques.
            </p>
          </CardContent>
        </Card>

        {/* Section 5: Tarifs */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>5. Tarifs et TJM indicatifs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              Les fourchettes de TJM (Taux Journalier Moyen) affichées sur la plateforme sont 
              <strong> purement indicatives</strong> et basées sur :
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Les données du marché européen</li>
              <li>Les profils similaires dans notre base</li>
              <li>Le niveau de séniorité déclaré</li>
            </ul>
            <p className="text-destructive font-medium">
              Ces montants ne constituent pas une promesse de revenu. 
              La négociation finale dépend de nombreux facteurs (client, projet, localisation, etc.).
            </p>
          </CardContent>
        </Card>

        {/* Section 6: Programme Annotateur */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>6. Programme Annotateur RLHF</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              Les experts qualifiés peuvent contribuer à l'amélioration de nos modèles d'évaluation 
              en participant au programme d'annotation.
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Rémunération fixe : 1,00 $ par annotation validée</li>
              <li>Paiement : manuel, après vente de datasets (non garanti mensuellement)</li>
              <li>Qualité requise : les annotations bâclées ne sont pas rémunérées</li>
              <li>Vos annotations anonymisées peuvent être incluses dans des datasets commerciaux</li>
            </ul>
          </CardContent>
        </Card>

        {/* Section 7: Propriété intellectuelle */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>7. Propriété intellectuelle</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              En soumettant du contenu (réponses aux tests, annotations), vous accordez à STEF 
              une licence non-exclusive, mondiale, perpétuelle pour utiliser ce contenu de manière 
              anonymisée à des fins d'amélioration de service et de recherche IA.
            </p>
            <p>
              Vous conservez vos droits sur vos informations personnelles et pouvez 
              demander leur suppression conformément au RGPD.
            </p>
          </CardContent>
        </Card>

        {/* Section 8: Contact */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>8. Contact et réclamations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              Pour toute question concernant vos données ou ces conditions :
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Email : privacy@stef.dev</li>
              <li>Délai de réponse : 72 heures ouvrées</li>
              <li>Signalement d'abus de certification : abuse@stef.dev</li>
            </ul>
          </CardContent>
        </Card>

        <Separator className="my-8" />

        <p className="text-sm text-muted-foreground text-center">
          En utilisant STEF, vous acceptez ces conditions. 
          Nous nous réservons le droit de les modifier avec un préavis de 30 jours.
        </p>
      </main>

      <RLHFFooter />
    </div>
  );
};

export default Terms;
