import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { useAuth } from "../context/AuthContext.js";
import { useCollabSession, type CollabSession } from "../hooks/useCollabSession.js";
import { useActiveCollaborators } from "../hooks/useActiveCollaborators.js";
import { useSaveStatus } from "../hooks/useSaveStatus.js";
import { renderCaret, selectionRender } from "../lib/caret.js";
import { getPresenceColor } from "../lib/presence.js";
import {
  Button,
  Spinner,
  ToastProvider,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastViewport,
  Avatar,
  AvatarStack,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../components/ui/index.js";
import { ShareDialog, type MemberItem } from "../components/ShareDialog.js";
import { EditorToolbar } from "../components/EditorToolbar.js";
import { DocumentTitleInput } from "../components/DocumentTitleInput.js";
import { StatusIndicator } from "../components/StatusIndicator.js";
import { Users, ChevronDown, ArrowLeft } from "lucide-react";

interface DocumentDetail {
  id: string;
  title: string;
  owner_id: string;
  link_access: "NONE" | "VIEWER" | "EDITOR";
  role: "OWNER" | "EDITOR" | "VIEWER";
  created_at: string;
  updated_at: string;
}

interface CollabEditorAreaProps {
  session: CollabSession;
  isViewer: boolean;
  user: { id: string; name: string; email: string } | null;
}

function CollabEditorArea({ session, isViewer, user }: CollabEditorAreaProps) {
  const userColor = user?.id ? getPresenceColor(user.id) : { name: "coral", hex: "#C4412E" };

  useEffect(() => {
    if (user && session.provider.awareness) {
      session.provider.awareness.setLocalStateField("user", {
        userId: user.id,
        name: user.name,
        color: userColor.hex,
      });
    }
  }, [session, user, userColor.hex]);

  const editor = useEditor(
    {
      editable: !isViewer,
      extensions: [
        StarterKit.configure({
          undoRedo: false, // Wire history to Collaboration extension
          link: {
            openOnClick: false,
            protocols: ["http", "https", "mailto"],
            HTMLAttributes: {
              rel: "noopener noreferrer nofollow",
            },
          },
        }),
        Collaboration.configure({
          document: session.ydoc,
        }),
        CollaborationCaret.configure({
          provider: session.provider,
          user: {
            userId: user?.id || "guest",
            name: user?.name || "Guest",
            color: userColor.hex,
          },
          render: renderCaret,
          selectionRender,
        }),
      ],
      // NEVER pass content option to useEditor per skills.md 6.2
    },
    [session, isViewer],
  );

  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.setEditable(!isViewer);
    }
  }, [editor, isViewer]);

  return (
    <>
      <EditorToolbar editor={editor} disabled={isViewer} />
      {isViewer && (
        <div className="w-full bg-wash border-b border-line px-6 py-2 flex items-center justify-center text-center shrink-0">
          <p className="text-ui-xs text-ink-soft">
            You can view this document. Ask the owner for edit access.
          </p>
        </div>
      )}
      <main className="flex-1 w-full bg-fog py-8 px-4 flex justify-center overflow-y-auto">
        <div className="w-full max-w-paper bg-paper border border-line rounded-page shadow-page p-18 max-md:p-5 max-md:max-w-none">
          <EditorContent editor={editor} />
        </div>
      </main>
    </>
  );
}

