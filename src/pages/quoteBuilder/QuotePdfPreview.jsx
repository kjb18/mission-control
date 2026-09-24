export default function QuotePdfPreview({ pdfUrl, generating, approved, onGenerate, onApprove, stale }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          onClick={onGenerate}
          disabled={generating}
          className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-50 text-white text-sm font-medium"
        >
          {generating ? "Generating PDF…" : pdfUrl ? "Regenerate PDF" : "Generate PDF Preview"}
        </button>
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-accent hover:text-accent-light"
          >
            Open / download PDF ↗
          </a>
        )}
      </div>

      {stale && pdfUrl && (
        <p className="text-xs text-amber-300/80 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
          Line items or markups changed since this PDF was generated — regenerate before approving.
        </p>
      )}

      {pdfUrl && (
        <div className="rounded-xl border border-white/10 overflow-hidden bg-white" style={{ height: 500 }}>
          <iframe src={pdfUrl} title="Quotation PDF preview" className="w-full h-full" />
        </div>
      )}

      {pdfUrl && !stale && (
        <label className="flex items-center gap-2 text-sm text-white/70">
          <input type="checkbox" checked={approved} onChange={(e) => onApprove(e.target.checked)} />
          I've reviewed this PDF and approve it for sending.
        </label>
      )}
    </div>
  );
}
