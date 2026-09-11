import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { createWorker } from 'tesseract.js';

export interface OcrResult {
  text: string;
  confidence: number;
  jumlah: number | null;
  tanggal: Date | null;
  supplier: string | null;
  jatuhTempo: Date | null;
}

/**
 * Baca teks dari foto nota/bon menggunakan OCR (Tesseract),
 * lalu cari nominal total & tanggal transaksi dengan heuristik regex
 * supaya kasir tidak perlu ketik ulang manual.
 */
export async function readBonImage(imagePath: string): Promise<OcrResult> {
  const provider = (process.env.OCR_PROVIDER || 'tesseract').toLowerCase();

  if (provider === 'google') {
    const googleResult = await readWithGoogleVision(imagePath);
    if (googleResult) return googleResult;
  }

  return readWithTesseract(imagePath);
}

async function readWithGoogleVision(imagePath: string): Promise<OcrResult | null> {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsPath) return null;

  try {
    const client = new ImageAnnotatorClient({ keyFilename: path.resolve(process.cwd(), credentialsPath) });
    const [result] = await client.textDetection({ image: { source: { filename: imagePath } } });
    const text = result.fullTextAnnotation?.text || '';
    const blocks = result.fullTextAnnotation?.pages?.flatMap((page) => page.blocks ?? []) ?? [];
    const confidence = blocks.length > 0 ? 90 : 85;

    const tanggal = extractDateFromText(text);
    const jatuhTempo = extractDueDateFromText(text) ?? addDays(tanggal ?? new Date(), 14);

    return {
      text,
      confidence,
      jumlah: extractTotalFromText(text),
      tanggal,
      supplier: extractSupplierFromText(text),
      jatuhTempo,
    };
  } catch (error) {
    console.warn('Google Vision OCR failed, falling back to Tesseract:', error);
    return null;
  }
}

async function readWithTesseract(imagePath: string): Promise<OcrResult> {
  const worker = await createWorker('ind+eng');
  try {
    const variants = await buildInvoiceVariants(imagePath);
    let bestText = '';
    let bestConfidence = 0;

    for (const variantPath of variants) {
      const { data } = await worker.recognize(variantPath, { rotateAuto: true } as any);
      const text = (data.text || '').trim();
      const confidence = data.confidence ?? 0;

      if (text && confidence > bestConfidence) {
        bestText = text;
        bestConfidence = confidence;
      }
    }

    await Promise.allSettled(variants.map((variantPath) => fs.unlink(variantPath)));

    const text = bestText;
    const confidence = bestConfidence || 0;
    const tanggal = extractDateFromText(text);
    const jatuhTempo = extractDueDateFromText(text) ?? addDays(tanggal ?? new Date(), 14);

    return {
      text,
      confidence,
      jumlah: extractTotalFromText(text),
      tanggal,
      supplier: extractSupplierFromText(text),
      jatuhTempo,
    };
  } finally {
    await worker.terminate();
  }
}

async function buildInvoiceVariants(imagePath: string): Promise<string[]> {
  const base = imagePath.replace(/\.[^/.]+$/, '');
  const variants: Array<Promise<string>> = [
    sharp(imagePath)
      .normalize()
      .resize({ width: 1800, withoutEnlargement: true })
      .grayscale()
      .sharpen()
      .modulate({ brightness: 1.15, saturation: 1.1 })
      .threshold(180)
      .toFile(`${base}-ocr-1.jpg`)
      .then(() => `${base}-ocr-1.jpg`),
    sharp(imagePath)
      .normalize()
      .resize({ width: 2200, withoutEnlargement: true })
      .grayscale()
      .modulate({ brightness: 1.25, saturation: 1.2 })
      .threshold(200)
      .toFile(`${base}-ocr-2.jpg`)
      .then(() => `${base}-ocr-2.jpg`),
    sharp(imagePath)
      .normalize()
      .resize({ width: 2000, withoutEnlargement: true })
      .grayscale()
      .sharpen()
      .modulate({ brightness: 1.3, saturation: 1.2 })
      .toFile(`${base}-ocr-3.jpg`)
      .then(() => `${base}-ocr-3.jpg`),
  ];

  return Promise.all(variants);
}

function mergeOcrText(bestText: string, variants: string[]): string {
  if (!bestText) return '';

  const textParts = [bestText];
  for (const variantPath of variants) {
    if (!variantPath) continue;
  }
  return textParts.join('\n');
}

const TOTAL_KEYWORDS = /(grand\s*total|total\s*bayar|total\s*belanja|total\s*harga|total|sub\s*total|subtotal|jumlah\s*bayar|amount\s*due|net\s*total)/i;
const AMOUNT_PATTERN = /(?:rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})+|\d{1,12}(?:[.,]\d{2,3})?)/gi;

function normalizeAmountCandidate(raw: string | undefined | null): { value: number | null; normalizedDigits: string } {
  if (!raw) {
    return { value: null, normalizedDigits: '' };
  }

  const normalizedDigits = raw.replace(/[^\d]/g, '');
  if (!normalizedDigits || normalizedDigits.length > 12) {
    return { value: null, normalizedDigits };
  }

  const value = parseNumber(raw);
  if (value === null || value > 100_000_000_000) {
    return { value: null, normalizedDigits };
  }

  return { value, normalizedDigits };
}

