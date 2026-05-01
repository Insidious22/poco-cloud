import type { ManagedService } from "@poco-cloud/shared";
import { Activity } from "lucide-react";
import { useEffect } from "react";
import { apiClient } from "../../services/api.js";
import { useApi } from "../../hooks/useApi.js";
import { Badge } from "../ui/Badge.js";
import { Card } from "../ui/Card.js";

export const ServicesWidget = () => {
  const { data, reload } = useApi<ManagedService[]>(() => apiClient.services());

  useEffect(() => {
    const timer = window.setInterval(() => void reload(), 5000);
    return () => window.clearInterval(timer);
  }, [reload]);

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100">Servicios</h2>
        <Activity className="h-5 w-5 text-cyanGlow" />
      </div>
      <div className="space-y-3">
        {(data ?? []).slice(0, 4).map((service) => (
          <div key={service.name} className="flex items-center justify-between gap-3 rounded-md border border-line bg-ink/40 p-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-100">{service.label}</p>
              <p className="truncate text-xs text-slate-500">{service.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge tone={service.status === "running" ? "success" : "danger"}>{service.status}</Badge>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
