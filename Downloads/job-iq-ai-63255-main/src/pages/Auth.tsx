import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);

  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const initialRole = searchParams.get("role") === "client" ? "company" : "expert";

  const [mode, setMode] = useState<"login" | "signup" | "forgot">(initialMode);
  const [selectedRole, setSelectedRole] = useState<"expert" | "company">(initialRole);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .single();

        if (roleData?.role === "company") navigate("/client/dashboard");
        else if (roleData?.role === "expert") navigate("/expert/home");
        else if (roleData?.role === "admin") navigate("/admin");
        else navigate("/");
      }
    };
    checkSession();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Veuillez remplir tous les champs."); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Connexion réussie");
      const { data: roleData } = await supabase
        .from("user_roles").select("role").eq("user_id", data.user.id).single();
      if (roleData?.role === "company") navigate("/client/dashboard");
      else if (roleData?.role === "expert") navigate("/expert/home");
      else if (roleData?.role === "admin") navigate("/admin");
      else navigate("/");
    } catch (error: any) {
      toast.error(error.message || "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName) { toast.error("Veuillez remplir tous les champs."); return; }
    if (password.length < 8) { toast.error("Le mot de passe doit contenir au moins 8 caractères."); return; }
    if (!/\d/.test(password)) { toast.error("Le mot de passe doit contenir au moins un chiffre."); return; }
    if (selectedRole === "company" && !companyName) { toast.error("Veuillez renseigner le nom de votre entreprise."); return; }
    if (website) { toast.success("Compte créé. Vérifiez votre email."); return; }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: fullName,
            role: selectedRole,
            ...(selectedRole === "company" ? { company_name: companyName } : {}),
          },
        },
      });
      if (error) {
        if (error.message.includes("already registered")) { toast.error("Cet email est déjà utilisé."); setMode("login"); return; }
        throw error;
      }
      toast.success("Compte créé. Vérifiez votre email pour confirmer votre inscription.");
      if (data.user) {
        if (selectedRole === "company") navigate("/client/dashboard");
        else navigate("/expert/home");
      }
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de l'inscription");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error("Veuillez saisir votre email."); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Un email de réinitialisation a été envoyé.");
      setMode("login");
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de l'envoi");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (error) toast.error("Erreur de connexion Google");
    } catch { toast.error("Erreur de connexion Google"); }
    finally { setGoogleLoading(false); }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <span className="text-2xl font-bold text-foreground tracking-tight">STEF</span>
          </Link>
          <p className="text-muted-foreground text-sm mt-2">
            {mode === "login" ? "Connectez-vous à votre compte" : mode === "signup" ? "Créez votre compte" : "Réinitialiser le mot de passe"}
          </p>
        </div>

        <Card>
          <CardContent className="p-6 space-y-5">
            {mode === "forgot" ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <p className="text-sm text-muted-foreground">Saisissez votre email pour recevoir un lien de réinitialisation.</p>
                <div>
                  <Label htmlFor="email" className="text-[13px] font-medium">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.com" disabled={loading} className="mt-1" required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Envoyer le lien
                </Button>
              </form>
            ) : (
              <>
                {/* Google OAuth */}
                <Button variant="outline" className="w-full h-10 gap-3 text-sm" onClick={handleGoogleSignIn} disabled={googleLoading || loading}>
                  {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                  )}
                  Continuer avec Google
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-card px-3 text-muted-foreground">ou par email</span>
                  </div>
                </div>

                {mode === "signup" && (
                  <div>
                    <Label className="text-[13px] font-medium mb-2 block">Type de compte</Label>
                    <RadioGroup value={selectedRole} onValueChange={(v) => setSelectedRole(v as "expert" | "company")} className="grid grid-cols-2 gap-3">
                      <Label htmlFor="role-expert" className={`flex flex-col items-center gap-1 rounded-lg border p-3 cursor-pointer transition-colors text-center ${selectedRole === "expert" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}>
                        <RadioGroupItem value="expert" id="role-expert" className="sr-only" />
                        <span className="text-sm font-medium text-foreground">Expert</span>
                        <span className="text-[11px] text-muted-foreground leading-tight">Annotez des données IA</span>
                      </Label>
                      <Label htmlFor="role-company" className={`flex flex-col items-center gap-1 rounded-lg border p-3 cursor-pointer transition-colors text-center ${selectedRole === "company" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}>
                        <RadioGroupItem value="company" id="role-company" className="sr-only" />
                        <span className="text-sm font-medium text-foreground">Entreprise</span>
                        <span className="text-[11px] text-muted-foreground leading-tight"><span className="text-[11px] text-muted-foreground leading-tight">Commandez vos annotations</span></span>
                      </Label>
                    </RadioGroup>
                  </div>
                )}

                <form onSubmit={mode === "login" ? handleLogin : handleSignup} className="space-y-4">
                  {mode === "signup" && (
                    <>
                      <div>
                        <Label htmlFor="fullName" className="text-[13px] font-medium">Nom complet</Label>
                        <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jean Dupont" disabled={loading} className="mt-1" required />
                      </div>
                      {selectedRole === "company" && (
                        <div>
                          <Label htmlFor="companyName" className="text-[13px] font-medium">Entreprise</Label>
                          <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Nom de l'entreprise" disabled={loading} className="mt-1" required />
                        </div>
                      )}
                    </>
                  )}

                  <div>
                    <Label htmlFor="email" className="text-[13px] font-medium">Email</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.com" disabled={loading} className="mt-1" required />
                  </div>
                  <div>
                    <Label htmlFor="password" className="text-[13px] font-medium">Mot de passe</Label>
                    <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 8 caractères avec un chiffre" disabled={loading} className="mt-1" required />
                    {mode === "login" && (
                      <button type="button" onClick={() => setMode("forgot")} className="text-xs text-primary hover:underline mt-1">
                        Mot de passe oublié ?
                      </button>
                    )}
                  </div>

                  {/* Honeypot */}
                  <div className="absolute -left-[9999px] opacity-0 h-0 w-0 overflow-hidden" aria-hidden="true" tabIndex={-1}>
                    <Input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" />
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {mode === "login" ? "Se connecter" : "Créer mon compte"}
                  </Button>
                </form>
              </>
            )}

            <p className="text-center text-sm text-muted-foreground">
              {mode === "login" ? (
                <>Pas encore de compte ? <button onClick={() => setMode("signup")} className="text-primary font-medium hover:underline">S'inscrire</button></>
              ) : mode === "signup" ? (
                <>Déjà un compte ? <button onClick={() => setMode("login")} className="text-primary font-medium hover:underline">Se connecter</button></>
              ) : (
                <button onClick={() => setMode("login")} className="text-primary font-medium hover:underline">← Retour à la connexion</button>
              )}
            </p>
          </CardContent>
        </Card>

        <div className="text-center mt-4">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Auth;
