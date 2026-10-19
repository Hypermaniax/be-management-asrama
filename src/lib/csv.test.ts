import assert from "node:assert/strict";
import { test } from "node:test";
import { toCsv } from "./csv.ts";

test("toCsv writes a header and rows", () => {
  const csv = toCsv(
    [
      { name: "Budi", amount: 100 },
      { name: "Siti", amount: 250 },
    ],
    [
      { header: "Nama", value: (row) => row.name },
      { header: "Jumlah", value: (row) => row.amount },
    ],
  );
  assert.equal(csv, "Nama,Jumlah\r\nBudi,100\r\nSiti,250");
});

test("toCsv escapes commas, quotes and newlines", () => {
  const csv = toCsv(
    [{ note: 'a,"b"', empty: null, when: new Date("2026-01-02T03:04:05.000Z") }],
    [
      { header: "Catatan", value: (row) => row.note },
      { header: "Kosong", value: (row) => row.empty },
      { header: "Waktu", value: (row) => row.when },
    ],
  );
  assert.equal(
    csv,
    'Catatan,Kosong,Waktu\r\n"a,""b""",,2026-01-02T03:04:05.000Z',
  );
});

test("toCsv returns only the header for no rows", () => {
  const csv = toCsv([], [{ header: "Nama", value: () => "" }]);
  assert.equal(csv, "Nama");
});
