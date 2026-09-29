import { useEffect, useRef, useState } from "react";

const hasFiles = (e) => Array.from(e.dataTransfer?.types ?? []).includes("Files");

/**
 * Makes the whole window a file drop target while the calling page is
 * mounted. Returns true while a file drag is over the window. Listens on
 * window rather than the page container so a drop over the sidebar or
 * margins still lands, and counts enter/leave pairs so crossing child
 * elements doesn't flicker the overlay.
 */
export function useFileDrop(onDrop) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  useEffect(() => {
    function enter(e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current += 1;
      setDragging(true);
    }
    function over(e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
    function leave(e) {
      if (!hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      // relatedTarget is null once the pointer leaves the window.
      if (depth.current === 0 || e.relatedTarget === null) {
        depth.current = 0;
        setDragging(false);
      }
    }
    function drop(e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setDragging(false);
      const files = Array.from(e.dataTransfer.files ?? []);
      if (files.length) onDropRef.current(files);
    }
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, []);

  return dragging;
}

export default function FileDropOverlay({ show, text }) {
  if (!show) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(59,130,246,0.08)",
        border: "3px dashed #3b82f6",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, color: "#3b82f6" }}>
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 16.58A5 5 0 0018 7h-1.26A8 8 0 104 15.25" />
          <polyline points="16 16 12 12 8 16" />
          <line x1="12" y1="12" x2="12" y2="21" />
        </svg>
        <p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{text}</p>
      </div>
    </div>
  );
}
