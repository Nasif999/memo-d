"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Button } from "@/components/ui/button";

export function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[200px] rounded-md border bg-white p-3 focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return <div className="min-h-[240px] rounded-md border bg-white" />;

  const btn = (active: boolean) =>
    active ? "bg-slate-200" : "";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        <Button type="button" variant="outline" size="sm"
          className={btn(editor.isActive("bold"))}
          onClick={() => editor.chain().focus().toggleBold().run()}>
          B
        </Button>
        <Button type="button" variant="outline" size="sm"
          className={btn(editor.isActive("italic")) + " italic"}
          onClick={() => editor.chain().focus().toggleItalic().run()}>
          I
        </Button>
        <Button type="button" variant="outline" size="sm"
          className={btn(editor.isActive("heading", { level: 2 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          H2
        </Button>
        <Button type="button" variant="outline" size="sm"
          className={btn(editor.isActive("bulletList"))}
          onClick={() => editor.chain().focus().toggleBulletList().run()}>
          • List
        </Button>
        <Button type="button" variant="outline" size="sm"
          className={btn(editor.isActive("orderedList"))}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          1. List
        </Button>
        <Button type="button" variant="outline" size="sm"
          className={btn(editor.isActive("blockquote"))}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          &ldquo;Quote&rdquo;
        </Button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
