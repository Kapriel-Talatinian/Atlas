import { motion } from "framer-motion";

const curlCode = `curl -X POST https://api.steftalent.fr/v1/projects \\
  -H "Authorization: Bearer stef_live_xxx" \\
  -d '{
    "domain": "medical",
    "task_type": "scoring",
    "num_tasks": 1000
  }'`;

export const IntegrationSection = () => {
  return (
    <section className="py-24 lg:py-32 px-4 sm:px-8 lg:px-4 border-t border-border">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-foreground mb-4">API ou dashboard. Vous choisissez.</h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Intégrez STEF dans votre pipeline existant ou gérez tout depuis l'interface.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Dashboard mockup */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            <div className="px-4 sm:px-6 py-4 border-b border-border flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-success" />
              <span className="text-sm text-foreground font-medium">Dashboard Client</span>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              {/* Project row */}
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-foreground">Mistral Medical v2</span>
                  <span className="text-[11px] font-mono text-success bg-success/10 px-2 py-0.5 rounded">active</span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-[11px] text-muted-foreground">Tâches</div>
                    <div className="text-sm font-mono text-foreground">450 / 1000</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">Alpha</div>
                    <div className="text-sm font-mono text-success">0.84</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">Délai</div>
                    <div className="text-sm font-mono text-foreground">J+7</div>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="mt-3 h-1.5 rounded-full bg-border overflow-hidden">
                  <div className="h-full rounded-full bg-primary w-[45%]" />
                </div>
              </div>
              {/* Second project */}
              <div className="rounded-lg border border-border p-4 opacity-60">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">Legal DPO Dataset</span>
                  <span className="text-[11px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">draft</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* API code */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border">
              <div className="w-2.5 h-2.5 rounded-full bg-destructive/30" />
              <div className="w-2.5 h-2.5 rounded-full bg-[hsl(38,92%,50%)]/30" />
              <div className="w-2.5 h-2.5 rounded-full bg-success/30" />
              <span className="ml-3 text-[11px] text-muted-foreground font-mono">terminal</span>
            </div>
            <pre className="p-4 sm:p-6 overflow-x-auto text-[13px] leading-relaxed">
              <code className="text-foreground/90">{curlCode}</code>
            </pre>
            {/* Response */}
            <div className="border-t border-border px-4 sm:px-6 py-4">
              <div className="text-[11px] text-muted-foreground mb-2 font-mono">→ 201 Created</div>
              <pre className="text-[12px] text-success/80 font-mono overflow-x-auto">
{`{
  "id": "proj_4f8a...",
  "status": "draft",
  "estimated_cost": 25000
}`}
              </pre>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
