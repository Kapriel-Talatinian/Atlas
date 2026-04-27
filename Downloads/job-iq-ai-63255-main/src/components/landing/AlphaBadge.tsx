import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AlphaBadgeProps {
  value: number;
  size?: "sm" | "md" | "lg";
  animated?: boolean;
  className?: string;
}

export const AlphaBadge = ({ value, size = "md", animated = false, className }: AlphaBadgeProps) => {
  const isGood = value >= 0.80;
  const isMid = value >= 0.67 && value < 0.80;

  const sizeClasses = {
    sm: "w-12 h-12 text-sm",
    md: "w-20 h-20 text-lg",
    lg: "w-32 h-32 text-3xl",
  };

  return (
    <motion.div
      initial={animated ? { scale: 0.8, opacity: 0 } : undefined}
      whileInView={animated ? { scale: 1, opacity: 1 } : undefined}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={cn(
        "relative rounded-full flex items-center justify-center font-mono font-bold",
        sizeClasses[size],
        isGood && "text-success",
        isMid && "text-[hsl(38,92%,50%)]",
        !isGood && !isMid && "text-destructive",
        className
      )}
    >
      {/* Ring */}
      <svg className="absolute inset-0" viewBox="0 0 100 100">
        <circle
          cx="50" cy="50" r="45"
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="2"
        />
        <motion.circle
          cx="50" cy="50" r="45"
          fill="none"
          stroke={isGood ? "hsl(142, 71%, 45%)" : isMid ? "hsl(38, 92%, 50%)" : "hsl(0, 72%, 51%)"}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * 45}`}
          initial={{ strokeDashoffset: 2 * Math.PI * 45 }}
          whileInView={{ strokeDashoffset: 2 * Math.PI * 45 * (1 - value) }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
          transform="rotate(-90 50 50)"
        />
      </svg>
      {/* Glow */}
      {isGood && animated && (
        <div className="absolute inset-0 rounded-full animate-pulse-glow glow-success" />
      )}
      <div className="relative flex flex-col items-center">
        <span className="text-[0.4em] text-muted-foreground font-normal tracking-wider">α</span>
        <span>{value.toFixed(2)}</span>
      </div>
    </motion.div>
  );
};
