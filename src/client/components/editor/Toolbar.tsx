import type { EditorView } from "@codemirror/view";
import { useTranslation } from "react-i18next";

interface ToolbarProps {
  editorView: EditorView | null;
}

interface ToolbarAction {
  labelKey: string;
  icon: string;
  action: (view: EditorView) => void;
}

const actions: ToolbarAction[] = [
  {
    labelKey: "toolbar.heading",
    icon: "H",
    action: (view) => wrapOrPrefix(view, "# ", ""),
  },
  {
    labelKey: "toolbar.bold",
    icon: "B",
    action: (view) => wrapSelection(view, "**", "**"),
  },
  {
    labelKey: "toolbar.italic",
    icon: "I",
    action: (view) => wrapSelection(view, "*", "*"),
  },
  {
    labelKey: "toolbar.code",
    icon: "<>",
    action: (view) => wrapSelection(view, "`", "`"),
  },
  {
    labelKey: "toolbar.link",
    icon: "🔗",
    action: (view) => wrapSelection(view, "[", "](url)"),
  },
  {
    labelKey: "toolbar.quote",
    icon: "❝",
    action: (view) => wrapOrPrefix(view, "> ", ""),
  },
  {
    labelKey: "toolbar.unorderedList",
    icon: "•",
    action: (view) => wrapOrPrefix(view, "- ", ""),
  },
  {
    labelKey: "toolbar.orderedList",
    icon: "1.",
    action: (view) => wrapOrPrefix(view, "1. ", ""),
  },
  {
    labelKey: "toolbar.codeBlock",
    icon: "{ }",
    action: (view) => wrapSelection(view, "\n```\n", "\n```\n"),
  },
];

function wrapSelection(view: EditorView, before: string, after: string) {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  view.dispatch({
    changes: { from, to, insert: `${before}${selected}${after}` },
    selection: {
      anchor: from + before.length,
      head: from + before.length + selected.length,
    },
  });
  view.focus();
}

function wrapOrPrefix(view: EditorView, prefix: string, _suffix: string) {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);

  if (selected.includes("\n")) {
    // Multi-line: prefix each line
    const lines = selected.split("\n").map((line) => `${prefix}${line}`);
    view.dispatch({
      changes: { from, to, insert: lines.join("\n") },
    });
  } else {
    // Single line or no selection: insert prefix at line start
    const line = view.state.doc.lineAt(from);
    view.dispatch({
      changes: { from: line.from, to: line.from, insert: prefix },
      selection: { anchor: from + prefix.length },
    });
  }
  view.focus();
}

export function Toolbar({ editorView }: ToolbarProps) {
  const { t } = useTranslation("editor");

  return (
    <div className="flex items-center gap-1 border-b border-gray-200 px-2 py-1 dark:border-gray-700">
      {actions.map((action) => (
        <button
          key={action.labelKey}
          type="button"
          title={t(action.labelKey)}
          disabled={!editorView}
          onClick={() => editorView && action.action(editorView)}
          className="rounded px-2 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          {action.icon}
        </button>
      ))}
    </div>
  );
}
