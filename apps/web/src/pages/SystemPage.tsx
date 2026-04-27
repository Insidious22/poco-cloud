import { BatteryCharging, Lock, ShieldCheck } from "lucide-react";
import { Card } from "../components/ui/Card.js";
import { SystemStatus } from "../components/widgets/SystemStatus.js";

export const SystemPage = () => (
  <div className="space-y-5">
    <h2 className="text-2xl font-semibold text-slate-50">Sistema</h2>
    <SystemStatus />
    <div className="grid gap-4 md:grid-cols-3">
      {[
        { icon: BatteryCharging, title: "Wake lock", value: "termux-wake-lock" },
        { icon: ShieldCheck, title: "Termux", value: "Boot + bateria sin restricciones" },
        { icon: Lock, title: "Backups", value: "SQLite + archivos del proyecto" }
      ].map((item) => (
        <Card key={item.title}>
          <item.icon className="mb-4 h-5 w-5 text-cyanGlow" />
          <h3 className="font-semibold text-slate-100">{item.title}</h3>
          <p className="mt-2 text-sm text-slate-500">{item.value}</p>
        </Card>
      ))}
    </div>
  </div>
);