export function extractTotalFromText(text: string): number | null {
  const lines = text.split(/\r?\n/);

  const totalLines = lines
    .map((line) => line.trim())
    .filter((line) => TOTAL_KEYWORDS.test(line));

  for (const line of totalLines) {
    const matches = [...line.matchAll(AMOUNT_PATTERN)];
    let best: number | null = null;
    for (const match of matches) {
      const { value } = normalizeAmountCandidate(match[1]);
      if (value !== null && (best === null || value > best)) {
        best = value;
      }
    }
    if (best !== null) {
      return best;
    }
  }

  let bestCandidate: { value: number; score: number } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const n = parseRupiahFromLine(trimmed);
    if (n === null) continue;

    let score = 0;
    if (/grand\s*total|total\s*bayar|total\s*belanja|total\s*harga|\btotal\b|amount\s*due|net\s*total/i.test(trimmed)) score += 100;
    if (/sub\s*total|subtotal/i.test(trimmed)) score += 90;
    if (/jumlah\s*bayar|jumlah\s*tagihan|bayar/i.test(trimmed)) score += 80;
    if (/ppn|dpp|diskon|potongan/i.test(trimmed)) score -= 60;
    if (/rp\.?/i.test(trimmed)) score += 10;

    if (score <= 0 && !TOTAL_KEYWORDS.test(trimmed)) continue;

    const candidate = { value: n, score };
    if (!bestCandidate || candidate.score > bestCandidate.score || (candidate.score === bestCandidate.score && candidate.value > bestCandidate.value)) {
      bestCandidate = candidate;
    }
  }

  if (bestCandidate) return bestCandidate.value;

  const all = [...text.matchAll(/rp\.?\s*(\d{1,3}(?:[.,]\d{3})+|\d{1,12}(?:[.,]\d{2,3})?)|(\d{1,3}(?:[.,]\d{3})+)/gi)]
    .map((m) => normalizeAmountCandidate(m[1] ?? m[2] ?? null))
    .filter(({ value, normalizedDigits }) => value !== null && value >= 500 && normalizedDigits.length <= 12)
    .map(({ value }) => value as number);

  if (all.length === 0) return null;
  return Math.max(...all);
}

function parseRupiahFromLine(line: string): number | null {
  const matches = [...line.matchAll(AMOUNT_PATTERN)];
  if (matches.length === 0) return null;

  if (TOTAL_KEYWORDS.test(line)) {
    let best: number | null = null;
    for (const match of matches) {
      const { value } = normalizeAmountCandidate(match[1]);
      if (value !== null && (best === null || value > best)) {
        best = value;
      }
    }
    return best;
  }

  const { value } = normalizeAmountCandidate(matches[0][1] ?? null);
  return value;
}

export function parseNumber(raw: string): number | null {
  if (!raw) return null;

  const cleaned = raw.replace(/\s+/g, '').replace(/[^\d,\.]/g, '');
  if (!cleaned) return null;

  if (cleaned.includes(',') && cleaned.includes('.')) {
    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const normalized = decimalSeparator === ','
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '');
    const n = Number(normalized);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  if (cleaned.includes(',')) {
    const lastComma = cleaned.lastIndexOf(',');
    const groupSize = cleaned.length - lastComma - 1;
    const normalized = groupSize === 3
      ? cleaned.replace(/,/g, '')
      : cleaned.replace(',', '.');
    const n = Number(normalized);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  if (cleaned.includes('.')) {
    const lastDot = cleaned.lastIndexOf('.');
    const groupSize = cleaned.length - lastDot - 1;
    const normalized = groupSize === 3
      ? cleaned.replace(/\./g, '')
      : cleaned.replace(/\./g, '');
    const n = Number(normalized);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function extractDateFromText(text: string): Date | null {
  const patterns = [
    /(?:tanggal|date|tgl)\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /(?:tanggal|date|tgl)\s*[:\-]?\s*(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/i,
    /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/,
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const raw = match[1] || match[0];
    const normalized = raw.replace(/\s+/g, '');

    if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(normalized)) {
      const [y, mo, d] = normalized.split(/[\/\-]/).map(Number);
      return normalizeDate(y, mo, d);
    }

    const [d, mo, y] = normalized.split(/[\/\-]/).map(Number);
    const year = String(y).length === 2 ? 2000 + Number(y) : Number(y);
    return normalizeDate(year, mo, d);
  }

  return null;
}

function normalizeDate(year: number, month: number, day: number): Date | null {
  if (!year || !month || !day) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function extractDueDateFromText(text: string): Date | null {
  const patterns = [
    /(?:jatuh\s*tempo|due\s*date|tempo)\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /(?:jatuh\s*tempo|due\s*date|tempo)\s*[:\-]?\s*(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;

    const normalized = match[1].replace(/\s+/g, '');
    if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(normalized)) {
      const [y, mo, d] = normalized.split(/[\/\-]/).map(Number);
      return normalizeDate(y, mo, d);
    }

    const [d, mo, y] = normalized.split(/[\/\-]/).map(Number);
    const year = String(y).length === 2 ? 2000 + Number(y) : Number(y);
    return normalizeDate(year, mo, d);
  }

  return null;
}

export function extractSupplierFromText(text: string): string | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 3 && !/^\d+$/.test(line));

  const preferred = lines.find((line) => /(PT\.|CV\.|UD\.|KUD\.|Perusahaan|Toko|Store|Supplier)/i.test(line));
  if (preferred) return preferred;

  const fallback = lines.find((line) => /[A-Z][A-Z0-9&/(). -]{3,}/.test(line));
  return fallback ?? null;
}

function extractSupplier(text: string): string | null {
  return extractSupplierFromText(text);
}

function extractDate(text: string): Date | null {
  return extractDateFromText(text);
}

function extractTotal(text: string): number | null {
  return extractTotalFromText(text);
}
