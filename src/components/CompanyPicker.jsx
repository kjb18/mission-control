import { useEffect, useMemo, useRef, useState } from "react";
import "./CompanyPicker.css";

/**
 * Searchable company dropdown. `companies` is [{ id, name }]. Typing a name that
 * doesn't exist offers "+ Create company"; onCreate(name) must return the new { id, name }.
 */
export default function CompanyPicker({ companies, value, onChange, onCreate, placeholder = "Search companies…", allowClear = true, autoFocus = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const wrapRef = useRef(null);
  const selected = companies.find((c) => c.id === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => !wrapRef.current?.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () => companies.filter((c) => !q || c.name.toLowerCase().includes(q)).slice(0, 50),
    [companies, q]
  );
  const exact = companies.some((c) => c.name.toLowerCase() === q);

  const choose = (company) => {
    onChange(company ? company.id : null, company);
    setOpen(false);
    setQuery("");
  };

  async function create() {
    setBusy(true);
    setError("");
    try {
      choose(await onCreate(query.trim()));
    } catch (e) {
      setError(e.message ?? "Could not create company");
    }
    setBusy(false);
  }

  return (
    <div className="cp-wrap" ref={wrapRef}>
      <input
        className="cp-input"
        value={open ? query : selected?.name ?? ""}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open && (
        <div className="cp-list" role="listbox">
          {allowClear && selected && !q && (
            <div className="cp-opt cp-none" onMouseDown={(e) => e.preventDefault()} onClick={() => choose(null)}>
              No company
            </div>
          )}
          {matches.map((c) => (
            <div
              key={c.id}
              role="option"
              aria-selected={c.id === value}
              className={`cp-opt${c.id === value ? " sel" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(c)}
            >
              {c.name}
            </div>
          ))}
          {!matches.length && !onCreate && <div className="cp-empty">No companies found</div>}
          {onCreate && q && !exact && (
            <div className="cp-opt cp-create" onMouseDown={(e) => e.preventDefault()} onClick={busy ? undefined : create}>
              {busy ? "Creating…" : `+ Create company "${query.trim()}"`}
            </div>
          )}
          {error && <div className="cp-error">{error}</div>}
        </div>
      )}
    </div>
  );
}
