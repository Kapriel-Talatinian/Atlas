import { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Flag, ArrowRight, ArrowLeft, X, Clock } from "lucide-react";

interface SpanAnnotation {
  start: number;
  end: number;
  label: string;
  text: string;
}

interface SpanAnnotationInterfaceProps {
  item: {
    id: string;
    content: { primary: string };
  };
  labels: { key: string; label: string; color: string }[];
  onSubmit: (value: { type: "spans"; spans: SpanAnnotation[] }) => void;
  onFlag: (reason: string) => void;
  onPrevious?: () => void;
  progress: { current: number; total: number };
  sessionDuration: number;
}

export function SpanAnnotationInterface({
  item,
  labels,
  onSubmit,
  onFlag,
  onPrevious,
  progress,
  sessionDuration,
}: SpanAnnotationInterfaceProps) {
  const [spans, setSpans] = useState<SpanAnnotation[]>([]);
  const [activeLabel, setActiveLabel] = useState<string>(labels[0]?.key || "");
  const textRef = useRef<HTMLDivElement>(null);

  const handleTextSelect = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !textRef.current) return;

    const range = selection.getRangeAt(0);
    const textContent = item.content.primary;

    // Calculate offsets relative to the text content
    const startNode = range.startContainer;
    const endNode = range.endContainer;

    // Simple offset calculation
    let start = 0;
    let end = 0;
    const walker = document.createTreeWalker(textRef.current, NodeFilter.SHOW_TEXT);
    let currentOffset = 0;
    let node;

    while ((node = walker.nextNode())) {
      if (node === startNode) {
        start = currentOffset + range.startOffset;
      }
      if (node === endNode) {
        end = currentOffset + range.endOffset;
        break;
      }
      currentOffset += (node.textContent?.length || 0);
    }

    if (start === end) return;

    const selectedText = textContent.slice(start, end).trim();
    if (!selectedText) return;

    // Check for overlap
    const overlaps = spans.some(
      s => (start >= s.start && start < s.end) || (end > s.start && end <= s.end)
    );

    if (!overlaps) {
      setSpans(prev => [
        ...prev,
        { start, end, label: activeLabel, text: selectedText },
      ].sort((a, b) => a.start - b.start));
    }

    selection.removeAllRanges();
  }, [activeLabel, item.content.primary, spans]);

  const removeSpan = useCallback((index: number) => {
    setSpans(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = useCallback(() => {
    onSubmit({ type: "spans", spans });
    setSpans([]);
  }, [spans, onSubmit]);

  // Render text with highlights
  const renderAnnotatedText = () => {
    const text = item.content.primary;
    if (spans.length === 0) return text;

    const parts: { text: string; span?: SpanAnnotation }[] = [];
    let lastEnd = 0;

    for (const span of spans) {
      if (span.start > lastEnd) {
        parts.push({ text: text.slice(lastEnd, span.start) });
      }
      parts.push({ text: text.slice(span.start, span.end), span });
      lastEnd = span.end;
    }
    if (lastEnd < text.length) {
      parts.push({ text: text.slice(lastEnd) });
    }

    return parts.map((part, i) => {
      if (part.span) {
        const labelInfo = labels.find(l => l.key === part.span!.label);
        return (
          <span
            key={i}
            className="px-0.5 rounded font-semibold cursor-pointer"
            style={{ backgroundColor: labelInfo?.color || "hsl(var(--primary) / 0.2)" }}
            title={`${labelInfo?.label || part.span!.label} — cliquez pour supprimer`}
            onClick={() => {
              const idx = spans.findIndex(s => s.start === part.span!.start);
              if (idx >= 0) removeSpan(idx);
            }}
          >
            {part.text}
            <sup className="text-[10px] ml-0.5 opacity-70">
              {labelInfo?.label?.slice(0, 3).toUpperCase()}
            </sup>
          </span>
        );
      }
      return <span key={i}>{part.text}</span>;
    });
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    return `${m}m`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
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

      {/* Label bar */}
      <div className="flex flex-wrap gap-2">
        {labels.map((label, idx) => (
          <Button
            key={label.key}
            variant={activeLabel === label.key ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveLabel(label.key)}
            style={activeLabel === label.key ? { backgroundColor: label.color } : {}}
          >
            <span className="mr-1 text-xs opacity-60">({idx + 1})</span>
            {label.label}
          </Button>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        Sélectionnez du texte puis le label s'applique automatiquement. Label actif : <strong>{labels.find(l => l.key === activeLabel)?.label}</strong>
      </p>

      {/* Text to annotate */}
      <Card className="border-2">
        <CardContent className="py-6">
          <div
            ref={textRef}
            className="text-lg leading-relaxed select-text cursor-text"
            onMouseUp={handleTextSelect}
          >
            {renderAnnotatedText()}
          </div>
        </CardContent>
      </Card>

      {/* Annotations list */}
      {spans.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Annotations ({spans.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {spans.map((span, i) => {
              const labelInfo = labels.find(l => l.key === span.label);
              return (
                <div key={i} className="flex items-center justify-between text-sm border rounded p-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      style={{ borderColor: labelInfo?.color, color: labelInfo?.color }}
                    >
                      {labelInfo?.label}
                    </Badge>
                    <span className="font-medium">"{span.text}"</span>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => removeSpan(i)}>
                    <X className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => onFlag("Problème avec l'item")}>
            <Flag className="h-4 w-4 mr-1" /> Signaler
          </Button>
        </div>

        <div className="flex gap-2">
          {onPrevious && (
            <Button variant="outline" onClick={onPrevious}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Précédent
            </Button>
          )}
          <Button onClick={handleSubmit}>
            Suivant <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
