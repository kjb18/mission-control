export default function QuotePdfPreview({ pdfUrl, generating, approved, onGenerate, onApprove, stale }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          onClick={onGenerate}
          disabled={generating}
          className="px-4 py-2 rounded-lg bg-base-800 hover:bg-base-800/80 border-[0.5px] border-line-strong disabled:opacity-50 text-white text-sm font-medium"
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
        <p className="text-xs text-orange-400/80 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2">
          Line items or markups changed since this PDF was generated — regenerate before approving.
        </p>
      )}

      {pdfUrl && (
        <div className="rounded-lg border border-line overflow-hidden bg-[#ffffff]" style={{ height: 500 }}>
          <iframe src={pdfUrl} title="Quotation PDF preview" className="w-full h-full" />
        </div>
      )}

      {pdfUrl && !stale && (
        <label className="flex items-center gap-2 text-sm text-ink-secondary">
          <input type="checkbox" checked={approved} onChange={(e) => onApprove(e.target.checked)} />
          I've reviewed this PDF and approve it for sending.
        </label>
      )}
    </div>
  );
}
