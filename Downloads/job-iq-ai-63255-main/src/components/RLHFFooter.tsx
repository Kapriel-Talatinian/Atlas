import { useNavigate } from "react-router-dom";

export const RLHFFooter = () => {
  const navigate = useNavigate();

  return (
    <footer className="border-t border-border">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <p className="font-bold text-foreground text-lg tracking-tight mb-3">STEF</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Données d'annotation humaine de haute qualité pour l'entraînement de modèles IA.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground mb-3 text-[13px]">Plateforme</p>
            <div className="space-y-2">
              <button onClick={() => navigate("/auth?mode=signup&role=expert")} className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Devenir expert</button>
              <button onClick={() => navigate("/auth?mode=signup&role=client")} className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Clients IA</button>
              <button onClick={() => navigate("/research")} className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Recherche</button>
            </div>
          </div>
          <div>
            <p className="font-medium text-foreground mb-3 text-[13px]">Ressources</p>
            <div className="space-y-2">
              <button onClick={() => navigate("/blog")} className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Blog</button>
              <button onClick={() => navigate("/legal/cgu-experts")} className="block text-sm text-muted-foreground hover:text-foreground transition-colors">CGU Experts</button>
              <button onClick={() => navigate("/legal/cgv-clients")} className="block text-sm text-muted-foreground hover:text-foreground transition-colors">CGV Clients</button>
              <button onClick={() => navigate("/legal/confidentialite")} className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Confidentialité</button>
            </div>
          </div>
          <div>
            <p className="font-medium text-foreground mb-3 text-[13px]">Contact</p>
            <div className="space-y-2">
              <a href="mailto:support@steftalent.fr" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">support@steftalent.fr</a>
              <a href="https://www.linkedin.com/company/stef-ai/" target="_blank" rel="noopener noreferrer" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">LinkedIn</a>
              <a href="https://www.facebook.com/share/17zoqeAca2/" target="_blank" rel="noopener noreferrer" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Facebook</a>
            </div>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-border text-[13px] text-muted-foreground">
          &copy; {new Date().getFullYear()} STEF. Tous droits réservés.
        </div>
      </div>
    </footer>
  );
};
