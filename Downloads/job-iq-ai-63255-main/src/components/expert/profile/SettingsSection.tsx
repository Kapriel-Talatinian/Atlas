import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { BankAccountSection } from "./BankAccountSection";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface SettingsSectionProps {
  email: string;
  stripeConnected?: boolean;
}

export function SettingsSection({ email, stripeConnected }: SettingsSectionProps) {
  const navigate = useNavigate();
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handlePasswordChange = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      toast.error("Erreur lors de l'envoi du lien");
    } else {
      toast.success("Un lien de réinitialisation a été envoyé à votre adresse email.");
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await supabase.auth.signOut();
      setDialogOpen(false);
      navigate("/");
      toast.success("Votre demande de suppression a été enregistrée. Vos données seront supprimées sous 30 jours.");
    } catch {
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Email */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Email</p>
        <p className="text-sm text-foreground">{email}</p>
        <p className="text-xs text-muted-foreground mt-1">Contactez-nous pour modifier votre email.</p>
      </div>

      {/* Password */}
      <div className="border-t border-border pt-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Mot de passe</p>
        <Button variant="outline" size="sm" onClick={handlePasswordChange}>
          Modifier le mot de passe
        </Button>
      </div>

      {/* Bank Account */}
      <div className="border-t border-border pt-4">
        <BankAccountSection />
      </div>

      {/* Theme */}
      <div className="border-t border-border pt-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Thème</p>
        <ThemeToggle />
      </div>

      {/* Danger Zone */}
      <div className="border-t border-destructive/20 pt-4">
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-destructive mb-1">Supprimer mon compte</p>
            <p className="text-xs text-muted-foreground mb-3">
              Cette action est irréversible. Vos données seront supprimées sous 30 jours. Votre solde disponible vous sera versé avant suppression.
            </p>
            <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">Supprimer mon compte</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-destructive">Confirmer la suppression</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tapez <strong>SUPPRIMER</strong> pour confirmer la suppression définitive de votre compte.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="Tapez SUPPRIMER"
                  className="mt-2"
                />
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deleteConfirm !== "SUPPRIMER" || deleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Supprimer définitivement
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
