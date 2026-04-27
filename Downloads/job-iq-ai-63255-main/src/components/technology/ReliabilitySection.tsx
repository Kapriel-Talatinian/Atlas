import { useRef, useEffect, useState } from "react";
import { motion, useInView } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, ReferenceArea, ResponsiveContainer, Tooltip } from "recharts";

// Fake but realistic monitoring data
const MONITORING_DATA = Array.from({ length: 20 }, (_, i) => {
  const base = 0.84;
  const noise = Math.sin(i * 0.8) * 0.04 + (Math.random() - 0.5) * 0.03;
  const dip = i >= 12 && i <= 14 ? -0.08 : 0;
  const recovery = i === 15 ? 0.03 : i === 16 ? 0.05 : 0;
  return {
    batch: `B${(i + 1).toString().padStart(2, "0")}`,
    alpha: Math.max(0.65, Math.min(0.95, base + noise + dip + recovery)),
    alert: i === 13,
  };
});

function AlphaBadge() {
  const [value, setValue] = useState(0.84);

  useEffect(() => {
    const interval = setInterval(() => {
      setValue(0.84 + (Math.random() - 0.5) * 0.04);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[180px] h-[180px] sm:w-[200px] sm:h-[200px]">
        {/* Concentric zones */}
        <svg viewBox="0 0 200 200" className="w-full h-full">
          {/* Outer red zone */}
          <circle cx="100" cy="100" r="96" fill="none" stroke="#EF4444" strokeWidth="1" strokeOpacity="0.15" />
          <circle cx="100" cy="100" r="96" fill="#EF4444" fillOpacity="0.03" />
          {/* Middle orange zone */}
          <circle cx="100" cy="100" r="76" fill="none" stroke="#F59E0B" strokeWidth="1" strokeOpacity="0.15" />
          <circle cx="100" cy="100" r="76" fill="#F59E0B" fillOpacity="0.03" />
          {/* Inner green zone */}
          <circle cx="100" cy="100" r="56" fill="none" stroke="#22C55E" strokeWidth="1" strokeOpacity="0.2" />
          <circle cx="100" cy="100" r="56" fill="#22C55E" fillOpacity="0.05" />

          {/* Progress arc */}
          <motion.circle
            cx="100"
            cy="100"
            r="88"
            fill="none"
            stroke="#22C55E"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={`${value * 553} ${553 - value * 553}`}
            transform="rotate(-90 100 100)"
            initial={{ strokeDasharray: "0 553" }}
            animate={{ strokeDasharray: `${value * 553} ${553 - value * 553}` }}
            transition={{ duration: 1, ease: "easeOut" }}
            style={{ filter: "drop-shadow(0 0 6px rgba(34, 197, 94, 0.4))" }}
          />
        </svg>

        {/* Center value */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] text-white/30 mb-1">α =</span>
          <motion.span
            className="text-[32px] font-bold font-mono text-[#22C55E]"
            key={value.toFixed(2)}
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {value.toFixed(2)}
          </motion.span>
        </div>
      </div>

      {/* Zone labels */}
      <div className="flex items-center gap-6 mt-6">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#22C55E]" />
          <span className="text-[11px] text-white/40">≥ 0.80 Fiable</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#F59E0B]" />
          <span className="text-[11px] text-white/40">0.67–0.80</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#EF4444]" />
          <span className="text-[11px] text-white/40">&lt; 0.67</span>
        </div>
      </div>
    </div>
  );
}

function MonitoringChart() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      className="w-full h-[220px] mt-12"
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6 }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={MONITORING_DATA} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <ReferenceArea y1={0.8} y2={1} fill="#22C55E" fillOpacity={0.04} />
          <ReferenceArea y1={0.67} y2={0.8} fill="#F59E0B" fillOpacity={0.03} />
          <ReferenceArea y1={0} y2={0.67} fill="#EF4444" fillOpacity={0.03} />
          <ReferenceLine y={0.8} stroke="#22C55E" strokeDasharray="4 4" strokeOpacity={0.3} />
          <ReferenceLine y={0.67} stroke="#EF4444" strokeDasharray="4 4" strokeOpacity={0.2} />
          <XAxis dataKey="batch" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.2)" }} axisLine={false} tickLine={false} />
          <YAxis domain={[0.6, 1]} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.2)" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1A1A1F",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "rgba(255,255,255,0.7)",
            }}
            formatter={(value: number) => [value.toFixed(3), "α"]}
          />
          <Line
            type="monotone"
            dataKey="alpha"
            stroke="#7B6FF0"
            strokeWidth={2}
            dot={(props: any) => {
              const { cx, cy, payload } = props;
              if (payload.alert) {
                return (
                  <circle key={`dot-${cx}`} cx={cx} cy={cy} r={4} fill="#EF4444" stroke="#EF4444" strokeWidth={2}>
                    <animate attributeName="r" values="4;6;4" dur="1.5s" repeatCount="indefinite" />
                  </circle>
                );
              }
              return <circle key={`dot-${cx}`} cx={cx} cy={cy} r={0} />;
            }}
            activeDot={{ r: 3, fill: "#7B6FF0" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

export function ReliabilitySection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <div className="py-24 sm:py-32 border-t border-white/[0.04]" ref={ref}>
      <div className="max-w-[800px] mx-auto px-4 mb-16">
        <motion.h2
          className="text-[28px] font-bold text-white/90 mb-3"
          initial={{ opacity: 0, y: 15 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
        >
          La fiabilité n'est pas une promesse. C'est une mesure.
        </motion.h2>
        <motion.p
          className="text-base text-white/40"
          initial={{ opacity: 0, y: 15 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.1 }}
        >
          Krippendorff's Alpha — la référence en sciences de l'annotation.
        </motion.p>
      </div>

      <div className="max-w-[800px] mx-auto px-4">
        <div className="flex justify-center mb-16">
          <AlphaBadge />
        </div>

        <div className="space-y-6">
          <p className="text-[15px] leading-[1.7] text-white/50">
            Krippendorff's Alpha est un coefficient statistique qui mesure le degré d'accord entre plusieurs
            annotateurs indépendants. Contrairement à un simple pourcentage d'accord, il corrige l'accord
            qui serait attendu par hasard. Un alpha de 0.80 signifie que l'accord observé dépasse
            significativement ce que le hasard produirait.
          </p>
          <p className="text-[15px] leading-[1.7] text-white/50">
            Sur STEF, l'alpha est calculé par dimension, par tâche et par batch glissant. Cela signifie
            que nous savons exactement quelle dimension est fiable et laquelle nécessite une attention
            supplémentaire. Un dataset peut avoir un excellent alpha en correction (0.92) mais un alpha
            plus faible en sécurité (0.76) — et nous le savons avant vous.
          </p>
        </div>

        <div className="mt-16">
          <h3 className="text-lg font-semibold text-white/80 mb-3">Monitoring continu</h3>
          <p className="text-[15px] leading-[1.7] text-white/50">
            ARES ne calcule pas l'alpha une seule fois. Il le surveille en continu. Toutes les 100 annotations,
            le système compare le batch actuel au précédent. Si l'alpha baisse de plus de 0.05 sur n'importe
            quelle dimension, une alerte est déclenchée automatiquement. Les annotateurs sont recalibrés.
            Les prompts sont réoptimisés. Le pipeline s'auto-corrige avant que la qualité ne se dégrade.
          </p>
        </div>

        <MonitoringChart />
        <p className="text-[11px] text-white/20 mt-2 text-center font-mono">
          Point rouge : alerte de dérive détectée → auto-correction
        </p>
      </div>
    </div>
  );
}
