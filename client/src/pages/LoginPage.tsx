import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { Button, TextInput } from "../components/ui/index.js";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      const next = searchParams.get("next") || "/";
      navigate(next, { replace: true });
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-fog flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-[360px] flex flex-col gap-6">
        {/* Wordmark */}
        <div className="text-center">
          <Link to="/" className="text-ui-lg font-serif font-semibold text-ink tracking-tight focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2">
            CollabSpace
          </Link>
        </div>

        {/* Form Container */}
        <div className="bg-paper border border-line rounded-[6px] p-6">
          <h1 className="text-ui-md font-medium text-ink mb-4">Log in</h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <TextInput
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />

            <TextInput
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={error ?? undefined}
            />

            <Button type="submit" variant="primary" loading={loading} className="w-full mt-2">
              Log in
            </Button>
          </form>

          <div className="mt-5 pt-4 border-t border-line text-center">
            <p className="text-ui-xs text-ink-soft">
              No account?{" "}
              <Link
                to={`/register${searchParams.get("next") ? `?next=${encodeURIComponent(searchParams.get("next")!)}` : ""}`}
                className="text-ink font-medium hover:underline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
              >
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
