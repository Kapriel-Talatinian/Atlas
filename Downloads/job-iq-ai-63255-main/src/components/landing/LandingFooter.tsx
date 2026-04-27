import { useNavigate } from "react-router-dom";

export const LandingFooter = () => {
  const navigate = useNavigate();

  const Link = ({ to, children }: { to: string; children: string }) => (
    <button
      onClick={() => navigate(to)}
      className="block text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px] sm:min-h-0 flex items-center"
    >
      {children}
    </button>
  );

  return (
    <footer className="border-t border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <span className="text-lg font-bold text-foreground tracking-tight">STEF</span>
            <p className="text-[13px] text-muted-foreground mt-3 leading-relaxed">
              Données d'alignement IA vérifiées par des experts certifiés.
            </p>
          </div>

          <div>
            <p className="text-[13px] font-medium text-foreground mb-3">Produit</p>
            <div className="space-y-1 sm:space-y-2">
              <Link to="/auth?mode=signup&role=client">Créer un projet</Link>
              <Link to="/client/api">Documentation API</Link>
              <Link to="/auth?mode=signup&role=expert">Devenir expert</Link>
            </div>
          </div>

          <div>
            <p className="text-[13px] font-medium text-foreground mb-3">Juridique</p>
            <div className="space-y-1 sm:space-y-2">
              <Link to="/legal/cgu-experts">CGU Experts</Link>
              <Link to="/legal/cgv-clients">CGV Clients</Link>
              <Link to="/legal/confidentialite">Confidentialité</Link>
              <Link to="/legal/api-terms">Conditions API</Link>
            </div>
          </div>

          <div>
            <p className="text-[13px] font-medium text-foreground mb-3">Contact</p>
            <div className="space-y-1 sm:space-y-2">
              <a href="mailto:contact@steftalent.fr" className="block text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px] sm:min-h-0 flex items-center">
                contact@steftalent.fr
              </a>
              <a href="https://www.linkedin.com/company/stef-ai/" target="_blank" rel="noopener noreferrer" className="block text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px] sm:min-h-0 flex items-center">
                LinkedIn
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2 text-[13px] text-muted-foreground">
          <span>STEF</span>
          <span>&copy; {new Date().getFullYear()} STEF SAS. Tous droits réservés.</span>
        </div>
      </div>
    </footer>
  );
};
