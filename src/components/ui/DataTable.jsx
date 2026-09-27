export default function DataTable({ columns, rows, onRowClick }) {
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr>
          {columns.map((col) => (
            <th
              key={col.key}
              className="text-[10px] uppercase text-ink-muted tracking-[0.06em] font-medium border-b border-line py-2.5 px-4"
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={row.id ?? i}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={`border-b border-base-800 hover:bg-base-800 transition-colors ${
              onRowClick ? "cursor-pointer" : ""
            }`}
          >
            {columns.map((col) => (
              <td key={col.key} className="text-[13px] text-white py-3 px-4">
                {col.render ? col.render(row) : row[col.key] ?? "—"}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
