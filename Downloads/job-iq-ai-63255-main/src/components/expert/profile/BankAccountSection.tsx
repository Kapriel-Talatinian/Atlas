import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle, Building2 } from "lucide-react";

function validateIBAN(iban: string): boolean {
  const cleaned = iban.replace(/\s/g, "").toUpperCase();
  if (cleaned.length < 15 || cleaned.length > 34) return false;
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(cleaned)) return false;
  // Mod 97 check
  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, c => (c.charCodeAt(0) - 55).toString());
  let remainder = "";
  for (const digit of numeric) {
    remainder = ((parseInt(remainder + digit, 10)) % 97).toString();
  }
  return parseInt(remainder) === 1;
}

function validateBIC(bic: string): boolean {
  const cleaned = bic.replace(/\s/g, "").toUpperCase();
  return /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(cleaned);
}

export function BankAccountSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accountHolder, setAccountHolder] = useState("");
  const [iban, setIban] = useState("");
  const [bic, setBic] = useState("");
  const [bankName, setBankName] = useState("");
  const [hasAccount, setHasAccount] = useState(false);

  useEffect(() => {
    loadBankAccount();
  }, []);

  const loadBankAccount = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("expert_bank_accounts" as any)
        .select("*")
        .eq("expert_id", session.user.id)
        .maybeSingle();
      if (data) {
        setAccountHolder((data as any).account_holder || "");
        setIban((data as any).iban_encrypted || "");
        setBic((data as any).bic || "");
        setBankName((data as any).bank_name || "");
        setHasAccount(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (accountHolder.trim().length < 3) {
      toast.error("Le nom du titulaire doit faire au moins 3 caractères");
      return;
    }
    if (!validateIBAN(iban)) {
      toast.error("IBAN invalide. Vérifiez le format.");
      return;
    }
    if (bic && !validateBIC(bic)) {
      toast.error("BIC/SWIFT invalide. Format attendu : 8 ou 11 caractères.");
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non authentifié");

      const record = {
        expert_id: session.user.id,
        account_holder: accountHolder.trim(),
        iban_encrypted: iban.replace(/\s/g, "").toUpperCase(),
        bic: bic.replace(/\s/g, "").toUpperCase() || null,
        bank_name: bankName.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("expert_bank_accounts" as any)
        .upsert(record, { onConflict: "expert_id" });

      if (error) throw error;
      setHasAccount(true);
      toast.success("Coordonnées bancaires enregistrées");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground">Chargement...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Building2 className="w-4 h-4 text-muted-foreground" />
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Coordonnées bancaires</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Ces informations sont utilisées pour le versement de vos gains.
        Elles ne sont visibles que par vous et l'administrateur.
      </p>

      {hasAccount && (
        <div className="flex items-center gap-2 text-sm text-emerald-500 mb-2">
          <CheckCircle className="w-4 h-4" />
          Coordonnées bancaires enregistrées
        </div>
      )}

      <div className="space-y-3">
        <div>
          <Label className="text-xs">Titulaire du compte *</Label>
          <Input
            value={accountHolder}
            onChange={e => setAccountHolder(e.target.value)}
            placeholder="Prénom Nom"
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">IBAN *</Label>
          <Input
            value={iban}
            onChange={e => setIban(e.target.value)}
            placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX"
            className="mt-1 font-mono"
          />
        </div>
        <div>
          <Label className="text-xs">BIC / SWIFT</Label>
          <Input
            value={bic}
            onChange={e => setBic(e.target.value)}
            placeholder="XXXXXXXXX"
            className="mt-1 font-mono"
          />
        </div>
        <div>
          <Label className="text-xs">Banque</Label>
          <Input
            value={bankName}
            onChange={e => setBankName(e.target.value)}
            placeholder="Nom de la banque"
            className="mt-1"
          />
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="w-3 h-3 animate-spin mr-2" />}
          Enregistrer
        </Button>
      </div>
    </div>
  );
}
