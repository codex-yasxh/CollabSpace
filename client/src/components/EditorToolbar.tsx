import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link2,
  Undo2,
  Redo2,
} from "lucide-react";
import { SimpleTooltip } from "./ui/Tooltip.js";

export interface EditorToolbarProps {
  editor: Editor | null;
  disabled?: boolean;
}

export function EditorToolbar({ editor, disabled = false }: EditorToolbarProps) {
  if (!editor) {
    return (
      <div className="sticky top-0 z-20 bg-paper border-b border-line px-6 py-1.5 flex items-center gap-1 overflow-x-auto min-h-10">
        <span className="text-ui-xs text-ink-soft">Loading editor...</span>
      </div>
    );
  }

  const btnClass = (isActive: boolean) =>
    `w-control-sm h-control-sm inline-flex items-center justify-center rounded-control transition-colors cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-35 disabled:cursor-not-allowed ${
      isActive
        ? "bg-line/50 text-ink font-medium"
        : "bg-transparent text-ink-soft hover:text-ink hover:bg-wash active:bg-line/30"
    }`;

  const setLink = () => {
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const raw = window.prompt("Enter link URL (http://, https://, or mailto:):");
    if (!raw) return;
    const trimmed = raw.trim();
    if (/^(https?:\/\/|mailto:)/i.test(trimmed)) {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: trimmed })
        .run();
    } else {
      window.alert("Please enter a valid URL starting with http://, https://, or mailto:");
    }
  };

  const isEditable = !disabled && editor.isEditable;

  return (
    <div
      role="toolbar"
      aria-label="Formatting options"
      className="sticky top-0 z-20 bg-paper border-b border-line px-6 py-1 flex items-center gap-0.5 overflow-x-auto shrink-0"
    >
      {/* Group 1: Marks */}
      <SimpleTooltip content="Bold (Ctrl+B)">
        <button
          type="button"
          aria-label="Bold"
          disabled={!isEditable}
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={btnClass(editor.isActive("bold"))}
        >
          <Bold className="w-4 h-4" />
        </button>
      </SimpleTooltip>

      <SimpleTooltip content="Italic (Ctrl+I)">
        <button
          type="button"
          aria-label="Italic"
          disabled={!isEditable}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={btnClass(editor.isActive("italic"))}
        >
          <Italic className="w-4 h-4" />
        </button>
      </SimpleTooltip>

      <SimpleTooltip content="Underline (Ctrl+U)">
        <button
          type="button"
          aria-label="Underline"
          disabled={!isEditable}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={btnClass(editor.isActive("underline"))}
        >
          <UnderlineIcon className="w-4 h-4" />
        </button>
      </SimpleTooltip>

      <div className="w-hairline h-4 bg-line mx-1.5 shrink-0" aria-hidden="true" />

      {/* Group 2: Headings */}
      <SimpleTooltip content="Heading 1">
        <button
          type="button"
          aria-label="Heading 1"
          disabled={!isEditable}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={btnClass(editor.isActive("heading", { level: 1 }))}
        >
          <Heading1 className="w-4 h-4" />
        </button>
      </SimpleTooltip>

      <SimpleTooltip content="Heading 2">
        <button
          type="button"
          aria-label="Heading 2"
          disabled={!isEditable}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={btnClass(editor.isActive("heading", { level: 2 }))}
        >
          <Heading2 className="w-4 h-4" />
        </button>
      </SimpleTooltip>

      <SimpleTooltip content="Heading 3">
        <button
          type="button"
          aria-label="Heading 3"
          disabled={!isEditable}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={btnClass(editor.isActive("heading", { level: 3 }))}
        >
          <Heading3 className="w-4 h-4" />
        </button>
      </SimpleTooltip>

      <div className="w-hairline h-4 bg-line mx-1.5 shrink-0" aria-hidden="true" />

      {/* Group 3: Lists */}
      <SimpleTooltip content="Bullet list">
        <button
          type="button"
          aria-label="Bullet list"
          disabled={!isEditable}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={btnClass(editor.isActive("bulletList"))}
        >
          <List className="w-4 h-4" />
        </button>
      </SimpleTooltip>

      <SimpleTooltip content="Numbered list">
        <button
          type="button"
          aria-label="Numbered list"
          disabled={!isEditable}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={btnClass(editor.isActive("orderedList"))}
        >
          <ListOrdered className="w-4 h-4" />
        </button>
      </SimpleTooltip>

      <div className="w-hairline h-4 bg-line mx-1.5 shrink-0" aria-hidden="true" />

      {/* Group 4: Blockquote */}
      <SimpleTooltip content="Blockquote">
        <button
          type="button"
          aria-label="Blockquote"
          disabled={!isEditable}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={btnClass(editor.isActive("blockquote"))}
        >
          <Quote className="w-4 h-4" />
        </button>
      </SimpleTooltip>

      {/* Group 5: Link */}
      <SimpleTooltip content="Link">
        <button
          type="button"
          aria-label="Insert link"
          disabled={!isEditable}
          onClick={setLink}
          className={btnClass(editor.isActive("link"))}
        >
          <Link2 className="w-4 h-4" />
        </button>
      </SimpleTooltip>

      <div className="w-hairline h-4 bg-line mx-1.5 shrink-0" aria-hidden="true" />

      {/* Group 6: History (Undo / Redo) */}
      <SimpleTooltip content="Undo">
        <button
          type="button"
          aria-label="Undo"
          disabled={!isEditable || !editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
          className={btnClass(false)}
        >
          <Undo2 className="w-4 h-4" />
        </button>
      </SimpleTooltip>

      <SimpleTooltip content="Redo">
        <button
          type="button"
          aria-label="Redo"
          disabled={!isEditable || !editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
          className={btnClass(false)}
        >
          <Redo2 className="w-4 h-4" />
        </button>
      </SimpleTooltip>
    </div>
  );
}
