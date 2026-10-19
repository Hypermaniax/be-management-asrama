export type CsvColumn<T> = {
  header: string;
  value: (row: T) => unknown;
};

const escape = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }
  const text = value instanceof Date ? value.toISOString() : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const toCsv = <T>(rows: T[], columns: CsvColumn<T>[]): string => {
  const header = columns.map((column) => escape(column.header)).join(",");
  const body = rows.map((row) =>
    columns.map((column) => escape(column.value(row))).join(","),
  );
  return [header, ...body].join("\r\n");
};
