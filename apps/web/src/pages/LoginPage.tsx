import { Lock, Server } from "lucide-react";
import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { Input } from "../components/ui/Input.js";
import { Spinner } from "../components/ui/Spinner.js";
import { useAuth } from "../hooks/useAuth.js";

export const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(username, password);
      navigate("/");
    } catch {
      setError("Credenciales invalidas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-md p-7">
        <div className="mb-7 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-cyanGlow text-ink">
            <Server className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-50">Poco Cloud</h1>
            <p className="text-sm text-slate-500">Acceso privado</p>
          </div>
        </div>
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          <Input autoComplete="username" placeholder="Usuario" value={username} onChange={(event) => setUsername(event.target.value)} />
          <Input
            autoComplete="current-password"
            placeholder="Contrasena"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error ? <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}
          <Button className="w-full" disabled={loading}>
            {loading ? <Spinner /> : <Lock className="h-4 w-4" />}
            Entrar
          </Button>
        </form>
      </Card>
    </main>
  );
};
