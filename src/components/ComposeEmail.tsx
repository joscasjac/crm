import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button, TextLink } from "./ui";

// A floating compose window in the Gmail style but on the app theme:
// draggable by its title bar, resizable from the corner, markdown body
// with a preview, attachments stored in Convex file storage. Send stays
// disabled with an explanation until the selected provider has a key;
// the activity row is written either way so the CRM history is complete.

type Attachment = { storageId: Id<"_storage">; name: string };

// Minimal markdown for email bodies: bold, italic, inline code, links,
// and dash lists. Escapes HTML first so pasted content stays inert.
function renderMarkdown(source: string): string {
  const escaped = source
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const withInline = escaped
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, '<code class="rounded bg-raised px-1 py-0.5 text-[12px]">$1</code>')
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
      '<a href="$2" class="text-accent underline">$1</a>',
    );
  const blocks = withInline.split(/\n{2,}/).map((block) => {
    const lines = block.split("\n");
    if (lines.every((line) => line.startsWith("- "))) {
      const items = lines
        .map((line) => `<li>${line.slice(2)}</li>`)
        .join("");
      return `<ul class="ml-4 list-disc flex flex-col gap-1">${items}</ul>`;
    }
    return `<p>${lines.join("<br/>")}</p>`;
  });
  return blocks.join("");
}

