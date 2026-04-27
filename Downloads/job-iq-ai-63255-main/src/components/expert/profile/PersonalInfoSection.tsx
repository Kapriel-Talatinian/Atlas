import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Plus, X, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Experience { id: string; job_title: string; company: string; period: string; }
interface Education { id: string; degree_name: string; institution: string; year: string; }
interface Language { id: string; language: string; level: string; }

interface PersonalInfoProps {
  userId: string;
  experience: Experience[];
  education: Education[];
  languages: Language[];
  timezone: string;
  schedule: Record<string, string[]>;
  onRefresh: () => void;
}

const levelLabels: Record<string, string> = {
  notions: "Notions",
  intermediaire: "Intermédiaire",
  courant: "Courant",
  bilingue: "Bilingue",
  natif: "Natif",
};

const days = [
  { key: "monday", label: "Lu" },
  { key: "tuesday", label: "Ma" },
  { key: "wednesday", label: "Me" },
  { key: "thursday", label: "Je" },
  { key: "friday", label: "Ve" },
  { key: "saturday", label: "Sa" },
  { key: "sunday", label: "Di" },
];
const slots = ["morning", "afternoon", "evening"];
const slotLabels: Record<string, string> = { morning: "Matin", afternoon: "Après-midi", evening: "Soir" };

