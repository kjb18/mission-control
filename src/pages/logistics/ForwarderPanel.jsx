import { useEffect, useRef } from "react";
import { formatLastUsed } from "../../lib/logistics";
import { CloseIcon, StarIcon } from "./LogisticsIcons";
import "../../components/TaskPanel.css";

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

function Row({ label, children }) {
  const empty = children === null || children === undefined || children === "" || (Array.isArray(children) && !children.length);
  return (
    <div className="lg-dl-row">
      <dt>{label}</dt>
      <dd>{empty ? <span className="lg-none">—</span> : children}</dd>
    </div>
  );
}

const Pills = ({ items }) =>
  items?.length ? (
    <span className="lg-pills">
      {items.map((i) => (
        <span key={i} className="lg-pill">{i}</span>
      ))}
    </span>
  ) : null;

const yesNo = (v) => (v ? "Yes" : "No");

/** Read-only slide-over. Reuses the task panel's tp-* classes for layout and animation. */
export default function ForwarderPanel({ open, forwarder: f, onClose, onEdit }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      // Cards open the panel on click, so a mousedown on one must not close it first.
      if (panelRef.current?.contains(e.target) || e.target.closest?.(".lg-card, .lg-overlay")) return;
      onClose();
    };
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <>
      <div className={`tp-overlay${open ? " open" : ""}`}></div>
      <div
        ref={panelRef}
        className={`tp-panel lg-panel${open ? " open" : ""}`}
        role="dialog"
        aria-label="Forwarder details"
        aria-hidden={!open}
      >
        <div className="tp-head">
          <h2 className="tp-title lg-panel-title">{f?.company_name}</h2>
          <button type="button" className="lg-btn outline sm" onClick={() => onEdit(f)} disabled={!f}>
            Edit
          </button>
          <button type="button" className="tp-close" onClick={onClose} aria-label="Close">
            <CloseIcon width={16} height={16} />
          </button>
        </div>
        {f && (
          <div className="tp-body">
            <section>
              <h3 className="tp-sec-label">Company details</h3>
              <dl className="lg-dl">
                <Row label="Trading name">{f.trading_name}</Row>
                <Row label="Type"><Pills items={f.type} /></Row>
                <Row label="Status"><span className={`lg-badge ${f.status}`}>{cap(f.status)}</span></Row>
                <Row label="Preferred"><span className={`lg-badge ${f.preferred_status}`}>{cap(f.preferred_status)}</span></Row>
              </dl>
            </section>
            <section>
              <h3 className="tp-sec-label">Contact</h3>
              <dl className="lg-dl">
                <Row label="Primary contact">{f.primary_contact}</Row>
                <Row label="Phone">{f.phone}</Row>
                <Row label="Email">{f.email}</Row>
                <Row label="Account manager">{f.account_manager}</Row>
                <Row label="Account number">{f.account_number}</Row>
              </dl>
            </section>
            <section>
              <h3 className="tp-sec-label">Services</h3>
              <dl className="lg-dl">
                <Row label="Modes"><Pills items={f.modes} /></Row>
                <Row label="Ports covered">{f.ports_covered}</Row>
                <Row label="Service areas"><Pills items={f.service_areas} /></Row>
                <Row label="Warehousing">{yesNo(f.warehousing)}</Row>
                <Row label="Customs brokerage">{yesNo(f.customs_brokerage)}</Row>
              </dl>
            </section>
            <section>
              <h3 className="tp-sec-label">Commercial</h3>
              <dl className="lg-dl">
                <Row label="Payment terms">{f.payment_terms}</Row>
                <Row label="Incoterms"><Pills items={f.incoterms} /></Row>
                <Row label="Currency">{f.currency}</Row>
              </dl>
            </section>
            <section>
              <h3 className="tp-sec-label">Compliance and history</h3>
              <dl className="lg-dl">
                <Row label="Accreditation no.">{f.accreditation_number}</Row>
                <Row label="Insurance">{f.insurance_details}</Row>
                <Row label="First used">{f.first_used ? formatLastUsed(f.first_used) : null}</Row>
                <Row label="Last used">{formatLastUsed(f.last_used)}</Row>
                <Row label="Rating">
                  {f.rating ? (
                    <span className="lg-stars-static" aria-label={`${f.rating} of 5`}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <StarIcon key={n} filled={n <= f.rating} className={n <= f.rating ? "on" : ""} />
                      ))}
                    </span>
                  ) : null}
                </Row>
              </dl>
            </section>
            <section>
              <h3 className="tp-sec-label">Notes</h3>
              <p className="lg-notes-read">{f.notes || <span className="lg-none">—</span>}</p>
            </section>
          </div>
        )}
      </div>
    </>
  );
}
