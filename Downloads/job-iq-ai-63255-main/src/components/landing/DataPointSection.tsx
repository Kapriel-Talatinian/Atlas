import { motion } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";

const FORMATS = ["JSONL", "Parquet", "HuggingFace"] as const;

const jsonlCode = `{
  "prompt": "Quels sont les effets secondaires du paracétamol ?",
  "response": "Le paracétamol est généralement bien toléré...",
  "annotations": {
    "correctness": 4.2,
    "safety": 3.8,
    "completeness": 3.5,
    "reasoning_depth": 4.0
  },
  "preference": "A",
  "alpha": 0.87,
  "domain": "medical",
  "validated": true
}`;

const parquetCode = `schema {
  required binary prompt (STRING);
  required binary response (STRING);
  required group annotations {
    required float correctness;
    required float safety;
    required float completeness;
    required float reasoning_depth;
  }
  required binary preference (STRING);
  required float alpha;
  required binary domain (STRING);
  required boolean validated;
}`;

const hfCode = `from datasets import load_dataset

dataset = load_dataset(
    "stef-ai/medical-rlhf-v2",
    split="train"
)

# 987 validated datapoints
# α ≥ 0.80 on all items
# 10 scoring dimensions

print(dataset[0])
# {'prompt': '...', 'annotations': {...}, ...}`;

const CODE_MAP: Record<string, string> = {
  JSONL: jsonlCode,
  Parquet: parquetCode,
  HuggingFace: hfCode,
};

export const DataPointSection = () => {
  const [format, setFormat] = useState<string>("JSONL");

  return (
    <section className="py-24 lg:py-32 px-4 sm:px-8 lg:px-4 border-t border-border">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-foreground mb-4">Un datapoint STEF.</h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Ce que vous recevez. Pas du marketing — de la donnée.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative"
        >
          {/* Format toggle — scrollable on mobile */}
          <div className="flex gap-1 mb-4 p-1 bg-card rounded-lg border border-border w-fit max-w-full overflow-x-auto">
            {FORMATS.map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={cn(
                  "px-4 py-1.5 text-[13px] rounded-md transition-all font-mono whitespace-nowrap min-h-[44px] sm:min-h-0",
                  format === f
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Code block */}
          <div className="relative rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border">
              <div className="w-2.5 h-2.5 rounded-full bg-destructive/30" />
              <div className="w-2.5 h-2.5 rounded-full bg-[hsl(38,92%,50%)]/30" />
              <div className="w-2.5 h-2.5 rounded-full bg-success/30" />
              <span className="ml-3 text-[11px] text-muted-foreground font-mono">
                output.{format === "HuggingFace" ? "py" : format.toLowerCase()}
              </span>
            </div>
            <pre className="p-4 sm:p-6 overflow-x-auto text-[13px] leading-relaxed">
              <code className="text-foreground/90">{CODE_MAP[format]}</code>
            </pre>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
