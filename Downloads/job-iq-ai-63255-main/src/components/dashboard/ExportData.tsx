import { Button } from "@/components/ui/button";
import { Download, FileText, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

interface ExportDataProps {
  data: any[];
  filename: string;
  type: "csv" | "json";
}

export const ExportData = ({ data, filename, type }: ExportDataProps) => {
  const exportToCSV = () => {
    if (!data || data.length === 0) {
      toast.error("Aucune donnée à exporter");
      return;
    }

    try {
      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(","),
        ...data.map(row => 
          headers.map(header => {
            const value = row[header];
            if (value === null || value === undefined) return "";
            if (typeof value === "object") return JSON.stringify(value);
            return `"${String(value).replace(/"/g, '""')}"`;
          }).join(",")
        )
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${filename}.csv`;
      link.click();
      
      toast.success("Export CSV réussi");
    } catch (error) {
      console.error("Error exporting CSV:", error);
      toast.error("Erreur lors de l'export CSV");
    }
  };

  const exportToJSON = () => {
    if (!data || data.length === 0) {
      toast.error("Aucune donnée à exporter");
      return;
    }

    try {
      const jsonContent = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonContent], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${filename}.json`;
      link.click();
      
      toast.success("Export JSON réussi");
    } catch (error) {
      console.error("Error exporting JSON:", error);
      toast.error("Erreur lors de l'export JSON");
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={type === "csv" ? exportToCSV : exportToJSON}
    >
      <Download className="w-4 h-4 mr-2" />
      {type === "csv" ? (
        <>
          <FileSpreadsheet className="w-4 h-4 mr-1" />
          Export CSV
        </>
      ) : (
        <>
          <FileText className="w-4 h-4 mr-1" />
          Export JSON
        </>
      )}
    </Button>
  );
};