export function ComposeEmail({
  open,
  onClose,
  defaultTo,
  companyId,
  contactId,
  dealId,
}: {
  open: boolean;
  onClose: () => void;
  defaultTo?: string;
  companyId?: Id<"companies">;
  contactId?: Id<"contacts">;
  dealId?: Id<"deals">;
}) {
  const capabilities = useQuery(api.capabilities.status);
  const provider = useQuery(api.email.provider);
  const emailSettings = useQuery(api.email.settings);
  const compose = useMutation(api.email.compose);
  const generateUploadUrl = useMutation(api.email.generateUploadUrl);

  const [to, setTo] = useState(defaultTo ?? "");
  const [cc, setCc] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [bcc, setBcc] = useState("");
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState(false);
  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // Window geometry. Drag moves it, the corner handle resizes it, and
  // both clamp so the title bar can never leave the viewport. On phones
  // the window becomes a fixed bottom sheet instead.
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ w: 520, h: 480 });
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia("(max-width: 639px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const dragState = useRef<{
    mode: "move" | "resize";
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
    baseW: number;
    baseH: number;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setTo(defaultTo ?? "");
    setCc("");
    setShowCc(false);
    setBcc("");
    setShowBcc(false);
    setSubject("");
    setBody("");
    setPreview(false);
    setAttachments([]);
    setError(null);
    setSent(false);
    setPos({
      x: Math.max(16, window.innerWidth - 560),
      y: Math.max(16, window.innerHeight - 540),
    });
    setSize({ w: 520, h: 480 });
    // The reset runs when the window opens, not on every prop echo.
  }, [open]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const state = dragState.current;
      if (!state) return;
      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;
      if (state.mode === "move") {
        setPos({
          x: Math.min(
            Math.max(state.baseX + dx, 8),
            window.innerWidth - 120,
          ),
          y: Math.min(
            Math.max(state.baseY + dy, 8),
            window.innerHeight - 48,
          ),
        });
      } else {
        setSize({
          w: Math.max(380, state.baseW + dx),
          h: Math.max(320, state.baseH + dy),
        });
      }
    };
    const onUp = () => {
      dragState.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  if (!open) return null;

  const configured =
    provider === "agentmail" ? capabilities?.agentmail : capabilities?.resend;
  const providerLabel = provider === "agentmail" ? "AgentMail" : "Resend";

  const startDrag = (mode: "move" | "resize") => (e: React.PointerEvent) => {
    e.preventDefault();
    dragState.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      baseX: pos.x,
      baseY: pos.y,
      baseW: size.w,
      baseH: size.h,
    };
  };

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const added: Array<Attachment> = [];
      for (const file of Array.from(files)) {
        const url = await generateUploadUrl();
        const result = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        const { storageId } = (await result.json()) as {
          storageId: Id<"_storage">;
        };
        added.push({ storageId, name: file.name });
      }
      setAttachments((current) => [...current, ...added]);
    } catch {
      setError("Could not upload the file. Try again.");
    } finally {
      setUploading(false);
    }
  };

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      await compose({
        to: to.trim(),
        cc: cc.trim() || undefined,
        bcc: bcc.trim() || undefined,
        subject: subject.trim(),
        body,
        companyId,
        contactId,
        dealId,
        attachments,
      });
      setSent(true);
      setTimeout(onClose, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send");
    } finally {
      setSending(false);
    }
  };

  const canSend =
    !!configured &&
    !sending &&
    !uploading &&
    to.trim().length > 0 &&
    subject.trim().length > 0 &&
    body.trim().length > 0;

  return (
    <div
      className={`fixed z-50 flex flex-col overflow-hidden border border-edge-strong bg-panel shadow-2xl ${
        isMobile ? "inset-x-0 bottom-0 rounded-t-lg" : "rounded-lg"
      }`}
      style={
        isMobile
          ? { height: "min(480px, 85dvh)" }
          : { left: pos.x, top: pos.y, width: size.w, height: size.h }
      }
    >
      <div
        onPointerDown={isMobile ? undefined : startDrag("move")}
        className={`flex items-center justify-between border-b border-edge bg-raised px-3 py-2 select-none ${
          isMobile ? "" : "cursor-move"
        }`}
      >
        <span className="text-sm font-medium text-white">New email</span>
        <button
          onClick={onClose}
          title="Close"
          className="cursor-pointer text-neutral-500 transition-colors hover:text-white"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="flex items-center gap-2 border-b border-edge px-3 py-1.5">
        <span className="w-10 text-xs text-neutral-500">To</span>
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="name@company.com"
          className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-neutral-500 focus:outline-none"
        />
        {!showCc ? (
          <button
            onClick={() => setShowCc(true)}
            className="text-xs text-neutral-500 transition-colors hover:text-white"
          >
            Cc
          </button>
        ) : null}
        {!showBcc ? (
          <button
            onClick={() => setShowBcc(true)}
            className="text-xs text-neutral-500 transition-colors hover:text-white"
          >
            Bcc
          </button>
        ) : null}
      </div>
      {showCc ? (
        <div className="flex items-center gap-2 border-b border-edge px-3 py-1.5">
          <span className="w-10 text-xs text-neutral-500">Cc</span>
          <input
            value={cc}
            onChange={(e) => setCc(e.target.value)}
            placeholder="someone@company.com"
            className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-neutral-500 focus:outline-none"
          />
        </div>
      ) : null}
      {showBcc ? (
        <div className="flex items-center gap-2 border-b border-edge px-3 py-1.5">
          <span className="w-10 text-xs text-neutral-500">Bcc</span>
          <input
            value={bcc}
            onChange={(e) => setBcc(e.target.value)}
            placeholder="someone@company.com"
            className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-neutral-500 focus:outline-none"
          />
        </div>
      ) : null}
      <div className="flex items-center gap-2 border-b border-edge px-3 py-1.5">
        <span className="w-10 text-xs text-neutral-500">Subject</span>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="What is this about?"
          className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-neutral-500 focus:outline-none"
        />
        <button
          onClick={() => setPreview((value) => !value)}
          className={`rounded border px-1.5 py-0.5 text-[10px] transition-colors ${
            preview
              ? "border-edge-strong bg-raised text-white"
              : "border-edge text-neutral-500 hover:text-white"
          }`}
        >
          {preview ? "Write" : "Preview"}
        </button>
      </div>

      {preview ? (
        <div
          className="min-h-0 flex-1 overflow-y-auto px-3 py-2 text-sm leading-relaxed text-neutral-200 [&_p]:mb-2"
          dangerouslySetInnerHTML={{
            __html:
              renderMarkdown(body) ||
              '<p class="text-neutral-500">Nothing to preview yet.</p>',
          }}
        />
      ) : (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write in markdown: **bold**, *italic*, [links](https://...), - lists"
          className="min-h-0 flex-1 resize-none bg-transparent px-3 py-2 text-sm leading-relaxed text-neutral-200 placeholder:text-neutral-500 focus:outline-none"
        />
      )}

      {emailSettings?.signature ? (
        <p className="border-t border-edge px-3 py-1.5 text-[11px] text-neutral-500">
          Signature from Settings appends on send.
        </p>
      ) : null}

      {attachments.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 border-t border-edge px-3 py-2">
          {attachments.map((attachment) => (
            <span
              key={attachment.storageId}
              className="flex items-center gap-1.5 rounded border border-edge bg-raised px-2 py-0.5 text-[11px] text-neutral-300"
            >
              {attachment.name}
              <button
                onClick={() =>
                  setAttachments((current) =>
                    current.filter(
                      (item) => item.storageId !== attachment.storageId,
                    ),
                  )
                }
                title="Remove attachment"
                className="text-neutral-500 hover:text-white"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-2 border-t border-edge px-3 py-2">
        <Button variant="primary" onClick={() => void send()} disabled={!canSend}>
          {sent ? "Sent" : sending ? "Sending…" : "Send"}
        </Button>
        <label className="cursor-pointer rounded-md border border-edge px-2.5 py-1.5 text-xs text-neutral-400 transition-colors hover:text-white">
          {uploading ? "Uploading…" : "Attach"}
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        {configured === false ? (
          <p className="min-w-0 flex-1 truncate text-right text-[11px] text-neutral-500">
            {providerLabel} has no key, so sending is off.{" "}
            <TextLink to="/app/settings/email" variant="hover">
              Set it up
            </TextLink>
          </p>
        ) : null}
        {error ? (
          <p className="min-w-0 flex-1 truncate text-right text-[11px] text-red-400">
            {error}
          </p>
        ) : null}
      </div>

      <div
        onPointerDown={startDrag("resize")}
        title="Resize"
        className="absolute bottom-0 right-0 hidden h-4 w-4 cursor-nwse-resize sm:block"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          className="absolute bottom-1 right-1 text-neutral-600"
        >
          <path d="M9 1v8H1" fill="none" stroke="currentColor" />
        </svg>
      </div>
    </div>
  );
}
