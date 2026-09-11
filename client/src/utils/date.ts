import dayjs from 'dayjs';

// ISO timestamp dari API dikonversi ke timezone lokal sebelum tanggal ditampilkan.
export function toInputDate(value?: string | null) {
  return value ? dayjs(value).format('YYYY-MM-DD') : '';
}

export function formatTanggal(value?: string | null) {
  return value ? dayjs(value).format('DD/MM/YYYY') : '-';
}

export function formatNominal(value: string | number) {
  const digits = String(value).replace(/\D/g, '');
  return digits ? new Intl.NumberFormat('id-ID').format(Number(digits)) : '';
}

export function parseNominal(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}