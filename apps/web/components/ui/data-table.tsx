import type { ReactNode } from "react";

type DataTableProps = {
  columns: string[];
  rows: Array<Array<ReactNode>>;
};

export function DataTable({ columns, rows }: DataTableProps) {
  return (
    <div className="panel overflow-hidden rounded-3xl">
      <div className="overflow-x-auto exchange-scrollbar">
        <table className="min-w-max border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-subtle)]">
              {columns.map((column) => (
                <th
                  key={column}
                  className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--foreground-muted)]"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`} className="table-row">
                {row.map((cell, cellIndex) => (
                  <td
                    key={`cell-${rowIndex}-${cellIndex}`}
                    className="px-4 py-3 text-sm text-[var(--foreground-soft)]"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
