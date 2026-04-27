import { Button } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { DemoDialog } from "./DemoDialog";
import { cn } from "@/lib/utils";

type Size = "default" | "sm" | "lg";

const scrollOrNavigateToPricing = (navigate: ReturnType<typeof useNavigate>, isHome: boolean) => {
  if (isHome) {
    const el = document.getElementById("pricing");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
  }
  navigate("/#pricing");
};

interface RequestQuoteButtonProps {
  size?: Size;
  className?: string;
  label?: string;
  variant?: "default" | "outline" | "ghost";
  withArrow?: boolean;
  onBeforeNavigate?: () => void;
}

export const RequestQuoteButton = ({
  size = "default",
  className = "",
  label = "Demander un devis",
  variant = "default",
  withArrow = true,
  onBeforeNavigate,
}: RequestQuoteButtonProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === "/";

  const handleClick = () => {
    onBeforeNavigate?.();
    // Defer scroll so any UI dismissal (e.g. closing a mobile menu) settles first
    if (onBeforeNavigate) {
      setTimeout(() => scrollOrNavigateToPricing(navigate, isHome), 100);
    } else {
      scrollOrNavigateToPricing(navigate, isHome);
    }
  };

  return (
    <Button
      size={size}
      variant={variant}
      onClick={handleClick}
      className={cn(className)}
    >
      {label}
      {withArrow && <ArrowRight className="w-4 h-4" />}
    </Button>
  );
};

interface WatchDemoButtonProps {
  size?: Size;
  className?: string;
  label?: string;
  variant?: "default" | "outline" | "ghost";
}

export const WatchDemoButton = ({
  size = "default",
  className = "",
  label = "Voir la démo",
  variant = "outline",
}: WatchDemoButtonProps) => (
  <DemoDialog
    trigger={
      <Button size={size} variant={variant} className={cn(className)}>
        <Play className="w-4 h-4" />
        {label}
      </Button>
    }
  />
);
