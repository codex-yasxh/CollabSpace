import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { Spinner } from "./ui/Spinner.js";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-fog flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    const nextPath = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${nextPath}`} replace />;
  }

  return <>{children}</>;
}
