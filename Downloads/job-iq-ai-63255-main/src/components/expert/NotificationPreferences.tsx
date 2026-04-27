import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Bell, Mail, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

interface NotificationPreferencesProps {
  profile: {
    id: string;
    email_notifications?: boolean;
    sms_notifications?: boolean;
    phone_number_sms?: string;
    notify_job_matches?: boolean;
    notify_application_updates?: boolean;
  };
  onUpdate: () => void;
}

export const NotificationPreferences = ({ profile, onUpdate }: NotificationPreferencesProps) => {
  const { language } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState({
    email_notifications: profile.email_notifications ?? true,
    sms_notifications: profile.sms_notifications ?? false,
    phone_number_sms: profile.phone_number_sms || "",
    notify_job_matches: profile.notify_job_matches ?? true,
    notify_application_updates: profile.notify_application_updates ?? true,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("expert_profiles")
        .update({
          email_notifications: preferences.email_notifications,
          sms_notifications: preferences.sms_notifications,
          phone_number_sms: preferences.phone_number_sms || null,
          notify_job_matches: preferences.notify_job_matches,
          notify_application_updates: preferences.notify_application_updates,
        })
        .eq("id", profile.id);

      if (error) throw error;

      toast.success(language === 'fr' ? "Préférences sauvegardées" : "Preferences saved");
      onUpdate();
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast.error(language === 'fr' ? "Erreur lors de la sauvegarde" : "Error saving preferences");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Bell className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">
            {language === 'fr' ? 'Préférences de notification' : 'Notification Preferences'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {language === 'fr' 
              ? "Configurez comment vous souhaitez être notifié" 
              : "Configure how you want to be notified"
            }
          </p>
        </div>
      </div>

      {/* Email notifications */}
      <div className="border border-border rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-3">
          <Mail className="w-5 h-5 text-muted-foreground" />
          <div className="flex-1">
            <h4 className="font-medium">
              {language === 'fr' ? 'Notifications par email' : 'Email Notifications'}
            </h4>
            <p className="text-sm text-muted-foreground">
              {language === 'fr' 
                ? "Recevez des emails pour les nouvelles offres correspondant à votre profil" 
                : "Receive emails for new job offers matching your profile"
              }
            </p>
          </div>
          <Switch
            checked={preferences.email_notifications}
            onCheckedChange={(checked) => setPreferences(prev => ({ ...prev, email_notifications: checked }))}
          />
        </div>
      </div>

      {/* SMS notifications */}
      <div className="border border-border rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-3">
          <Smartphone className="w-5 h-5 text-muted-foreground" />
          <div className="flex-1">
            <h4 className="font-medium">
              {language === 'fr' ? 'Notifications SMS (90%+ match)' : 'SMS Notifications (90%+ match)'}
            </h4>
            <p className="text-sm text-muted-foreground">
              {language === 'fr' 
                ? "Recevez un SMS pour les offres avec +90% de compatibilité" 
                : "Receive SMS for offers with 90%+ compatibility"
              }
            </p>
          </div>
          <Switch
            checked={preferences.sms_notifications}
            onCheckedChange={(checked) => setPreferences(prev => ({ ...prev, sms_notifications: checked }))}
          />
        </div>

        {preferences.sms_notifications && (
          <div className="mt-4 pl-8">
            <Label>{language === 'fr' ? 'Numéro de téléphone' : 'Phone number'}</Label>
            <Input
              type="tel"
              placeholder="+33 6 12 34 56 78"
              value={preferences.phone_number_sms}
              onChange={(e) => setPreferences(prev => ({ ...prev, phone_number_sms: e.target.value }))}
              className="mt-1 max-w-xs"
            />
          </div>
        )}
      </div>

      {/* Notification types */}
      <div className="border border-border rounded-xl p-4 space-y-4">
        <h4 className="font-medium mb-4">
          {language === 'fr' ? 'Types de notifications' : 'Notification Types'}
        </h4>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">
                {language === 'fr' ? 'Nouvelles offres correspondantes' : 'New matching offers'}
              </p>
              <p className="text-xs text-muted-foreground">
                {language === 'fr' 
                  ? "Soyez notifié quand une offre correspond à votre profil" 
                  : "Be notified when a job matches your profile"
                }
              </p>
            </div>
            <Switch
              checked={preferences.notify_job_matches}
              onCheckedChange={(checked) => setPreferences(prev => ({ ...prev, notify_job_matches: checked }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">
                {language === 'fr' ? 'Mises à jour de candidatures' : 'Application updates'}
              </p>
              <p className="text-xs text-muted-foreground">
                {language === 'fr' 
                  ? "Soyez notifié des changements de statut de vos candidatures" 
                  : "Be notified of status changes in your applications"
                }
              </p>
            </div>
            <Switch
              checked={preferences.notify_application_updates}
              onCheckedChange={(checked) => setPreferences(prev => ({ ...prev, notify_application_updates: checked }))}
            />
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="gap-2">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {language === 'fr' ? 'Sauvegarder' : 'Save Changes'}
      </Button>
    </div>
  );
};
