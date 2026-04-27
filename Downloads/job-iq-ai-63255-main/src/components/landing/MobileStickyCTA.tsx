import { useEffect, useState } from "react";
import { RequestQuoteButton } from "./CTAs";

export const MobileStickyCTA = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 200);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-background/95 backdrop-blur border-t border-primary/20 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <RequestQuoteButton size="lg" className="w-full h-12" />
    </div>
  );
};
