import type { RiwayatTindakLanjut, SuratMasuk } from '../types/index.ts';
import { TAHAP_TINDAK_LANJUT, normalizeRiwayatCatatan } from './disposisiLogic.ts';

export type RekapStatusFilter = 'all' | 'selesai' | 'aktif';
export type RekapDateBasis = 'tanggalSurat' | 'tanggalDiterima' | 'tanggalDisposisi';

export interface RekapFilterOptions {
  status: RekapStatusFilter;
  dateFrom?: string;
  dateTo?: string;
  dateBasis?: RekapDateBasis;
}

function extractIsoDate(value?: string): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  return '';
}

export function filterRekapSurat(
  list: SuratMasuk[],
  options: RekapFilterOptions
): SuratMasuk[] {
  const { status, dateFrom, dateTo, dateBasis = 'tanggalSurat' } = options;
  const normalizedFrom = extractIsoDate(dateFrom);
  const normalizedTo = extractIsoDate(dateTo);

  return list.filter((item) => {
    if (status === 'selesai' && !item.statusSelesai) {
      return false;
    }
    if (status === 'aktif' && item.statusSelesai) {
      return false;
    }

    if (normalizedFrom || normalizedTo) {
      const targetDate = extractIsoDate(item[dateBasis]);
      if (!targetDate) return false;
      if (normalizedFrom && targetDate < normalizedFrom) return false;
      if (normalizedTo && targetDate > normalizedTo) return false;
    }

    return true;
  });
}

export function getRekapStatusLabel(status: RekapStatusFilter): string {
  if (status === 'selesai') return 'Selesai Tindak Lanjut';
  if (status === 'aktif') return 'Dalam Proses';
  return 'Semua Status (Selesai & Dalam Proses)';
}

export function getRekapDateBasisLabel(basis: RekapDateBasis): string {
  if (basis === 'tanggalDiterima') return 'Tanggal Diterima';
  if (basis === 'tanggalDisposisi') return 'Tanggal Disposisi';
  return 'Tanggal Surat';
}

function formatTanggalIndonesiaShort(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const [y, m, d] = isoDate.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  return dateObj.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatRekapPeriodeLabel(dateFrom?: string, dateTo?: string): string {
  const from = extractIsoDate(dateFrom);
  const to = extractIsoDate(dateTo);

  if (from && to) {
    return `${formatTanggalIndonesiaShort(from)} s.d. ${formatTanggalIndonesiaShort(to)}`;
  }
  if (from) {
    return `Mulai ${formatTanggalIndonesiaShort(from)}`;
  }
  if (to) {
    return `Sampai dengan ${formatTanggalIndonesiaShort(to)}`;
  }
  return 'Semua Periode Tanggal';
}

export function formatHistorySummaryText(riwayat: RiwayatTindakLanjut[]): string {
  if (!riwayat || riwayat.length === 0) return '-';
  return riwayat
    .map((h, i) => {
      const catatan = normalizeRiwayatCatatan(h.catatan || '');
      const lampiran = h.fileLampiran?.nama ? ` [Lampiran: ${h.fileLampiran.nama}]` : '';
      return `${i + 1}. [${h.tanggal || '-'}] Tahap ${h.tahapId} (${h.tahapNama}) - ${h.aktor}: ${catatan}${lampiran}`;
    })
    .join(' | ');
}

export function buildRekapCsvContent(
  list: SuratMasuk[],
  includeHistory = true
): string {
  const headers = [
    'No',
    'Nomor Surat Masuk',
    'Tanggal Surat',
    'Tanggal Diterima',
    'Asal Surat',
    'Perihal',
    'Sifat',
    'Tanggal Disposisi',
    'Tenggat Waktu',
    'Penerima Disposisi',
    'Instruksi Disposisi',
    'Tahap Saat Ini',
    'Nama Tahap',
    'Status Tindak Lanjut',
    'Tanggal Selesai',
    'Nomor Surat Keluar',
    'Tanggal Surat Keluar',
  ];
  if (includeHistory) {
    headers.push('Riwayat Tindak Lanjut Lengkap');
  }

  const escapeCsv = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;

  const rows = list.map((s, idx) => {
    const baseCols = [
      String(idx + 1),
      escapeCsv(s.nomorSurat || ''),
      s.tanggalSurat || '',
      s.tanggalDiterima || '',
      escapeCsv(s.asalSurat || ''),
      escapeCsv(s.perihal || ''),
      s.sifat || '',
      s.tanggalDisposisi || '',
      s.tenggatWaktu || '',
      escapeCsv((s.penerimaDisposisiNama || []).join(', ')),
      escapeCsv(s.instruksiDisposisi || ''),
      String(s.tahapSaatIni),
      escapeCsv(TAHAP_TINDAK_LANJUT[s.tahapSaatIni]?.nama || ''),
      s.statusSelesai ? 'Selesai Tindak Lanjut' : 'Dalam Proses',
      s.tanggalSelesai || '',
      escapeCsv(s.nomorSuratKeluar || ''),
      s.tanggalSuratKeluar || '',
    ];

    if (includeHistory) {
      baseCols.push(escapeCsv(formatHistorySummaryText(s.riwayatTindakLanjut || [])));
    }

    return baseCols.join(',');
  });

  return '\uFEFF' + [headers.join(','), ...rows].join('\n');
}
