import { FileText } from "lucide-react";
import { ServicesWidget } from "../components/widgets/ServicesWidget.js";
import { SystemStatus } from "../components/widgets/SystemStatus.js";
import { Card } from "../components/ui/Card.js";
import { apiClient } from "../services/api.js";
import { useApi } from "../hooks/useApi.js";

export const DashboardPage = () => {
  const { data } = useApi(() => apiClient.logs("frpc"));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-slate-50">Dashboard</h2>
        <p className="mt-1 text-sm text-slate-500">Estado actual del Poco F3</p>
      </div>
      <SystemStatus />
      <div className="grid gap-4 xl:grid-cols-[1fr_1.15fr]">
        <ServicesWidget />
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">frpc</h2>
            <FileText className="h-5 w-5 text-cyanGlow" />
          </div>
          <pre className="max-h-80 overflow-auto rounded-md bg-ink p-4 text-xs leading-6 text-slate-300">
            {(data?.lines ?? ["Sin logs"]).join("\n")}
          </pre>
        </Card>
      </div>
    </div>
  );
};
