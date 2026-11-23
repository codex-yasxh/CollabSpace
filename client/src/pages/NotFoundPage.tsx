import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button.js";

/**
 * 404 Not Found Page per blueprint section 4.9 and T7.2.
 */
export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-fog flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-auth bg-paper border border-line rounded-control p-6 flex flex-col gap-4 text-center">
        <div className="text-center mb-1">
          <Link
            to="/"
            className="text-ui-md font-serif font-semibold text-ink tracking-tight focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
          >
            CollabSpace
          </Link>
        </div>

        <h1 className="text-ui-md font-medium text-ink">Page not found</h1>
        <p className="text-ui-sm text-ink-soft">
          The page you requested doesn't exist or was moved.
        </p>

        <div className="pt-2">
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => navigate("/")}
          >
            Back to documents
          </Button>
        </div>
      </div>
    </div>
  );
}
