import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { RefreshCw, Search } from "lucide-react";

type LogTab = "audit" | "pii" | "errors";

export function AdminLogsPage() {
  const [tab, setTab] = useState<LogTab>("audit");
  const [search, setSearch] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const queryClient = useQueryClient();

  // Auto-refresh every 5 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["admin-audit-logs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-pii-logs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-error-logs"] });
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, queryClient]);

  const { data: auditLogs, isLoading: auditLoading } = useQuery({
    queryKey: ["admin-audit-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200);
      return data || [];
    },
    enabled: tab === "audit",
    staleTime: 3000,
  });

  const { data: piiLogs, isLoading: piiLoading } = useQuery({
    queryKey: ["admin-pii-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("pii_logs").select("*").order("scanned_at", { ascending: false }).limit(200);
      return data || [];
    },
    enabled: tab === "pii",
    staleTime: 3000,
  });

  const { data: errorLogs, isLoading: errorLoading } = useQuery({
    queryKey: ["admin-error-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("api_request_logs").select("*").order("created_at", { ascending: false }).limit(200);
      return data || [];
    },
    enabled: tab === "errors",
    staleTime: 3000,
  });

  const isLoading = tab === "audit" ? auditLoading : tab === "pii" ? piiLoading : errorLoading;

  const filteredAudit = (auditLogs || []).filter(log =>
    !search || log.action?.toLowerCase().includes(search.toLowerCase()) || log.entity_type?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredErrors = (errorLogs || []).filter((log: any) =>
    !search || log.endpoint?.toLowerCase().includes(search.toLowerCase()) || log.method?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-foreground">Logs</h1>
        <div className="flex items-center gap-2">
          <Button variant={autoRefresh ? "default" : "outline"} size="sm" onClick={() => setAutoRefresh(!autoRefresh)}>
            <RefreshCw className={cn("w-4 h-4 mr-1", autoRefresh && "animate-spin")} />
            {autoRefresh ? "Live" : "Pause"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["admin-audit-logs"] });
            queryClient.invalidateQueries({ queryKey: ["admin-pii-logs"] });
            queryClient.invalidateQueries({ queryKey: ["admin-error-logs"] });
          }}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex gap-0.5 border border-border rounded-lg p-0.5 w-fit">
          {(["audit", "pii", "errors"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-1.5 rounded-md text-[13px] font-medium transition-colors",
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "audit" ? "Audit" : t === "pii" ? "PII" : "API / Erreurs"}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Filtrer..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
      ) : tab === "audit" ? (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[12px] uppercase tracking-wider sticky top-0 bg-background">Date</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider sticky top-0 bg-background">Action</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider sticky top-0 bg-background">Entité</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider sticky top-0 bg-background">ID entité</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider sticky top-0 bg-background">Utilisateur</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAudit.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-[13px] font-mono text-muted-foreground whitespace-nowrap">{new Date(log.created_at).toLocaleString("fr-FR")}</TableCell>
                    <TableCell className="text-sm font-medium">{log.action}</TableCell>
                    <TableCell><span className="text-[11px] px-1.5 py-0.5 rounded bg-muted">{log.entity_type}</span></TableCell>
                    <TableCell className="text-[13px] font-mono">{log.entity_id?.slice(0, 8) || "—"}</TableCell>
                    <TableCell className="text-[13px] font-mono text-muted-foreground">{log.user_id?.slice(0, 8) || "system"}</TableCell>
                  </TableRow>
                ))}
                {filteredAudit.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Aucun log</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : tab === "pii" ? (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[12px] uppercase tracking-wider sticky top-0 bg-background">Date</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider sticky top-0 bg-background">Candidat</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider sticky top-0 bg-background text-right">Détections</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider sticky top-0 bg-background">Catégories</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(piiLogs || []).map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-[13px] font-mono text-muted-foreground">{new Date(log.scanned_at).toLocaleString("fr-FR")}</TableCell>
                    <TableCell className="text-[13px] font-mono">{log.candidate_id?.slice(0, 8) || "—"}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{log.detections_count}</TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">
                      {Array.isArray(log.categories) ? log.categories.join(", ") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {(piiLogs || []).length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">Aucun scan PII</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[12px] uppercase tracking-wider sticky top-0 bg-background">Date</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider sticky top-0 bg-background">Endpoint</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider sticky top-0 bg-background">Méthode</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider sticky top-0 bg-background text-right">Status</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider sticky top-0 bg-background text-right">Latence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredErrors.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-[13px] font-mono text-muted-foreground whitespace-nowrap">{new Date(log.created_at).toLocaleString("fr-FR")}</TableCell>
                    <TableCell className="text-sm">{log.endpoint || "—"}</TableCell>
                    <TableCell><span className="text-[11px] px-1.5 py-0.5 rounded bg-muted">{log.method || "—"}</span></TableCell>
                    <TableCell className={cn("text-right font-mono text-sm", log.status_code >= 400 ? "text-destructive" : "text-success")}>{log.status_code || "—"}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">{log.latency_ms ? `${log.latency_ms}ms` : "—"}</TableCell>
                  </TableRow>
                ))}
                {filteredErrors.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Aucun log API</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}