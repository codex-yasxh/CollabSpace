import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import {
  Button,
  IconButton,
  TextInput,
  Avatar,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  Spinner,
} from "../components/ui/index.js";
import { formatRelativeTime } from "../lib/dateUtils.js";
import { MoreVertical, ChevronDown } from "lucide-react";

export interface DocumentItem {
  id: string;
  title: string;
  owner_id: string;
  owner_name: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
  link_access: "NONE" | "VIEWER" | "EDITOR";
  created_at: string;
  updated_at: string;
}

export function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Test states for screenshots or preview (?state=loading | ?state=error | ?state=empty)
  const forcedState = searchParams.get("state");

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<boolean>(false);

  // Dialog states
  const [deleteDoc, setDeleteDoc] = useState<DocumentItem | null>(null);
  const [renameDoc, setRenameDoc] = useState<DocumentItem | null>(null);
  const [newTitle, setNewTitle] = useState<string>("");
  const [renaming, setRenaming] = useState<boolean>(false);

  // Toast state
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState({ title: "", description: "" });

  const showToast = (title: string, description: string = "") => {
    setToastMessage({ title, description });
    setToastOpen(false);
    setTimeout(() => setToastOpen(true), 50);
  };

  const fetchDocuments = useCallback(async () => {
    if (forcedState === "loading") {
      setLoading(true);
      return;
    }
    if (forcedState === "error") {
      setLoading(false);
      setError("Failed to load documents.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/documents");
      if (!res.ok) {
        throw new Error("Failed to load documents.");
      }
      const data = (await res.json()) as { documents: DocumentItem[] };
      if (forcedState === "empty") {
        setDocuments([]);
      } else {
        setDocuments(data.documents);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents.");
    } finally {
      if (forcedState !== "loading") {
        setLoading(false);
      }
    }
  }, [forcedState]);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled document" }),
      });
      if (!res.ok) throw new Error("Failed to create document.");
      const data = (await res.json()) as { document: { id: string } };
      navigate(`/d/${data.document.id}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to create document.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDoc) return;
    try {
      const res = await fetch(`/api/documents/${deleteDoc.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete document.");
      setDocuments((prev) => prev.filter((d) => d.id !== deleteDoc.id));
      setDeleteDoc(null);
      showToast("Document deleted");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete document.");
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameDoc || !newTitle.trim()) return;
    setRenaming(true);
    try {
      const res = await fetch(`/api/documents/${renameDoc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      if (!res.ok) throw new Error("Failed to rename document.");
      const data = (await res.json()) as { document: DocumentItem };
      setDocuments((prev) =>
        prev.map((d) => (d.id === renameDoc.id ? { ...d, title: data.document.title } : d)),
      );
      setRenameDoc(null);
      showToast("Document renamed");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to rename document.");
    } finally {
      setRenaming(false);
    }
  };

  return (
    <ToastProvider swipeDirection="right">
      <div className="min-h-screen bg-fog text-ink font-sans flex flex-col">
        {/* Top bar on --fog background per blueprint 4.6 */}
        <header className="w-full px-6 py-4 flex items-center justify-between border-b border-line bg-fog">
          <Link
            to="/"
            className="text-ui-md font-serif font-semibold text-ink tracking-tight focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
          >
            CollabSpace
          </Link>

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 px-2 py-1 rounded-[6px] hover:bg-wash transition-colors focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2 cursor-pointer"
                >
                  <Avatar name={user.name} isCurrentUser size="sm" />
                  <span className="text-ui-sm font-medium text-ink">{user.name}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-ink-soft" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="px-2.5 py-1.5 text-ui-xs text-ink-soft border-b border-line mb-1">
                  Signed in as <span className="font-medium text-ink">{user.email}</span>
                </div>
                <DropdownMenuItem onSelect={() => navigate("/_kit")}>
                  Design system kit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  destructive
                  onSelect={async () => {
                    await logout();
                    navigate("/login");
                  }}
                >
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </header>

        {/* Main Content Area (max-width 880px, centered) */}
        <main className="w-full max-w-[880px] mx-auto px-6 py-10 flex-1 flex flex-col">
          {/* Header Row: Documents title & New document button */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-ui-lg font-medium text-ink">Documents</h1>
            <Button variant="primary" loading={creating} onClick={handleCreate}>
              New document
            </Button>
          </div>

          {/* List Container with Hairline Row Dividers */}
          <div className="w-full">
            {loading ? (
              <div className="py-24 flex flex-col items-center justify-center gap-3">
                <Spinner size="md" />
                <p className="text-ui-sm text-ink-soft">Loading documents...</p>
              </div>
            ) : error ? (
              <div className="py-16 text-center border-t border-line">
                <p className="text-ui-sm text-danger mb-4">{error}</p>
                <Button variant="secondary" size="sm" onClick={() => fetchDocuments()}>
                  Retry
                </Button>
              </div>
            ) : documents.length === 0 ? (
              /* Empty state per blueprint 4.9: "No documents yet. Create one to start writing." */
              <div className="py-20 text-center border-t border-line">
                <p className="text-ui-sm text-ink-soft">
                  No documents yet. Create one to start writing.
                </p>
              </div>
            ) : (
              /* Document rows list with hairline dividers */
              <ul className="border-t border-line divide-y divide-line list-none p-0 m-0">
                {documents.map((doc) => {
                  const isOwner = doc.owner_id === user?.id || doc.role === "OWNER";
                  const ownerLabel = isOwner ? "You" : `Shared by ${doc.owner_name}`;

                  return (
                    <li
                      key={doc.id}
                      className="group flex items-center justify-between px-3 py-3.5 hover:bg-wash transition-colors"
                    >
                      {/* Document Title & Meta */}
                      <div className="flex-1 min-w-0 pr-4">
                        <Link
                          to={`/d/${doc.id}`}
                          className="block text-ui-sm font-medium text-ink truncate hover:underline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
                        >
                          {doc.title}
                        </Link>
                      </div>

                      {/* Right metadata columns & Row Menu */}
                      <div className="flex items-center gap-6 shrink-0">
                        {/* Owner / Shared By text */}
                        <span className="text-ui-xs text-ink-soft w-28 truncate text-left hidden sm:inline">
                          {ownerLabel}
                        </span>

                        {/* Plain text role when not owner per blueprint 4.6 */}
                        {!isOwner && (
                          <span className="text-ui-xs text-ink-soft capitalize">
                            {doc.role.toLowerCase()}
                          </span>
                        )}

                        {/* Relative timestamp */}
                        <span className="text-ui-xs text-ink-soft w-28 text-right">
                          {formatRelativeTime(doc.updated_at)}
                        </span>

                        {/* Actions dropdown menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <IconButton label="Document options" size="sm" variant="ghost">
                              <MoreVertical className="w-4 h-4 text-ink-soft" />
                            </IconButton>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {(isOwner || doc.role === "EDITOR") && (
                              <DropdownMenuItem
                                onSelect={() => {
                                  setRenameDoc(doc);
                                  setNewTitle(doc.title);
                                }}
                              >
                                Rename
                              </DropdownMenuItem>
                            )}
                            {isOwner && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  destructive
                                  onSelect={() => setDeleteDoc(doc)}
                                >
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </main>

        {/* Delete Confirmation Dialog per blueprint 4.9:
            Title: "Delete [title]?"
            Body: "This removes it for everyone. This can't be undone."
            Buttons: "Cancel" and "Delete"
        */}
        <Dialog open={!!deleteDoc} onOpenChange={(open) => !open && setDeleteDoc(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete {deleteDoc?.title}?</DialogTitle>
              <DialogDescription>
                This removes it for everyone. This can&apos;t be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">Cancel</Button>
              </DialogClose>
              <Button variant="danger" onClick={handleDelete}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rename Dialog */}
        <Dialog open={!!renameDoc} onOpenChange={(open) => !open && setRenameDoc(null)}>
          <DialogContent>
            <form onSubmit={handleRename}>
              <DialogHeader>
                <DialogTitle>Rename</DialogTitle>
              </DialogHeader>
              <div className="my-4">
                <TextInput
                  label="Document title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="secondary">Cancel</Button>
                </DialogClose>
                <Button type="submit" variant="primary" loading={renaming}>
                  Save
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Toast Notification */}
        <Toast open={toastOpen} onOpenChange={setToastOpen}>
          <ToastTitle>{toastMessage.title}</ToastTitle>
          {toastMessage.description && <ToastDescription>{toastMessage.description}</ToastDescription>}
        </Toast>
        <ToastViewport />
      </div>
    </ToastProvider>
  );
}

export default DashboardPage;
