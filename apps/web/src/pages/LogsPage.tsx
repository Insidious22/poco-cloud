import type { LogName } from "@poco-cloud/shared";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { apiClient } from "../services/api.js";

const logs: LogName[] = ["frpc", "api", "web", "jellyfin", "filebrowser"];

export const LogsPage = () => {
  const [selected, setSelected] = useState<LogName>("frpc");
  const [lines, setLines] = useState<string[]>([]);

  const load = async () => {
    const response = await apiClient.logs(selected);
    setLines(response.lines);
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, [selected]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold text-slate-50">Logs</h2>
        <Button variant="secondary" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </Button>
      </div>
      <Card>
        <div className="mb-4 flex flex-wrap gap-2">
          {logs.map((item) => (
            <Button key={item} variant={selected === item ? "primary" : "secondary"} onClick={() => setSelected(item)}>
              {item}
            </Button>
          ))}
        </div>
        <pre className="max-h-[65vh] overflow-auto rounded-md bg-ink p-4 text-xs leading-6 text-slate-300">
          {lines.join("\n")}
        </pre>
      </Card>
    </div>
  );
};
