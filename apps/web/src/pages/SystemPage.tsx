import type {
  SystemActionName,
  SystemConfigFile,
  SystemDiagnostics,
  SystemDiagnosticItem
} from "@poco-cloud/shared";
import {
  Activity,
  BatteryCharging,
  Cable,
  Eraser,
  FileCode2,
  Lock,
  Power,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldCheck,
  Terminal,
  Unlock
} from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { Spinner } from "../components/ui/Spinner.js";
import { SystemStatus } from "../components/widgets/SystemStatus.js";
import { apiClient } from "../services/api.js";

const statusTone = (status: SystemDiagnosticItem["status"]) => {
  if (status === "ok") return "success";
  if (status === "warning") return "warning";
  return "danger";
};

const processTone = (running: boolean) => (running ? "success" : "danger");

const actionGroups: Array<{
  title: string;
  description: string;
  actions: Array<{ action: SystemActionName; label: string; icon: typeof Lock; variant?: "primary" | "secondary" | "danger" | "ghost" }>;
}> = [
  {
    title: "Energia",
    description: "Control directo del wake lock de Termux.",
    actions: [
      { action: "wake-lock", label: "Mantener activo", icon: Lock, variant: "primary" },
      { action: "wake-unlock", label: "Liberar", icon: Unlock, variant: "secondary" }
    ]
  },
  {
    title: "Conectividad",
    description: "Servicios base para entrar al telefono desde fuera.",
    actions: [
      { action: "start-sshd", label: "Iniciar SSH", icon: Terminal, variant: "secondary" },
      { action: "restart-frpc", label: "Reiniciar frp", icon: RotateCcw, variant: "danger" }
    ]
  },
  {
    title: "Mantenimiento",
    description: "Limpieza de logs operativos.",
    actions: [
      { action: "clear-api-log", label: "Limpiar API", icon: Eraser, variant: "secondary" },
      { action: "clear-frpc-log", label: "Limpiar frp", icon: Eraser, variant: "secondary" }
    ]
  }
];

const ConfigBlock = ({ file }: { file: SystemConfigFile }) => (
  <div className="rounded-md border border-line bg-ink/70">
    <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
      <div className="min-w-0">
        <p className="font-semibold text-slate-100">{file.label}</p>
        <p className="truncate text-xs text-slate-500">{file.path}</p>
      </div>
      <Badge tone={file.exists ? "success" : "danger"}>{file.exists ? "activo" : "faltante"}</Badge>
    </div>
    <pre className="max-h-72 overflow-auto p-4 text-xs leading-6 text-slate-300">
      {file.exists ? file.content || "(archivo vacio)" : "No encontrado"}
    </pre>
  </div>
);

export const SystemPage = () => {
  const [diagnostics, setDiagnostics] = useState<SystemDiagnostics | null>(null);
  const [configs, setConfigs] = useState<SystemConfigFile[]>([]);
  const [bootLog, setBootLog] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<SystemActionName | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    const [diagnosticsResponse, configResponse, bootLogResponse] = await Promise.all([
      apiClient.systemDiagnostics(),
      apiClient.systemConfig(),
      apiClient.bootLogs()
    ]);
    setDiagnostics(diagnosticsResponse);
    setConfigs(configResponse);
    setBootLog(bootLogResponse.lines);
    setLoading(false);
  };

  const runAction = async (action: SystemActionName) => {
    setBusyAction(action);
    try {
      const response = await apiClient.systemAction(action);
      setNotice(response.message);
      await load(true);
    } catch {
      setNotice("No se pudo ejecutar la accion");
    } finally {
      setBusyAction(null);
    }
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 5000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyanGlow">Operaciones</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-50">Sistema</h2>
        </div>
        <Button variant="secondary" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </Button>
      </div>

      <SystemStatus />

      {notice ? (
        <div className="rounded-md border border-cyanGlow/30 bg-cyanGlow/10 px-4 py-3 text-sm text-cyan-100">
          {notice}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_1.15fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Diagnostico</h3>
              <p className="text-sm text-slate-500">
                {diagnostics ? new Date(diagnostics.checkedAt).toLocaleTimeString() : "Leyendo estado"}
              </p>
            </div>
            <Activity className="h-5 w-5 text-cyanGlow" />
          </div>

          {loading && !diagnostics ? (
            <div className="grid min-h-40 place-items-center">
              <Spinner />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                {(diagnostics?.processes ?? []).map((process) => (
                  <div key={process.name} className="rounded-md border border-line bg-ink/60 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-100">{process.name}</p>
                      <Badge tone={processTone(process.running)}>{process.running ? "online" : "offline"}</Badge>
                    </div>
                    <p className="mt-2 truncate text-xs text-slate-500">{process.pid ? `PID ${process.pid}` : process.detail}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                {(diagnostics?.files ?? []).map((item) => (
                  <div
                    key={item.key}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-ink/50 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-200">{item.label}</p>
                      <p className="truncate text-xs text-slate-500">{item.detail}</p>
                    </div>
                    <Badge tone={statusTone(item.status)}>{item.value}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Acciones</h3>
              <p className="text-sm text-slate-500">Controles permitidos del telefono y el tunel.</p>
            </div>
            <Power className="h-5 w-5 text-cyanGlow" />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {actionGroups.map((group) => (
              <div key={group.title} className="rounded-md border border-line bg-ink/60 p-4">
                <h4 className="font-semibold text-slate-100">{group.title}</h4>
                <p className="mt-1 min-h-10 text-sm text-slate-500">{group.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {group.actions.map((item) => (
                    <Button
                      key={item.action}
                      variant={item.variant ?? "secondary"}
                      disabled={Boolean(busyAction)}
                      onClick={() => void runAction(item.action)}
                    >
                      <item.icon className="h-4 w-4" />
                      {busyAction === item.action ? "Ejecutando" : item.label}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <FileCode2 className="h-5 w-5 text-cyanGlow" />
            <h3 className="text-lg font-semibold text-slate-100">Configuracion activa</h3>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {configs.map((file) => (
              <ConfigBlock key={file.key} file={file} />
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-cyanGlow" />
              <h3 className="text-lg font-semibold text-slate-100">Boot log</h3>
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <ShieldCheck className="h-4 w-4" />
              <Cable className="h-4 w-4" />
              <BatteryCharging className="h-4 w-4" />
            </div>
          </div>
          <pre className="max-h-[28rem] overflow-auto rounded-md bg-ink p-4 text-xs leading-6 text-slate-300">
            {bootLog.length ? bootLog.join("\n") : "Sin logs de arranque todavia."}
          </pre>
        </Card>
      </div>
    </div>
  );
};
