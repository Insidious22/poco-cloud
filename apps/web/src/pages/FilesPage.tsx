import type { FileEntry } from "@poco-cloud/shared";
import { FolderPlus, RefreshCw, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { Input } from "../components/ui/Input.js";
import { apiClient } from "../services/api.js";

export const FilesPage = () => {
  const [path, setPath] = useState(".");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [folderName, setFolderName] = useState("");

  const load = async () => {
    const response = await apiClient.listFiles(path);
    setPath(response.path);
    setEntries(response.entries);
  };

  useEffect(() => {
    void load();
  }, []);

  const upload = async (file: File | null) => {
    if (!file) return;
    await apiClient.upload(path, file);
    await load();
  };

  const createFolder = async () => {
    if (!folderName.trim()) return;
    await apiClient.mkdir(path, folderName.trim());
    setFolderName("");
    await load();
  };

  const remove = async (target: string) => {
    await apiClient.deletePath(target);
    await load();
  };

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-semibold text-slate-50">Archivos</h2>
      <Card>
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <Input value={path} onChange={(event) => setPath(event.target.value)} />
          <Button variant="secondary" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
            Abrir
          </Button>
          <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md bg-panelSoft px-4 text-sm font-semibold text-slate-100 ring-1 ring-line transition hover:bg-slate-800">
            <Upload className="h-4 w-4" />
            Subir
            <input className="hidden" type="file" onChange={(event) => void upload(event.target.files?.[0] ?? null)} />
          </label>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
          <Input placeholder="Nueva carpeta" value={folderName} onChange={(event) => setFolderName(event.target.value)} />
          <Button variant="secondary" onClick={() => void createFolder()}>
            <FolderPlus className="h-4 w-4" />
            Crear
          </Button>
        </div>
      </Card>
      <Card className="overflow-hidden p-0">
        <div className="divide-y divide-line">
          {entries.map((entry) => (
            <div key={entry.path} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-3">
              <button
                className="min-w-0 text-left"
                onClick={() => {
                  if (entry.type === "directory") setPath(entry.path);
                }}
              >
                <p className="truncate font-medium text-slate-100">{entry.name}</p>
                <p className="truncate text-xs text-slate-500">{entry.path}</p>
              </button>
              <Badge tone={entry.type === "directory" ? "warning" : "neutral"}>{entry.type}</Badge>
              <Button variant="ghost" className="h-9 w-9 px-0 text-rose-300" onClick={() => void remove(entry.path)} aria-label="Borrar">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
