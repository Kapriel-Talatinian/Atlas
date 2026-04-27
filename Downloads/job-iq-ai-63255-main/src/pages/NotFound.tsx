import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <SEO
        title="Page introuvable"
        description="La page que vous cherchez n'existe pas ou a été déplacée."
        path={location.pathname}
        noindex
      />
      <div className="text-center">
        <h1 className="mb-4 text-6xl font-bold text-foreground">404</h1>
        <p className="mb-6 text-xl text-muted-foreground">Oops ! Page introuvable</p>
        <Button asChild>
          <a href="/">Retour à l'accueil</a>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
