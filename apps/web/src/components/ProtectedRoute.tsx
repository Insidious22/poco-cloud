import { Navigate } from "react-router-dom";
import { Spinner } from "./ui/Spinner.js";
import { useAuth } from "../hooks/useAuth.js";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink">
        <Spinner />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return children;
};
