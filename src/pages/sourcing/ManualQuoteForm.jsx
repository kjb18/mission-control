import { useState } from "react";

const initial = { supplierName: "", brand: "", unitPrice: "", leadTimeWeeks: "", certified: false };

export default function ManualQuoteForm({ suppliers, onSave, busy }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState(null);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!form.supplierName.trim() || !form.unitPrice) {
      setError("Supplier name and unit price are required.");
      return;
    }
    try {
      await onSave({
        ...form,
        unitPrice: Number(form.unitPrice),
        leadTimeWeeks: Number(form.leadTimeWeeks || 0),
      });
      setForm(initial);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
      <label className="block col-span-2 sm:col-span-1">
        <span className="block text-[11px] text-white/40 mb-1">Supplier</span>
        <input
          list="supplier-names"
          value={form.supplierName}
          onChange={(e) => update("supplierName", e.target.value)}
          className="input"
          placeholder="Supplier name"
        />
        <datalist id="supplier-names">
          {suppliers.map((s) => (
            <option key={s.id} value={s.name} />
          ))}
        </datalist>
      </label>
      <label className="block">
        <span className="block text-[11px] text-white/40 mb-1">Brand</span>
        <input value={form.brand} onChange={(e) => update("brand", e.target.value)} className="input" />
      </label>
      <label className="block">
        <span className="block text-[11px] text-white/40 mb-1">Unit price</span>
        <input
          type="number"
          step="0.01"
          value={form.unitPrice}
          onChange={(e) => update("unitPrice", e.target.value)}
          className="input"
        />
      </label>
      <label className="block">
        <span className="block text-[11px] text-white/40 mb-1">Lead time (wk)</span>
        <input
          type="number"
          step="0.5"
          value={form.leadTimeWeeks}
          onChange={(e) => update("leadTimeWeeks", e.target.value)}
          className="input"
        />
      </label>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-white/60">
          <input
            type="checkbox"
            checked={form.certified}
            onChange={(e) => update("certified", e.target.checked)}
          />
          Certified
        </label>
        <button
          type="submit"
          disabled={busy}
          className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-50 text-white text-sm shrink-0"
        >
          Log Reply
        </button>
      </div>
      {error && <p className="col-span-full text-xs text-red-400">{error}</p>}
    </form>
  );
}
