import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { AnnotationWrapper } from "./AnnotationWrapper";
import { Plus, Trash2, Copy } from "lucide-react";

interface Field { name: string; type: string; required: boolean; description: string; }
interface Props {
  taskId: string;
  domain: string;
  content: { text: string; extraction_schema: { fields: Field[] }; instructions?: string };
  onSubmit: (data: any, timeSpent: number) => Promise<void>;
}

export function ExtractionInterface({ taskId, domain, content, onSubmit }: Props) {
  const fields = content.extraction_schema?.fields || [];
  const [entities, setEntities] = useState<Record<string, any>[]>([createEmptyEntity(fields)]);
  const [comments, setComments] = useState("");

  const addEntity = () => setEntities([...entities, createEmptyEntity(fields)]);
  const removeEntity = (i: number) => setEntities(entities.filter((_, j) => j !== i));

  const updateField = (entityIdx: number, fieldName: string, value: any) => {
    const n = [...entities];
    n[entityIdx] = { ...n[entityIdx], [fieldName]: value };
    setEntities(n);
  };

  const addArrayItem = (entityIdx: number, fieldName: string) => {
    const n = [...entities];
    const current = n[entityIdx][fieldName] || [];
    n[entityIdx] = { ...n[entityIdx], [fieldName]: [...current, ""] };
    setEntities(n);
  };

  const updateArrayItem = (entityIdx: number, fieldName: string, itemIdx: number, value: string) => {
    const n = [...entities];
    const arr = [...(n[entityIdx][fieldName] || [])];
    arr[itemIdx] = value;
    n[entityIdx] = { ...n[entityIdx], [fieldName]: arr };
    setEntities(n);
  };

  const removeArrayItem = (entityIdx: number, fieldName: string, itemIdx: number) => {
    const n = [...entities];
    const arr = (n[entityIdx][fieldName] || []).filter((_: any, j: number) => j !== itemIdx);
    n[entityIdx] = { ...n[entityIdx], [fieldName]: arr };
    setEntities(n);
  };

  return (
    <AnnotationWrapper
      taskId={taskId} taskType="extraction" domain={domain} minTimeSeconds={90}
      onSubmitAnnotation={async (_, timeSpent) => {
        for (const entity of entities) {
          for (const f of fields) {
            if (f.required && (!entity[f.name] || (Array.isArray(entity[f.name]) && entity[f.name].length === 0))) {
              throw new Error(`Le champ "${f.name}" est obligatoire.`);
            }
          }
        }
        await onSubmit({ extractions: entities, comments, time_spent_seconds: timeSpent }, timeSpent);
      }}
    >
      {() => (
        <div className="flex flex-col lg:flex-row min-h-[calc(100vh-7rem)]">
          {/* Left: source text */}
          <div className="lg:w-[55%] p-4 lg:p-6 overflow-y-auto border-r border-border">
            {content.instructions && (
              <Card className="border-l-4 border-l-amber-500 bg-amber-500/[0.03] mb-4">
                <CardContent className="p-3 text-xs">{content.instructions}</CardContent>
              </Card>
            )}
            <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed p-4 bg-muted/30 rounded-xl border border-border select-text">
              {content.text}
            </div>
          </div>

          {/* Right: extraction form */}
          <div className="lg:w-[45%] p-4 lg:p-6 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Extraction</h3>
              <Button variant="outline" size="sm" className="gap-1" onClick={addEntity}>
                <Plus className="w-3.5 h-3.5" /> Ajouter une entité
              </Button>
            </div>

            {entities.map((entity, eIdx) => (
              <Card key={eIdx}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Entité #{eIdx + 1}</span>
                    {entities.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeEntity(eIdx)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                  {fields.map((f) => (
                    <div key={f.name}>
                      <label className="text-xs font-medium text-muted-foreground">
                        {f.name.replace(/_/g, " ")} {f.required && <span className="text-destructive">*</span>}
                      </label>
                      {f.type === "string" && (
                        <Input value={entity[f.name] || ""} onChange={(e) => updateField(eIdx, f.name, e.target.value)}
                          placeholder={f.description} className="mt-1 text-sm" />
                      )}
                      {f.type === "number" && (
                        <Input type="number" value={entity[f.name] || ""} onChange={(e) => updateField(eIdx, f.name, Number(e.target.value))}
                          placeholder={f.description} className="mt-1 text-sm" />
                      )}
                      {f.type === "boolean" && (
                        <div className="mt-1">
                          <Switch checked={!!entity[f.name]} onCheckedChange={(v) => updateField(eIdx, f.name, v)} />
                        </div>
                      )}
                      {f.type === "array_string" && (
                        <div className="mt-1 space-y-1">
                          {(entity[f.name] || []).map((item: string, iIdx: number) => (
                            <div key={iIdx} className="flex gap-1">
                              <Input value={item} onChange={(e) => updateArrayItem(eIdx, f.name, iIdx, e.target.value)} className="text-xs" />
                              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => removeArrayItem(eIdx, f.name, iIdx)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => addArrayItem(eIdx, f.name)}>
                            + Ajouter
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}

            <Textarea value={comments} onChange={(e) => setComments(e.target.value)}
              placeholder="Commentaires (optionnel)..." rows={2} className="resize-none" />
          </div>
        </div>
      )}
    </AnnotationWrapper>
  );
}

function createEmptyEntity(fields: Field[]): Record<string, any> {
  return Object.fromEntries(fields.map((f) => [f.name, f.type === "array_string" ? [] : f.type === "boolean" ? false : ""]));
}