export function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, logout } = useAuth();

  const forcedState = searchParams.get("state"); // e.g. "no-access" | "not-found"
  const forcedDialog = searchParams.get("dialog"); // e.g. "share-owner" | "share-viewer"
  const forcedRole = searchParams.get("role"); // e.g. "viewer"

  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusCode, setStatusCode] = useState<number | null>(null);

  // Share Dialog state
  const [shareOpen, setShareOpen] = useState<boolean>(
    forcedDialog === "share-owner" || forcedDialog === "share-viewer",
  );

  // Toast state
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState({ title: "", description: "" });

  const showToast = (title: string, description: string = "") => {
    setToastMessage({ title, description });
    setToastOpen(false);
    setTimeout(() => setToastOpen(true), 50);
  };

  const handleTitleSave = async (newTitle: string) => {
    if (!document || !id) return;
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
      if (res.ok) {
        const data = (await res.json()) as { document: DocumentDetail };
        setDocument(data.document);
      } else {
        showToast("Couldn't update title", "Check your connection and try again.");
      }
    } catch {
      showToast("Couldn't update title", "Check your connection and try again.");
    }
  };

  const fetchDocument = useCallback(async () => {
    if (forcedState === "no-access") {
      setStatusCode(403);
      setLoading(false);
      return;
    }
    if (forcedState === "not-found") {
      setStatusCode(404);
      setLoading(false);
      return;
    }
    if (forcedDialog) {
      setDocument({
        id: id || "preview-doc-1",
        title: "Project report draft",
        owner_id: "owner-1",
        link_access: "NONE",
        role: forcedDialog === "share-viewer" ? "VIEWER" : "OWNER",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      setStatusCode(200);
      setShareOpen(true);
      setLoading(false);
      return;
    }

    if (!id) return;
    setLoading(true);
    setStatusCode(null);

    try {
      const res = await fetch(`/api/documents/${id}`);
      setStatusCode(res.status);

      if (res.ok) {
        const data = (await res.json()) as { document: DocumentDetail };
        setDocument(data.document);
      }
    } catch {
      setStatusCode(500);
    } finally {
      setLoading(false);
    }
  }, [id, forcedState]);

  useEffect(() => {
    void fetchDocument();
  }, [fetchDocument]);

  const effectiveRole =
    forcedRole === "viewer" || forcedDialog === "share-viewer"
      ? "VIEWER"
      : document?.role || "VIEWER";
  const isViewer = effectiveRole === "VIEWER";
  const session = useCollabSession(document?.id);
  const activeCollaborators = useActiveCollaborators(session?.provider, user?.id);
  const saveStatus = useSaveStatus(session?.provider);

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-fog flex items-center justify-center">
        <Spinner size="md" />
      </div>
    );
  }

  // 403 Forbidden / No Access Screen per blueprint section 4.9
  if (statusCode === 403 || forcedState === "no-access") {
    const userEmail = user?.email || "aditya@x.com";
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

          <h1 className="text-ui-md font-medium text-ink">No access</h1>
          <p className="text-ui-sm text-ink-soft">
            You don't have access to this document. Ask the owner to share it with{" "}
            <span className="font-medium text-ink">{userEmail}</span>.
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

  // 404 Not Found Screen
  if (statusCode === 404 || forcedState === "not-found" || !document) {
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

          <h1 className="text-ui-md font-medium text-ink">Document not found</h1>
          <p className="text-ui-sm text-ink-soft">
            This document doesn't exist or was deleted.
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

  // Mock members for preview / screenshots when requested via forcedDialog
  const previewMembers: MemberItem[] | undefined =
    forcedDialog === "share-viewer"
      ? [
          {
            id: "owner-1",
            name: "Alice Chen",
            email: "alice@collabspace.dev",
            role: "OWNER",
          },
          {
            id: user?.id || "viewer-1",
            name: user?.name || "Carol Viewer",
            email: user?.email || "carol@collabspace.dev",
            role: "VIEWER",
          },
        ]
      : forcedDialog === "share-owner"
        ? [
            {
              id: user?.id || "owner-1",
              name: user?.name || "Alice Owner",
              email: user?.email || "alice@collabspace.dev",
              role: "OWNER",
            },
            {
              id: "editor-1",
              name: "Bob Editor",
              email: "bob@collabspace.dev",
              role: "EDITOR",
            },
            {
              id: "viewer-1",
              name: "Carol Viewer",
              email: "carol@collabspace.dev",
              role: "VIEWER",
            },
          ]
        : undefined;

  return (
    <ToastProvider swipeDirection="right">
      <div className="min-h-screen bg-fog text-ink font-sans flex flex-col">
        {/* Header Bar */}
        <header className="w-full px-6 py-3 flex items-center justify-between border-b border-line bg-fog shrink-0">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex items-center gap-1.5 text-ui-sm font-medium text-ink-soft hover:text-ink transition-colors focus-visible:outline-2 focus-visible:outline-focus"
              aria-label="Back to documents"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="font-serif font-semibold text-ink">CollabSpace</span>
            </Link>

            <DocumentTitleInput
              title={document.title}
              canEdit={effectiveRole === "OWNER" || effectiveRole === "EDITOR"}
              onSave={handleTitleSave}
            />

            {/* Plain text role label (blueprint rule: role as plain text only, no decorative pill) */}
            <span className="text-ui-xs text-ink-soft capitalize">
              ({effectiveRole.toLowerCase()})
            </span>
          </div>

          <div className="flex items-center gap-3">
            <StatusIndicator text={saveStatus.text} />

            {activeCollaborators.length > 0 && (
              <AvatarStack users={activeCollaborators} max={4} />
            )}

            <Button
              variant="primary"
              size="sm"
              onClick={() => setShareOpen(true)}
              className="gap-1.5"
            >
              <Users className="w-3.5 h-3.5" />
              Share
            </Button>

            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 px-1.5 py-1 rounded-control hover:bg-wash transition-colors focus-visible:outline-2 focus-visible:outline-focus cursor-pointer"
                  >
                    <Avatar name={user.name} isCurrentUser size="sm" />
                    <ChevronDown className="w-3.5 h-3.5 text-ink-soft" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <div className="px-2.5 py-1.5 text-ui-xs text-ink-soft border-b border-line mb-1">
                    Signed in as <span className="font-medium text-ink">{user.email}</span>
                  </div>
                  <DropdownMenuItem onSelect={() => navigate("/")}>
                    All documents
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
          </div>
        </header>

        {/* Collab Editor Canvas */}
        {!session ? (
          <div className="flex-1 w-full bg-fog py-8 px-4 flex justify-center items-center">
            <div className="w-full max-w-paper bg-paper border border-line rounded-page shadow-page p-18 flex items-center justify-center min-h-96">
              <Spinner size="md" />
            </div>
          </div>
        ) : (
          <CollabEditorArea session={session} isViewer={isViewer} user={user} />
        )}

        {/* Share Dialog */}
        <ShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          documentId={document.id}
          documentTitle={document.title}
          userRole={effectiveRole}
          initialLinkAccess={document.link_access}
          onLinkAccessChange={(newAccess) => {
            setDocument((prev) => (prev ? { ...prev, link_access: newAccess } : prev));
          }}
          showToast={showToast}
          initialMembers={previewMembers}
        />

        {/* Toasts */}
        <Toast open={toastOpen} onOpenChange={setToastOpen}>
          <ToastTitle>{toastMessage.title}</ToastTitle>
          {toastMessage.description && (
            <ToastDescription>{toastMessage.description}</ToastDescription>
          )}
        </Toast>
        <ToastViewport />
      </div>
    </ToastProvider>
  );
}
