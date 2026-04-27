import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Flag, Send, Clock, AlertTriangle } from "lucide-react";

interface RLHFPreferenceInterfaceProps {
  item: {
    id: string;
    content: {
      primary: string;
      alternatives?: string[];
    };
  };
  dimensions: string[];
  onSubmit: (value: {
    type: "comparison";
    preferred: string;
    reasoning: string;
    margin: "slight" | "clear" | "strong";
    dimensions: { name: string; score: number }[];
  }) => void;
  onFlag: (reason: string) => void;
  progress: { current: number; total: number };
  sessionDuration: number;
}

export function RLHFPreferenceInterface({
  item,
  dimensions = ["Helpfulness", "Harmlessness", "Honesty", "Tone"],
  onSubmit,
  onFlag,
  progress,
  sessionDuration,
}: RLHFPreferenceInterfaceProps) {
  const alternatives = item.content.alternatives || [];
  const [preferred, setPreferred] = useState<string>("");
  const [margin, setMargin] = useState<"slight" | "clear" | "strong">("clear");
  const [reasoning, setReasoning] = useState("");
  const [dimScores, setDimScores] = useState<Record<string, number>>(
    Object.fromEntries(dimensions.map(d => [d, 3]))
  );
  const [showFlag, setShowFlag] = useState(false);
  const [flagReason, setFlagReason] = useState("");

  const handleSubmit = useCallback(() => {
    if (!preferred || !reasoning.trim()) return;
    onSubmit({
      type: "comparison",
      preferred,
      reasoning,
      margin,
      dimensions: Object.entries(dimScores).map(([name, score]) => ({ name, score })),
    });
    setPreferred("");
    setMargin("clear");
    setReasoning("");
    setDimScores(Object.fromEntries(dimensions.map(d => [d, 3])));
  }, [preferred, reasoning, margin, dimScores, onSubmit, dimensions]);

  // Keyboard shortcut: Cmd+Enter to submit
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleSubmit]);

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h${m.toString().padStart(2, "0")}m` : `${m}m`;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            Batch: <strong>{progress.current}/{progress.total}</strong>
          </span>
          <Progress value={(progress.current / progress.total) * 100} className="w-32 h-2" />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          {formatDuration(sessionDuration)}
        </div>
      </div>

      {/* Prompt */}
      <Card className="border-2 bg-muted/30">
        <CardHeader className="py-3">
          <CardTitle className="text-sm text-muted-foreground">PROMPT</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-base">{item.content.primary}</p>
        </CardContent>
      </Card>

      {/* Responses side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {alternatives.map((alt, idx) => {
          const label = String.fromCharCode(65 + idx); // A, B, C...
          const isSelected = preferred === label;
          return (
            <Card
              key={idx}
              className={`border-2 cursor-pointer transition-all ${
                isSelected ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"
              }`}
              onClick={() => setPreferred(label)}
            >
              <CardHeader className="py-3 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">RÉPONSE {label}</CardTitle>
                  {isSelected && <Badge>Préférée</Badge>}
                </div>
              </CardHeader>
              <CardContent className="py-4">
                <p className="text-sm whitespace-pre-wrap">{alt}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Preference selection */}
      {preferred && (
        <Card className="border">
          <CardContent className="py-4 space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Marge de préférence</Label>
              <RadioGroup value={margin} onValueChange={(v) => setMargin(v as any)} className="flex gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="slight" id="slight" />
                  <Label htmlFor="slight">Un peu mieux</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="clear" id="clear" />
                  <Label htmlFor="clear">Clairement mieux</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="strong" id="strong" />
                  <Label htmlFor="strong">Beaucoup mieux</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Dimension scores */}
            <div className="grid grid-cols-2 gap-4">
              {dimensions.map((dim) => (
                <div key={dim} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{dim}</span>
                    <span className="font-mono">{dimScores[dim]}/5</span>
                  </div>
                  <Slider
                    value={[dimScores[dim]]}
                    min={1}
                    max={5}
                    step={1}
                    onValueChange={([v]) => setDimScores(prev => ({ ...prev, [dim]: v }))}
                  />
                </div>
              ))}
            </div>

            {/* Justification */}
            <div>
              <Label className="text-sm font-medium mb-2 block">
                Justification <span className="text-destructive">*</span>
              </Label>
              <Textarea
                placeholder="Expliquez pourquoi cette réponse est meilleure..."
                value={reasoning}
                onChange={(e) => setReasoning(e.target.value)}
                rows={3}
                className="text-sm"
              />
              {reasoning.length > 0 && reasoning.length < 20 && (
                <p className="text-xs text-destructive mt-1">Justification trop courte (min. 20 caractères)</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setShowFlag(!showFlag)}>
          <Flag className="h-4 w-4 mr-1" /> Signaler
        </Button>

        {showFlag && (
          <div className="flex gap-2 items-center">
            <Textarea
              placeholder="Raison..."
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
              rows={1}
              className="w-48 text-sm"
            />
            <Button size="sm" variant="destructive" onClick={() => {
              if (flagReason) { onFlag(flagReason); setShowFlag(false); setFlagReason(""); }
            }}>
              OK
            </Button>
          </div>
        )}

        <Button
          onClick={handleSubmit}
          disabled={!preferred || reasoning.length < 20}
          size="lg"
        >
          <Send className="h-4 w-4 mr-2" />
          Soumettre
          <span className="ml-1 text-xs opacity-60">(⌘↵)</span>
        </Button>
      </div>
    </div>
  );
}