export function PersonalInfoSection({ userId, experience, education, languages, timezone, schedule, onRefresh }: PersonalInfoProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Local editing states
  const [editExp, setEditExp] = useState<Experience[]>([]);
  const [editEdu, setEditEdu] = useState<Education[]>([]);
  const [editLang, setEditLang] = useState<Language[]>([]);
  const [editTz, setEditTz] = useState(timezone);
  const [editSchedule, setEditSchedule] = useState<Record<string, string[]>>({});

  const startEdit = () => {
    setEditExp([...experience]);
    setEditEdu([...education]);
    setEditLang([...languages]);
    setEditTz(timezone);
    setEditSchedule({ ...schedule });
    setEditing(true);
  };

  const cancel = () => setEditing(false);

  const save = async () => {
    setSaving(true);
    try {
      // Delete existing and re-insert experience
      await supabase.from("expert_experience").delete().eq("expert_id", userId);
      if (editExp.length > 0) {
        await supabase.from("expert_experience").insert(
          editExp.map((e, i) => ({ expert_id: userId, job_title: e.job_title, company: e.company, period: e.period, sort_order: i }))
        );
      }

      // Education
      await supabase.from("expert_education").delete().eq("expert_id", userId);
      if (editEdu.length > 0) {
        await supabase.from("expert_education").insert(
          editEdu.map((e, i) => ({ expert_id: userId, degree_name: e.degree_name, institution: e.institution, year: e.year || "", sort_order: i }))
        );
      }

      // Languages
      await supabase.from("expert_languages").delete().eq("expert_id", userId);
      if (editLang.length > 0) {
        await supabase.from("expert_languages").insert(
          editLang.map((l) => ({ expert_id: userId, language: l.language, level: l.level }))
        );
      }

      // Weekly schedule
      await (supabase as any).from("expert_weekly_schedule").upsert(
        { expert_id: userId, timezone: editTz, schedule: editSchedule },
        { onConflict: "expert_id" }
      );

      toast.success("Profil mis à jour");
      setEditing(false);
      onRefresh();
    } catch (err) {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const toggleSlot = (day: string, slot: string) => {
    setEditSchedule((prev) => {
      const current = prev[day] || [];
      return { ...prev, [day]: current.includes(slot) ? current.filter((s) => s !== slot) : [...current, slot] };
    });
  };

  if (!editing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">Informations personnelles</h3>
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={startEdit}>
            <Pencil className="w-3.5 h-3.5" /> Modifier
          </Button>
        </div>

        {/* Experience */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Parcours professionnel</p>
          {experience.length > 0 ? (
            <div className="space-y-2 border-l-2 border-border pl-4">
              {experience.slice(0, 5).map((e) => (
                <div key={e.id}>
                  <p className="text-sm font-medium text-foreground">{e.job_title}</p>
                  <p className="text-xs text-muted-foreground">{e.company} · {e.period}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">Ajoutez votre parcours pour renforcer votre profil.</p>
          )}
        </div>

        {/* Education */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Diplômes et certifications externes</p>
          {education.length > 0 ? (
            <div className="space-y-1">
              {education.map((e) => (
                <p key={e.id} className="text-sm text-foreground">
                  {e.degree_name} — {e.institution} {e.year ? `— ${e.year}` : ""}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">Aucun diplôme renseigné.</p>
          )}
        </div>

        {/* Languages */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Langues</p>
          {languages.length > 0 ? (
            <p className="text-sm text-foreground">
              {languages.map((l) => `${l.language} (${levelLabels[l.level] || l.level})`).join(", ")}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground italic">Non renseigné.</p>
          )}
        </div>

        {/* Availability */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Disponibilités</p>
          <p className="text-xs text-muted-foreground mb-2">{timezone}</p>
          {Object.keys(schedule).length > 0 ? (
            <AvailabilityGrid schedule={schedule} />
          ) : (
            <p className="text-sm text-muted-foreground italic">Définissez vos disponibilités pour être assigné aux tâches aux bons moments.</p>
          )}
        </div>
      </div>
    );
  }

  // EDIT MODE
  return (
    <div className="space-y-6">
      <h3 className="text-base font-semibold text-foreground">Informations personnelles</h3>

      {/* Experience Edit */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Parcours professionnel</p>
        <div className="space-y-2">
          {editExp.map((e, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input placeholder="Poste" value={e.job_title} onChange={(ev) => { const n = [...editExp]; n[i] = { ...n[i], job_title: ev.target.value }; setEditExp(n); }} className="flex-1" />
              <Input placeholder="Entreprise" value={e.company} onChange={(ev) => { const n = [...editExp]; n[i] = { ...n[i], company: ev.target.value }; setEditExp(n); }} className="flex-1" />
              <Input placeholder="Période" value={e.period} onChange={(ev) => { const n = [...editExp]; n[i] = { ...n[i], period: ev.target.value }; setEditExp(n); }} className="w-32" />
              <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setEditExp(editExp.filter((_, j) => j !== i))}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setEditExp([...editExp, { id: "", job_title: "", company: "", period: "" }])}>
            <Plus className="w-3.5 h-3.5" /> Ajouter
          </Button>
        </div>
      </div>

      {/* Education Edit */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Diplômes</p>
        <div className="space-y-2">
          {editEdu.map((e, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input placeholder="Diplôme" value={e.degree_name} onChange={(ev) => { const n = [...editEdu]; n[i] = { ...n[i], degree_name: ev.target.value }; setEditEdu(n); }} className="flex-1" />
              <Input placeholder="Institution" value={e.institution} onChange={(ev) => { const n = [...editEdu]; n[i] = { ...n[i], institution: ev.target.value }; setEditEdu(n); }} className="flex-1" />
              <Input placeholder="Année" value={e.year} onChange={(ev) => { const n = [...editEdu]; n[i] = { ...n[i], year: ev.target.value }; setEditEdu(n); }} className="w-24" />
              <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setEditEdu(editEdu.filter((_, j) => j !== i))}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setEditEdu([...editEdu, { id: "", degree_name: "", institution: "", year: "" }])}>
            <Plus className="w-3.5 h-3.5" /> Ajouter
          </Button>
        </div>
      </div>

      {/* Languages Edit */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Langues</p>
        <div className="space-y-2">
          {editLang.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input placeholder="Langue" value={l.language} onChange={(ev) => { const n = [...editLang]; n[i] = { ...n[i], language: ev.target.value }; setEditLang(n); }} className="flex-1" />
              <select
                value={l.level}
                onChange={(ev) => { const n = [...editLang]; n[i] = { ...n[i], level: ev.target.value }; setEditLang(n); }}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {Object.entries(levelLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setEditLang(editLang.filter((_, j) => j !== i))}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setEditLang([...editLang, { id: "", language: "", level: "courant" }])}>
            <Plus className="w-3.5 h-3.5" /> Ajouter
          </Button>
        </div>
      </div>

      {/* Availability Edit */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Disponibilités</p>
        <Input placeholder="Fuseau horaire" value={editTz} onChange={(e) => setEditTz(e.target.value)} className="max-w-xs mb-3" />
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr>
                <th className="p-1" />
                {days.map((d) => <th key={d.key} className="p-1 text-center text-muted-foreground font-medium">{d.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => (
                <tr key={slot}>
                  <td className="p-1 text-muted-foreground pr-2">{slotLabels[slot]}</td>
                  {days.map((d) => {
                    const active = (editSchedule[d.key] || []).includes(slot);
                    return (
                      <td key={d.key} className="p-1 text-center">
                        <button
                          onClick={() => toggleSlot(d.key, slot)}
                          className={`w-7 h-7 rounded-md transition-colors ${active ? "bg-emerald-500/20 border border-emerald-500/40" : "bg-muted border border-border"}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Save/Cancel */}
      <div className="flex gap-2 pt-2">
        <Button onClick={save} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Enregistrer
        </Button>
        <Button variant="ghost" onClick={cancel} disabled={saving}>Annuler</Button>
      </div>
    </div>
  );
}

function AvailabilityGrid({ schedule }: { schedule: Record<string, string[]> }) {
  return (
    <div className="overflow-x-auto">
      <table className="text-xs">
        <thead>
          <tr>
            <th className="p-1" />
            {days.map((d) => <th key={d.key} className="p-1 text-center text-muted-foreground font-medium">{d.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => (
            <tr key={slot}>
              <td className="p-1 text-muted-foreground pr-2">{slotLabels[slot]}</td>
              {days.map((d) => {
                const active = (schedule[d.key] || []).includes(slot);
                return (
                  <td key={d.key} className="p-1 text-center">
                    <div className={`w-6 h-6 rounded-md ${active ? "bg-emerald-500/30 border border-emerald-500/40" : "bg-muted/50 border border-border/50"}`} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
