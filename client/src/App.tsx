import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link, useParams } from "react-router-dom";
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
    <div>
      <h1>CollabSpace Home</h1>
      <nav>
        <Link to="/login">Login</Link> | <Link to="/register">Register</Link> | <Link to="/d/demo-doc">Demo Doc</Link>
      </nav>
      <div>
        <h2>Health check response:</h2>
        <pre id="health-output">{healthStatus}</pre>
      </div>
    </div>
  );
}

function LoginPage() {
  return <div>Login Page Placeholder</div>;
}

function RegisterPage() {
  return <div>Register Page Placeholder</div>;
}

function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  return <div>Document Page Placeholder: {id}</div>;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/_kit" element={<KitPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/d/:id" element={<DocumentPage />} />
        <Route path="/_kit" element={<KitPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
