import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";

const CALENDLY_URL = "https://calendly.com/steftalent/demo";

interface DemoDialogProps {
  trigger: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const DemoDialog = ({ trigger, open: controlledOpen, onOpenChange }: DemoDialogProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  useEffect(() => {
    if (!open) return;
    // Load Calendly script once
    if (!document.querySelector('script[src*="calendly.com/assets/external/widget.js"]')) {
      const script = document.createElement("script");
      script.src = "https://assets.calendly.com/assets/external/widget.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl w-[100vw] h-[100dvh] sm:h-auto sm:max-h-[90vh] p-0 sm:p-0 bg-card border-border overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Calendar className="w-5 h-5 text-primary" />
            Réserver une démo
          </DialogTitle>
        </DialogHeader>
        <div
          className="calendly-inline-widget w-full"
          data-url={`${CALENDLY_URL}?hide_event_type_details=1&hide_gdpr_banner=1&background_color=09090b&text_color=ffffff&primary_color=7B6FF0`}
          style={{ minWidth: "320px", height: "calc(100dvh - 80px)", maxHeight: "700px" }}
        />
      </DialogContent>
    </Dialog>
  );
};
