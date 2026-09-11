import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractDateFromText,
  extractDueDateFromText,
  extractSupplierFromText,
  extractTotalFromText,
} from './ocr';

test('mendeteksi tanggal dari nota faktur kredit', () => {
  const text = `
  FAKTUR KREDIT
  No Faktur : SI206874296
  Tanggal : 2025-08-31
  Term : KREDIT 14 HARI
  Kepada yth: AMELIA JAYA
  `;

  assert.equal(extractDateFromText(text)?.toISOString().slice(0, 10), '2025-08-31');
});

test('mendeteksi total yang benar dari baris kolom kanan', () => {
  const text = `
  Sub Total 850,328
  TOTAL 850,328
  PPN 12.00%
  `;

  assert.equal(extractTotalFromText(text), 850328);
});

test('mengabaikan nomor barcode atau id panjang saat memilih total', () => {
  const text = `
  No Faktur : 9250140041010000
  Sub Total 850,328
  TOTAL 850,328
  `;

  assert.equal(extractTotalFromText(text), 850328);
});

test('mengabaikan nomor panjang seperti 2608107925 saat memilih total', () => {
  const text = `
  No Referensi : 2608107925
  Sub Total 850,328
  TOTAL 850,328
  `;

  assert.equal(extractTotalFromText(text), 850328);
});

test('membaca tanggal jatuh tempo dari teks nota', () => {
  const text = `
  Tanggal : 2025-08-31
  Jatuh Tempo : 14-09-2025
  TOTAL 850,328
  `;

  assert.equal(extractDueDateFromText(text)?.toISOString().slice(0, 10), '2025-09-14');
});

test('mengambil total terbesar dari baris yang juga memuat jumlah item', () => {
  const text = `
  RK MILD 16
  2 SLOP 353.000 706.000
  RK MARLBORO MERAH
  1 SLOP 520.000 520.000
  ITEM : 18 Total : 4.173.000
  @ITEM: 10 Bayar :
  Kembali :
  `;

  assert.equal(extractTotalFromText(text), 4173000);
});

test('mendeteksi supplier/nama toko dari nota', () => {
  const text = `
  PT. INTI FARMASI PRIMA
  Kepada yth: AMELIA JAYA
  `;

  assert.match(extractSupplierFromText(text) ?? '', /INTI FARMASI PRIMA|AMELIA JAYA/i);
});
