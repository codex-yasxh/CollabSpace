import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.js";
import { ProtectedRoute } from "./components/ProtectedRoute.js";
import { LoginPage } from "./pages/LoginPage.js";
import { RegisterPage } from "./pages/RegisterPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { KitPage } from "./pages/KitPage.js";

function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  return <div className="p-8 text-ui-md text-ink">Document Page Placeholder: {id}</div>;
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
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
