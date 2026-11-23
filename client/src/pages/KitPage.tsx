import { useState } from "react";
import {
  Button,
  IconButton,
  TextInput,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SimpleTooltip,
  Avatar,
  AvatarStack,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  Spinner,
} from "../components/ui/index.js";
import {
  MoreVertical,
  Plus,
  Trash2,
  Edit2,
  Share2,
} from "lucide-react";

export function KitPage() {
  const [toastOpen, setToastOpen] = useState(false);
  const [toastDangerOpen, setToastDangerOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectValue, setSelectValue] = useState("editor");

  const sampleUsers = [
    { id: "user-1", name: "Aditya Sharma", isCurrentUser: true },
    { id: "user-2", name: "Bob Martin", presenceColor: "coral" as const },
    { id: "user-3", name: "Carol Davis", presenceColor: "teal" as const },
    { id: "user-4", name: "David Kim", presenceColor: "violet" as const },
    { id: "user-5", name: "Elena Rostova", presenceColor: "ochre" as const },
    { id: "user-6", name: "Frank Wright", presenceColor: "moss" as const },
  ];

  return (
    <ToastProvider swipeDirection="right">
      <div className="min-h-screen bg-fog text-ink font-sans p-6 sm:p-12">
        <main className="max-w-[880px] mx-auto space-y-12">
          {/* Header */}
          <header className="border-b border-line pb-6">
            <h1 className="text-ui-lg font-medium text-ink">Design system kit</h1>
            <p className="text-ui-sm text-ink-soft mt-1">
              CollabSpace interface primitives and interaction states. Built with Radix UI and restrained design tokens.
            </p>
          </header>

          {/* Typography */}
          <section className="space-y-4">
            <h2 className="text-ui-md font-medium text-ink">Typography</h2>
            <div className="bg-paper p-6 rounded-[6px] border border-line space-y-6">
              <div>
                <p className="text-ui-xs text-ink-soft mb-1">UI font: Hanken Grotesk Variable</p>
                <div className="space-y-2">
                  <p className="text-ui-lg font-medium">Header large (24px, medium) - CollabSpace</p>
                  <p className="text-ui-md font-medium">Header medium (18px, medium) - Project report draft</p>
                  <p className="text-ui-sm font-normal">Body UI regular (15px, normal) - Last edited 2 hours ago by Bob Martin</p>
                  <p className="text-ui-xs text-ink-soft">Caption / secondary (13px, normal) - Anyone with the link can edit</p>
                </div>
              </div>

              <div className="pt-4 border-t border-line">
                <p className="text-ui-xs text-ink-soft mb-1">Document font: Source Serif 4 Variable</p>
                <div className="font-serif space-y-2">
                  <h1 className="text-doc-h1 font-semibold text-ink">Document Heading 1 (32px, semibold)</h1>
                  <h2 className="text-doc-h2 font-semibold text-ink">Document Heading 2 (24px, semibold)</h2>
                  <h3 className="text-doc-h3 font-semibold text-ink">Document Heading 3 (19px, semibold)</h3>
                  <p className="text-doc-body text-ink max-w-[75ch]">
                    This is the document body text rendered in Source Serif 4. The measure is kept under 75 characters per line
                    with a 1.65 line height so that reading feels like physical paper rather than a software dashboard.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Buttons */}
          <section className="space-y-4">
            <h2 className="text-ui-md font-medium text-ink">Button</h2>
            <div className="bg-paper p-6 rounded-[6px] border border-line space-y-6">
              <div className="space-y-2">
                <p className="text-ui-xs text-ink-soft">Variants</p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="primary">New document</Button>
                  <Button variant="secondary">Cancel</Button>
                  <Button variant="ghost">Share</Button>
                  <Button variant="danger">Delete</Button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-ui-xs text-ink-soft">Sizes (sm, md)</p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm" variant="primary">Small button</Button>
                  <Button size="md" variant="primary">Medium button</Button>
                  <Button size="sm" variant="secondary">Small outline</Button>
                  <Button size="md" variant="secondary">Medium outline</Button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-ui-xs text-ink-soft">States: loading and disabled</p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="primary" loading>Saving</Button>
                  <Button variant="secondary" loading>Connecting</Button>
                  <Button variant="primary" disabled>Disabled</Button>
                  <Button variant="secondary" disabled>Disabled</Button>
                  <Button variant="danger" disabled>Disabled</Button>
                </div>
              </div>
            </div>
          </section>

          {/* IconButton */}
          <section className="space-y-4">
            <h2 className="text-ui-md font-medium text-ink">IconButton</h2>
            <div className="bg-paper p-6 rounded-[6px] border border-line space-y-4">
              <p className="text-ui-xs text-ink-soft">Always requires an accessible label for screen readers</p>
              <div className="flex flex-wrap items-center gap-4">
                <IconButton label="Add document" variant="secondary">
                  <Plus className="w-4 h-4 text-ink" />
                </IconButton>
                <IconButton label="Edit document title" variant="ghost">
                  <Edit2 className="w-4 h-4 text-ink" />
                </IconButton>
                <IconButton label="More document actions" variant="ghost">
                  <MoreVertical className="w-4 h-4 text-ink" />
                </IconButton>
                <IconButton label="Share document" variant="secondary" size="sm">
                  <Share2 className="w-3.5 h-3.5 text-ink" />
                </IconButton>
                <IconButton label="Disabled icon button" variant="secondary" disabled>
                  <Trash2 className="w-4 h-4 text-ink" />
                </IconButton>
              </div>
            </div>
          </section>

          {/* TextInput */}
          <section className="space-y-4">
            <h2 className="text-ui-md font-medium text-ink">TextInput</h2>
            <div className="bg-paper p-6 rounded-[6px] border border-line space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <TextInput
                  label="Document title"
                  placeholder="Untitled document"
                  defaultValue="Project report draft"
                />
                <TextInput
                  label="Collaborator email"
                  placeholder="colleague@example.com"
                  hint="They must have an existing account"
                />
                <TextInput
                  label="Password"
                  type="password"
                  defaultValue="wrongpass"
                  error="Email or password is incorrect."
                />
                <TextInput
                  label="Document identifier"
                  defaultValue="doc-39482-readonly"
                  disabled
                  hint="Assigned by system"
                />
              </div>
            </div>
          </section>

          {/* DropdownMenu & Select */}
          <section className="space-y-4">
            <h2 className="text-ui-md font-medium text-ink">DropdownMenu and Select</h2>
            <div className="bg-paper p-6 rounded-[6px] border border-line">
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <p className="text-ui-xs text-ink-soft mb-2">Dropdown menu</p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary">
                        Document options
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem>
                        <Edit2 className="w-4 h-4 text-ink-soft" />
                        <span>Rename</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Share2 className="w-4 h-4 text-ink-soft" />
                        <span>Share</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem destructive>
                        <Trash2 className="w-4 h-4 text-danger" />
                        <span>Delete</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="w-[180px]">
                  <p className="text-ui-xs text-ink-soft mb-2">Select control</p>
                  <Select value={selectValue} onValueChange={setSelectValue}>
                    <SelectTrigger aria-label="Member role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </section>

          {/* Dialog */}
          <section className="space-y-4">
            <h2 className="text-ui-md font-medium text-ink">Dialog</h2>
            <div className="bg-paper p-6 rounded-[6px] border border-line">
              <p className="text-ui-xs text-ink-soft mb-3">Traps focus, closes on Escape, 120ms transition, no backdrop blur</p>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="danger">Open delete confirmation</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete Project report draft?</DialogTitle>
                    <DialogDescription>
                      This removes it for everyone. This can&apos;t be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="secondary">Cancel</Button>
                    </DialogClose>
                    <Button variant="danger" onClick={() => setDialogOpen(false)}>
                      Delete
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </section>

          {/* Tooltip */}
          <section className="space-y-4">
            <h2 className="text-ui-md font-medium text-ink">Tooltip</h2>
            <div className="bg-paper p-6 rounded-[6px] border border-line">
              <div className="flex items-center gap-4">
                <SimpleTooltip content="Aditya Sharma (aditya@example.com)">
                  <Button variant="secondary">Hover for collaborator info</Button>
                </SimpleTooltip>

                <SimpleTooltip content="Keyboard shortcut: Ctrl+S" side="bottom">
                  <Button variant="ghost">Hover for shortcut</Button>
                </SimpleTooltip>
              </div>
            </div>
          </section>

          {/* Avatar and AvatarStack */}
          <section className="space-y-4">
            <h2 className="text-ui-md font-medium text-ink">Presence: Avatar and AvatarStack</h2>
            <div className="bg-paper p-6 rounded-[6px] border border-line space-y-6">
              <div>
                <p className="text-ui-xs text-ink-soft mb-2">Deterministic presence palette (all &gt;= 4.5:1 contrast against white)</p>
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar name="Aditya Sharma" presenceColor="coral" />
                  <Avatar name="Bob Martin" presenceColor="ochre" />
                  <Avatar name="Carol Davis" presenceColor="moss" />
                  <Avatar name="David Kim" presenceColor="teal" />
                  <Avatar name="Elena Rostova" presenceColor="cobalt" />
                  <Avatar name="Frank Wright" presenceColor="violet" />
                  <Avatar name="Grace Hopper" presenceColor="magenta" />
                </div>
              </div>

              <div>
                <p className="text-ui-xs text-ink-soft mb-2">Current user has --ink ring; other collaborators have 2px --fog ring</p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Avatar name="Aditya Sharma" isCurrentUser />
                    <span className="text-ui-xs text-ink-soft">You (ink ring)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Avatar name="Bob Martin" presenceColor="coral" />
                    <span className="text-ui-xs text-ink-soft">Peer (fog ring)</span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-ui-xs text-ink-soft mb-2">AvatarStack (overlaps by 8px, current user first, collapses past 4 into +N with tooltip)</p>
                <div className="flex flex-col sm:flex-row gap-6">
                  <div>
                    <span className="text-ui-xs text-ink-soft block mb-1">3 active collaborators:</span>
                    <AvatarStack users={sampleUsers.slice(0, 3)} />
                  </div>
                  <div>
                    <span className="text-ui-xs text-ink-soft block mb-1">6 collaborators (overflow):</span>
                    <AvatarStack users={sampleUsers} />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Toast */}
          <section className="space-y-4">
            <h2 className="text-ui-md font-medium text-ink">Toast</h2>
            <div className="bg-paper p-6 rounded-[6px] border border-line">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="secondary" onClick={() => setToastOpen(true)}>
                  Trigger success toast
                </Button>
                <Button variant="secondary" onClick={() => setToastDangerOpen(true)}>
                  Trigger error toast
                </Button>
              </div>

              <Toast open={toastOpen} onOpenChange={setToastOpen}>
                <ToastTitle>Document saved</ToastTitle>
                <ToastDescription>All changes flushed to server.</ToastDescription>
              </Toast>

              <Toast open={toastDangerOpen} onOpenChange={setToastDangerOpen} variant="danger">
                <ToastTitle>Connection lost</ToastTitle>
                <ToastDescription>Offline. Your changes will sync when you reconnect.</ToastDescription>
              </Toast>
            </div>
          </section>

          {/* Spinner */}
          <section className="space-y-4">
            <h2 className="text-ui-md font-medium text-ink">Spinner</h2>
            <div className="bg-paper p-6 rounded-[6px] border border-line">
              <p className="text-ui-xs text-ink-soft mb-3">Monochrome, non-shimmer spinner in sm, md, and lg sizes</p>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Spinner size="sm" />
                  <span className="text-ui-xs text-ink-soft">Small (14px)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Spinner size="md" />
                  <span className="text-ui-xs text-ink-soft">Medium (16px)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Spinner size="lg" />
                  <span className="text-ui-xs text-ink-soft">Large (24px)</span>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
      <ToastViewport />
    </ToastProvider>
  );
}
