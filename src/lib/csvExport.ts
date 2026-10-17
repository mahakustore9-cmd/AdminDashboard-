// ==============================================================================
// MAHAKU CORPORATION PVT. LTD. - STUDENT SAFETY TRACKING SYSTEM
// RFC-4180 Compliant CSV Export Utility
// ==============================================================================

/**
 * Escapes and serializes an array of records to a CSV string and triggers a browser download.
 */
export function exportToCSV<T extends object>(
  filename: string,
  headers: { label: string; key: keyof T | ((row: T) => string | number | null | undefined) }[],
  data: T[]
) {
  if (!data || !data.length) {
    alert('No data available to export.');
    return;
  }

  const escapeCell = (val: unknown): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headerRow = headers.map((h) => escapeCell(h.label)).join(',');

  const dataRows = data.map((row) => {
    return headers
      .map((h) => {
        const val = typeof h.key === 'function' ? h.key(row) : (row as Record<string, unknown>)[h.key as string];
        return escapeCell(val);
      })
      .join(',');
  });

  // Include UTF-8 Byte Order Mark (BOM) to ensure Microsoft Excel displays UTF-8 correctly
  const csvContent = '\uFEFF' + [headerRow, ...dataRows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const timestamp = new Date().toISOString().slice(0, 10);
  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  downloadLink.setAttribute('download', `${filename}_${timestamp}.csv`);
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(url);
}
