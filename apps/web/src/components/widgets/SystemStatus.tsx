import type { SystemStatus as SystemStatusType } from "@poco-cloud/shared";
import { Battery, Cpu, HardDrive, MemoryStick, Network, Timer } from "lucide-react";
import { useEffect } from "react";
import { apiClient } from "../../services/api.js";
import { useApi } from "../../hooks/useApi.js";
import { Card } from "../ui/Card.js";
import { Spinner } from "../ui/Spinner.js";

const formatUptime = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

const Bar = ({ value }: { value: number }) => (
  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
    <div className="h-full rounded-full bg-cyanGlow transition-all" style={{ width: `${Math.min(100, value)}%` }} />
  </div>
);

export const SystemStatus = () => {
  const { data, loading, reload } = useApi<SystemStatusType>(() => apiClient.systemStatus());

  useEffect(() => {
    const timer = window.setInterval(() => void reload(), 5000);
    return () => window.clearInterval(timer);
  }, [reload]);

  if (loading || !data) {
    return (
      <Card className="grid min-h-48 place-items-center">
        <Spinner />
      </Card>
    );
  }

  const memoryPercent = Math.round((data.memory.usedMb / data.memory.totalMb) * 100);

  const cards = [
    {
      label: "RAM",
      value: `${data.memory.usedMb} / ${data.memory.totalMb} MB`,
      icon: MemoryStick,
      bar: memoryPercent
    },
    {
      label: "Disco",
      value: `${data.disk.usedGb} / ${data.disk.totalGb} GB`,
      icon: HardDrive,
      bar: data.disk.usedPercent
    },
    {
      label: "Bateria",
      value: data.battery.available ? `${data.battery.percentage ?? 0}% ${data.battery.status ?? ""}` : "No disponible",
      icon: Battery,
      bar: data.battery.percentage ?? 0
    },
    {
      label: "Uptime",
      value: formatUptime(data.uptimeSeconds),
      icon: Timer
    },
    {
      label: "CPU",
      value: `${data.loadAverage[0] ?? 0} carga`,
      icon: Cpu
    },
    {
      label: "Red",
      value: `${data.network.interfaces.length} interfaces`,
      icon: Network
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((item) => (
        <Card key={item.label}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-400">{item.label}</p>
              <p className="mt-2 text-xl font-semibold text-slate-50">{item.value}</p>
            </div>
            <div className="rounded-md bg-cyanGlow/10 p-2 text-cyanGlow">
              <item.icon className="h-5 w-5" />
            </div>
          </div>
          {typeof item.bar === "number" ? <Bar value={item.bar} /> : null}
        </Card>
      ))}
    </div>
  );
};
