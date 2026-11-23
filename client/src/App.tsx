import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link, useParams } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.js";
import { ProtectedRoute } from "./components/ProtectedRoute.js";
import { LoginPage } from "./pages/LoginPage.js";
import { RegisterPage } from "./pages/RegisterPage.js";
import { KitPage } from "./pages/KitPage.js";

function HomePage() {
  const [healthStatus, setHealthStatus] = useState<string>("Loading health check...");

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data: { ok: boolean }) => {
        setHealthStatus(JSON.stringify(data));
      })
      .catch((err: Error) => {
        setHealthStatus(`Error: ${err.message}`);
      });
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-ui-lg font-medium text-ink">CollabSpace</h1>
      <nav className="my-4 flex gap-4 text-ui-sm">
        <Link to="/login" className="text-ink underline">Login</Link>
        <Link to="/register" className="text-ink underline">Register</Link>
        <Link to="/d/demo-doc" className="text-ink underline">Demo Doc (Protected)</Link>
        <Link to="/_kit" className="text-ink underline">Design Kit</Link>
      </nav>
      <div className="mt-6">
        <h2 className="text-ui-md font-medium text-ink">Health check response:</h2>
        <pre id="health-output" className="text-ui-sm text-ink-soft mt-2">{healthStatus}</pre>
      </div>
    </div>
  );
}

function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  return <div className="p-8 text-ui-md text-ink">Document Page Placeholder: {id}</div>;
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/d/:id"
            element={
              <ProtectedRoute>
                <DocumentPage />
              </ProtectedRoute>
            }
          />
          <Route path="/_kit" element={<KitPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
