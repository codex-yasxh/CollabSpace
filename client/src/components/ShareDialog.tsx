import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  IconButton,
  TextInput,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Avatar,
  Spinner,
} from "./ui/index.js";
import { Link2, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext.js";

export interface MemberItem {
  id: string; // user id
  name: string;
  email: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
  createdAt?: string;
}

export interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  documentTitle?: string;
  userRole?: "OWNER" | "EDITOR" | "VIEWER";
  initialLinkAccess?: "NONE" | "VIEWER" | "EDITOR";
  onLinkAccessChange?: (newAccess: "NONE" | "VIEWER" | "EDITOR") => void;
  showToast: (title: string, description?: string) => void;
  // Optional pre-seeded members for testing or screenshots
  initialMembers?: MemberItem[] | undefined;
}

export function ShareDialog({
  open,
  onOpenChange,
  documentId,
  documentTitle = "document",
  userRole = "OWNER",
  initialLinkAccess = "NONE",
  onLinkAccessChange,
  showToast,
  initialMembers,
}: ShareDialogProps) {
  const { user: currentUser } = useAuth();
  const isOwner = userRole === "OWNER";

  const [members, setMembers] = useState<MemberItem[]>(initialMembers ?? []);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [linkAccess, setLinkAccess] = useState<"NONE" | "VIEWER" | "EDITOR">(initialLinkAccess);
  const [updatingLinkAccess, setUpdatingLinkAccess] = useState(false);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"EDITOR" | "VIEWER">("EDITOR");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Fetch members when dialog opens
  const fetchMembers = useCallback(async () => {
    if (initialMembers) return;
    setLoadingMembers(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/members`);
      if (res.ok) {
        const data = (await res.json()) as { members: MemberItem[] };
        setMembers(data.members);
      }
    } catch {
      // Handled silently; members remain as-is
    } finally {
      setLoadingMembers(false);
    }
  }, [documentId, initialMembers]);

  useEffect(() => {
    if (open) {
      if (initialMembers) {
        setMembers(initialMembers);
      }
      setLinkAccess(initialLinkAccess);
      setInviteError(null);
      setInviteEmail("");
      void fetchMembers();
    }
  }, [open, initialLinkAccess, fetchMembers, initialMembers]);

  // Handle inviting a collaborator
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || inviting) return;

    setInviting(true);
    setInviteError(null);

    try {
      const res = await fetch(`/api/documents/${documentId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });

      const data = (await res.json()) as {
        member?: MemberItem;
        error?: { message?: string };
      };

      if (!res.ok) {
        setInviteError(
          data.error?.message ||
            "Couldn't add collaborator. Check the email and try again.",
        );
        return;
      }

      if (data.member) {
        setMembers((prev) => [...prev, data.member!]);
      } else {
        await fetchMembers();
      }

      setInviteEmail("");
      showToast("Collaborator added");
    } catch {
      setInviteError("Couldn't add collaborator. Check your connection and try again.");
    } finally {
      setInviting(false);
    }
  };

  // Handle changing a member's role
  const handleMemberRoleChange = async (userId: string, newRole: "EDITOR" | "VIEWER") => {
    try {
      const res = await fetch(`/api/documents/${documentId}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) {
        showToast("Couldn't update role. Try again.");
        return;
      }

      setMembers((prev) =>
        prev.map((m) => (m.id === userId ? { ...m, role: newRole } : m)),
      );
      showToast("Role updated");
    } catch {
      showToast("Couldn't update role. Check your connection and try again.");
    }
  };

  // Handle removing a member
  const handleRemoveMember = async (userId: string) => {
    try {
      const res = await fetch(`/api/documents/${documentId}/members/${userId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        showToast("Couldn't remove collaborator. Try again.");
        return;
      }

      setMembers((prev) => prev.filter((m) => m.id !== userId));
      showToast("Collaborator removed");
    } catch {
      showToast("Couldn't remove collaborator. Check your connection and try again.");
    }
  };

  // Handle changing link access
  const handleLinkAccessChange = async (newAccess: "NONE" | "VIEWER" | "EDITOR") => {
    if (!isOwner || updatingLinkAccess) return;

    setUpdatingLinkAccess(true);
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link_access: newAccess }),
      });

      if (!res.ok) {
        showToast("Couldn't update link access. Try again.");
        return;
      }

      setLinkAccess(newAccess);
      onLinkAccessChange?.(newAccess);
      showToast("Link access updated");
    } catch {
      showToast("Couldn't update link access. Check your connection and try again.");
    } finally {
      setUpdatingLinkAccess(false);
    }
  };

  // Handle copying link
  const handleCopyLink = async () => {
    const url = `${window.location.origin}/d/${documentId}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied");
    } catch {
      showToast("Couldn't copy link. Copy from browser address bar.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share "{documentTitle}"</DialogTitle>
          <DialogDescription>
            Manage who has access to this document.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6 py-2">
          {/* 1. Add Collaborators Form (Owner only) */}
          {isOwner && (
            <form onSubmit={handleInvite} className="flex flex-col gap-2">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-2">
                <div className="flex-1 min-w-0">
                  <TextInput
                    type="email"
                    placeholder="name@example.com"
                    value={inviteEmail}
                    onChange={(e) => {
                      setInviteEmail(e.target.value);
                      if (inviteError) setInviteError(null);
                    }}
                    error={inviteError ?? undefined}
                    disabled={inviting}
                    aria-label="Collaborator email"
                  />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-28 sm:w-32 shrink-0">
                    <Select
                      value={inviteRole}
                      onValueChange={(val) => setInviteRole(val as "EDITOR" | "VIEWER")}
                      disabled={inviting}
                    >
                      <SelectTrigger aria-label="Invite role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EDITOR">Editor</SelectItem>
                        <SelectItem value="VIEWER">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={inviting}
                    disabled={!inviteEmail.trim()}
                  >
                    Invite
                  </Button>
                </div>
              </div>
            </form>
          )}

          {/* 2. People with Access List */}
          <div className="flex flex-col gap-2">
            <h2 className="text-ui-xs font-medium text-ink-soft">
              People with access
            </h2>

            {loadingMembers && members.length === 0 ? (
              <div className="flex items-center justify-center py-6 text-ink-soft">
                <Spinner size="sm" />
              </div>
            ) : (
              <div className="divide-y divide-line border-y border-line">
                {members.map((member) => {
                  const isSelf = currentUser?.id === member.id;
                  const isMemberOwner = member.role === "OWNER";

                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between py-2.5 gap-3"
                    >
                      {/* Avatar & User Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar name={member.name} userId={member.id} isCurrentUser={isSelf} />
                        <div className="min-w-0 flex flex-col">
                          <span className="text-ui-sm font-medium text-ink truncate">
                            {member.name} {isSelf && "(You)"}
                          </span>
                          <span className="text-ui-xs text-ink-soft truncate">
                            {member.email}
                          </span>
                        </div>
                      </div>

                      {/* Role control or static label */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isOwner && !isMemberOwner ? (
                          <>
                            <div className="w-28">
                              <Select
                                value={member.role}
                                onValueChange={(val) =>
                                  void handleMemberRoleChange(
                                    member.id,
                                    val as "EDITOR" | "VIEWER",
                                  )
                                }
                              >
                                <SelectTrigger aria-label={`Role for ${member.name}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="EDITOR">Editor</SelectItem>
                                  <SelectItem value="VIEWER">Viewer</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <IconButton
                              label={`Remove ${member.name}`}
                              size="sm"
                              variant="ghost"
                              onClick={() => void handleRemoveMember(member.id)}
                            >
                              <Trash2 className="w-4 h-4 text-ink-soft hover:text-danger" />
                            </IconButton>
                          </>
                        ) : (
                          <span className="text-ui-sm text-ink-soft capitalize px-2 py-1">
                            {member.role.toLowerCase()}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Anyone with the Link Access */}
          <div className="flex flex-col gap-2 pt-2 border-t border-line">
            <h2 className="text-ui-xs font-medium text-ink-soft">
              General access
            </h2>

            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <span className="text-ui-sm font-medium text-ink">
                  Anyone with the link
                </span>
                <span className="text-ui-xs text-ink-soft">
                  {linkAccess === "NONE" && "Only people with access can open with the link"}
                  {linkAccess === "VIEWER" && "Anyone with the link can view"}
                  {linkAccess === "EDITOR" && "Anyone with the link can edit"}
                </span>
              </div>

              {isOwner ? (
                <div className="w-36 shrink-0">
                  <Select
                    value={linkAccess}
                    onValueChange={(val) =>
                      void handleLinkAccessChange(val as "NONE" | "VIEWER" | "EDITOR")
                    }
                    disabled={updatingLinkAccess}
                  >
                    <SelectTrigger aria-label="Link access permission">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">No access</SelectItem>
                      <SelectItem value="VIEWER">Viewer</SelectItem>
                      <SelectItem value="EDITOR">Editor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <span className="text-ui-sm text-ink-soft capitalize px-2 py-1">
                  {linkAccess === "NONE" ? "No access" : linkAccess.toLowerCase()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer with Copy link and Done */}
        <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
          <Button variant="secondary" onClick={handleCopyLink} className="gap-2">
            <Link2 className="w-4 h-4 text-ink" />
            Copy link
          </Button>

          <Button variant="primary" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
