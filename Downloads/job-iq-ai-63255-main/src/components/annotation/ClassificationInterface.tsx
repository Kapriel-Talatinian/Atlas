import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Flag, ArrowRight, Clock, AlertTriangle } from "lucide-react";

interface ClassificationInterfaceProps {
  item: {
    id: string;
    content: { primary: string; secondary?: string };
    auto_annotation?: { value: any; confidence: number };
  };
  labels: string[];
  onSubmit: (value: { type: "classification"; labels: string[] }, comment?: string) => void;
  onFlag: (reason: string) => void;
  onSkip?: () => void;
  progress: { current: number; total: number };
  showPreAnnotation?: boolean;
  sessionDuration: number;
}

export function ClassificationInterface({
  item,
  labels,
  onSubmit,
  onFlag,
  onSkip,
  progress,
  showPreAnnotation = false,
  sessionDuration,
}: ClassificationInterfaceProps) {
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [showFlagInput, setShowFlagInput] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [startTime] = useState(Date.now());

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (showFlagInput) return;

      // Number keys for label selection
      const idx = parseInt(e.key) - 1;
      if (idx >= 0 && idx < labels.length) {
        e.preventDefault();
        toggleLabel(labels[idx]);
      }

      // Enter to submit
      if (e.key === "Enter" && !e.shiftKey && selectedLabels.length > 0) {
        e.preventDefault();
        handleSubmit();
      }

      // S to skip
      if (e.key === "s" && onSkip) {
        e.preventDefault();
        onSkip();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedLabels, labels, showFlagInput]);

  const toggleLabel = useCallback((label: string) => {
    setSelectedLabels(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    );
  }, []);

  const handleSubmit = useCallback(() => {
    if (selectedLabels.length === 0) return;
    onSubmit({ type: "classification", labels: selectedLabels }, comment || undefined);
    setSelectedLabels([]);
    setComment("");
  }, [selectedLabels, comment, onSubmit]);

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h${m.toString().padStart(2, "0")}m` : `${m}m`;
  };

  // Fatigue warning
  const showFatigueWarning = sessionDuration > 7200; // 2 hours

  return (
    <div className="max-w-3xl mx-auto space-y-4">
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

      {showFatigueWarning && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <span>Vous travaillez depuis plus de 2h. Une pause est recommandée pour maintenir la qualité.</span>
        </div>
      )}

      {/* Content to annotate */}
      <Card className="border-2">
        <CardHeader className="py-3">
          <CardTitle className="text-sm text-muted-foreground">CONTENU À ANNOTER</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg leading-relaxed">{item.content.primary}</p>
          {item.content.secondary && (
            <p className="mt-3 text-muted-foreground">{item.content.secondary}</p>
          )}
        </CardContent>
      </Card>

      {/* Pre-annotation suggestion */}
      {showPreAnnotation && item.auto_annotation && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/50 border text-sm">
          <Badge variant="outline">🤖 Suggestion IA</Badge>
          <span>{(item.auto_annotation.value as any)?.labels?.join(", ")}</span>
          <Badge variant="secondary">{Math.round(item.auto_annotation.confidence * 100)}%</Badge>
        </div>
      )}

      {/* Label selection */}
      <div className="flex flex-wrap gap-3">
        {labels.map((label, idx) => (
          <Button
            key={label}
            variant={selectedLabels.includes(label) ? "default" : "outline"}
            onClick={() => toggleLabel(label)}
            className="min-w-[100px]"
          >
            <span className="mr-2 text-xs opacity-60">({idx + 1})</span>
            {label}
          </Button>
        ))}
      </div>

      {/* Comment */}
      <Textarea
        placeholder="Note optionnelle..."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        className="text-sm"
      />

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {!showFlagInput ? (
            <Button variant="ghost" size="sm" onClick={() => setShowFlagInput(true)}>
              <Flag className="h-4 w-4 mr-1" /> Signaler
            </Button>
          ) : (
            <div className="flex gap-2 items-center">
              <Textarea
                placeholder="Raison du signalement..."
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                rows={1}
                className="w-64 text-sm"
              />
              <Button size="sm" variant="destructive" onClick={() => {
                if (flagReason) { onFlag(flagReason); setShowFlagInput(false); setFlagReason(""); }
              }}>
                Confirmer
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowFlagInput(false)}>
                Annuler
              </Button>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {onSkip && (
            <Button variant="outline" onClick={onSkip}>
              Passer (s)
            </Button>
          )}
          <Button onClick={handleSubmit} disabled={selectedLabels.length === 0}>
            Suivant <ArrowRight className="h-4 w-4 ml-1" />
            <span className="ml-1 text-xs opacity-60">(↵)</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
