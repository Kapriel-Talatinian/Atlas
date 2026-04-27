import { useEffect, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface TrustScoreCircleProps {
  score: number;
  size?: number;
  label?: string;
  className?: string;
}

export function TrustScoreCircle({ score, size = 120, label = "Score de confiance", className }: TrustScoreCircleProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const strokeWidth = size >= 100 ? 8 : 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (animatedScore / 100) * circumference;

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedScore(score), 200);
    return () => clearTimeout(timer);
  }, [score]);

  const color = score >= 80 ? "hsl(142, 71%, 45%)" : score >= 60 ? "hsl(38, 92%, 50%)" : "hsl(0, 84%, 60%)";
  const bgColor = score >= 80 ? "hsl(142, 71%, 45%, 0.1)" : score >= 60 ? "hsl(38, 92%, 50%, 0.1)" : "hsl(0, 84%, 60%, 0.1)";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`flex flex-col items-center gap-2 ${className || ""}`}>
          <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                className="text-muted/30"
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={circumference - progress}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
                style={{ filter: `drop-shadow(0 0 6px ${bgColor})` }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="font-mono font-bold text-foreground"
                style={{ fontSize: size >= 100 ? 28 : 20 }}
              >
                {Math.round(animatedScore)}
              </span>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs max-w-[200px]">
          Ce score reflète la qualité et la fiabilité de vos annotations. Il est calculé automatiquement.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
