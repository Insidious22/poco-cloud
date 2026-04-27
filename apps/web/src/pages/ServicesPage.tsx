import type { ManagedService } from "@poco-cloud/shared";
import { FileText, Play, Square } from "lucide-react";
import { useState } from "react";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { Modal } from "../components/ui/Modal.js";
import { useApi } from "../hooks/useApi.js";
import { apiClient } from "../services/api.js";

export const ServicesPage = () => {
  const { data, reload } = useApi<ManagedService[]>(() => apiClient.services());
  const [selected, setSelected] = useState<ManagedService | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const action = async (service: ManagedService, type: "start" | "stop") => {
    if (type === "start") await apiClient.startService(service.name);
    else await apiClient.stopService(service.name);
    await reload();
  };

  const openLogs = async (service: ManagedService) => {
    setSelected(service);
    const response = await apiClient.logs(service.logName);
    setLogs(response.lines);
  };

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-semibold text-slate-50">Servicios</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {(data ?? []).map((service) => (
          <Card key={service.name}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">{service.label}</h3>
                <p className="mt-1 text-sm text-slate-500">{service.description}</p>
              </div>
              <Badge tone={service.status === "running" ? "success" : "danger"}>{service.status}</Badge>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => void action(service, "start")}>
                <Play className="h-4 w-4" />
                Start
              </Button>
              <Button variant="secondary" onClick={() => void action(service, "stop")}>
                <Square className="h-4 w-4" />
                Stop
              </Button>
              <Button variant="ghost" onClick={() => void openLogs(service)}>
                <FileText className="h-4 w-4" />
                Logs
              </Button>
            </div>
          </Card>
        ))}
      </div>
      <Modal title={selected?.label ?? "Logs"} open={Boolean(selected)} onClose={() => setSelected(null)}>
        <pre className="max-h-[60vh] overflow-auto rounded-md bg-ink p-4 text-xs leading-6 text-slate-300">
          {logs.join("\n")}
        </pre>
      </Modal>
    </div>
  );
};
