import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QualityTab } from "./settings/QualityTab";
import { PricingTab } from "./settings/PricingTab";
import { ExpertPayTab } from "./settings/ExpertPayTab";
import { VolumeDiscountsTab } from "./settings/VolumeDiscountsTab";
import { SLATab } from "./settings/SLATab";
import { SystemTab } from "./settings/SystemTab";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "quality", label: "Qualité" },
  { id: "pricing", label: "Tarification client" },
  { id: "experts", label: "Rémunération experts" },
  { id: "discounts", label: "Remises volume" },
  { id: "sla", label: "Niveaux de service" },
  { id: "system", label: "Système" },
];

export function AdminSettingsPage() {
  const [dirtyTabs, setDirtyTabs] = useState<Record<string, boolean>>({});

  const handleDirtyChange = useCallback((tabId: string) => (dirty: boolean) => {
    setDirtyTabs(prev => ({ ...prev, [tabId]: dirty }));
  }, []);

  // Warn on page leave if unsaved changes
  useEffect(() => {
    const hasDirty = Object.values(dirtyTabs).some(Boolean);
    const handler = (e: BeforeUnloadEvent) => {
      if (hasDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirtyTabs]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Paramètres</h1>
        <p className="text-sm text-muted-foreground mt-1">Configuration globale de la plateforme. Les modifications prennent effet immédiatement.</p>
      </div>

      <Tabs defaultValue="quality" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap bg-transparent border-b border-border rounded-none h-auto p-0 gap-0">
          {TABS.map(tab => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="relative rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground whitespace-nowrap"
            >
              {tab.label}
              {dirtyTabs[tab.id] && (
                <span className="absolute top-1.5 right-1 w-2 h-2 rounded-full bg-amber-500" />
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-6">
          <TabsContent value="quality"><QualityTab onDirtyChange={handleDirtyChange("quality")} /></TabsContent>
          <TabsContent value="pricing"><PricingTab onDirtyChange={handleDirtyChange("pricing")} /></TabsContent>
          <TabsContent value="experts"><ExpertPayTab onDirtyChange={handleDirtyChange("experts")} /></TabsContent>
          <TabsContent value="discounts"><VolumeDiscountsTab onDirtyChange={handleDirtyChange("discounts")} /></TabsContent>
          <TabsContent value="sla"><SLATab onDirtyChange={handleDirtyChange("sla")} /></TabsContent>
          <TabsContent value="system"><SystemTab onDirtyChange={handleDirtyChange("system")} /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
