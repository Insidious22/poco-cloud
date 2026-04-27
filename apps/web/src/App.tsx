import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute.js";
import { AuthProvider } from "./hooks/useAuth.js";
import { DashboardLayout } from "./layouts/DashboardLayout.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { FilesPage } from "./pages/FilesPage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { LogsPage } from "./pages/LogsPage.js";
import { ServicesPage } from "./pages/ServicesPage.js";
import { SystemPage } from "./pages/SystemPage.js";

const App = () => (
  <AuthProvider>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/files" element={<FilesPage />} />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="/system" element={<SystemPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </AuthProvider>
);

export default App;
