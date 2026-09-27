import { buildMailto } from "../../lib/outreach";

export default function SendQuotePanel({ contact, email, approved, sending, sent, onSend }) {
  const canSend = approved && !sending && !sent;

  return (
    <div className="space-y-3">
      <div className="text-sm text-ink-secondary">
        <span className="text-ink-secondary">To: </span>
        {contact ? (
          <span>
            {contact.name} ({contact.email || "no email on file"})
          </span>
        ) : (
          <span className="text-orange-600/80">
            No contact found for this client — add one in Contacts, or fill in the email manually below.
          </span>
        )}
      </div>

      <p className="text-xs text-ink-muted">
        mailto links can't carry attachments — download the PDF above first, then attach it in your
        mail app before sending. Sending here marks the RFQ as quoted and records the quotation.
      </p>

      <div className="flex items-center gap-3">
        <a
          href={buildMailto({ to: contact?.email, subject: email.subject, body: email.body })}
          onClick={() => canSend && onSend()}
          aria-disabled={!canSend}
          className={`inline-flex items-center justify-center rounded-lg text-[13px] font-medium transition-all duration-150 ${
            canSend
              ? "bg-accent text-[#fff] hover:opacity-90 active:scale-[0.98]"
              : "bg-base-800/60 text-ink-muted pointer-events-none"
          }`}
          style={{ padding: "8px 16px" }}
        >
          {sent ? "Sent ✓" : sending ? "Recording…" : "Approve → Open Email & Send"}
        </a>
      </div>
    </div>
  );
}
