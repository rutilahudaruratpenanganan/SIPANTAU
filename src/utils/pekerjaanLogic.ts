import type {
  JenisPelaksanaan,
  PaketPekerjaan,
  StatusTahapPekerjaan,
  TahapPekerjaan,
} from '../types/index.ts';

export const JENIS_PELAKSANAAN_LIST: JenisPelaksanaan[] = [
  'Perorangan',
  'Badan Usaha',
];

export const TEMPLATE_TAHAPAN_PEKERJAAN: Record<JenisPelaksanaan, string[]> = {
  Perorangan: [
    'Persiapan & SPK',
    'Laporan Pendahuluan',
    'Laporan Antara (Jika Ada)',
    'Laporan Akhir & BAST',
    'Laporan Pertanggungjawaban (Dokumen Pencairan)',
  ],
  'Badan Usaha': [
    'Rapat Persiapan/PCM',
    'Laporan Pendahuluan',
    'Laporan Antara (Jika Ada)',
    'Draf Laporan Akhir',
    'Laporan Akhir & BAST',
  ],
};

export function createTahapId(index: number): string {
  return `tahap-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`;
}

export function buildTemplateTahapan(jenis: JenisPelaksanaan): TahapPekerjaan[] {
  const names = TEMPLATE_TAHAPAN_PEKERJAAN[jenis] || TEMPLATE_TAHAPAN_PEKERJAAN.Perorangan;
  return names.map((nama, idx) => ({
    id: `tpl-${idx + 1}-${Math.random().toString(36).slice(2, 6)}`,
    urutan: idx + 1,
    nama,
    status: 'belum_mulai' as StatusTahapPekerjaan,
  }));
}

export function normalizeTahapanOrder(tahapan: TahapPekerjaan[]): TahapPekerjaan[] {
  return tahapan.map((t, idx) => ({
    ...t,
    urutan: idx + 1,
    nama: t.nama.trim(),
  }));
}

export function formatRupiah(amount: number): string {
  const safe = Number.isFinite(amount) && amount >= 0 ? Math.round(amount) : 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(safe);
}

export function parseRupiahInput(raw: string): number {
  const digits = (raw || '').replace(/[^\d]/g, '');
  if (!digits) return 0;
  const parsed = Number(digits);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.min(1_000_000_000_000, parsed);
}

export function getTodayLocalIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isoToUtcDays(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || '').trim());
  if (!m) return null;
  const dt = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Math.floor(dt / 86_400_000);
}

function utcDaysToIso(days: number): string {
  const d = new Date(days * 86_400_000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const MAX_DURASI_HARI_KERJA = 1825;

/**
 * Adds N calendar days (Senin-Minggu) to an ISO date string.
 * Returns '' if startIso is invalid or calendarDays < 1.
 */
export function addCalendarDaysIso(startIso: string, calendarDays: number): string {
  const startDays = isoToUtcDays(startIso);
  if (startDays === null || !Number.isFinite(calendarDays)) return '';
  const steps = Math.floor(calendarDays);
  if (steps < 1) return '';
  const clampedSteps = Math.min(MAX_DURASI_HARI_KERJA, steps);
  return utcDaysToIso(startDays + clampedSteps);
}

/**
 * Counts calendar days (Senin-Minggu) strictly after startIso up to and including endIso.
 */
export function countCalendarDaysBetweenIso(startIso: string, endIso: string): number {
  const startDays = isoToUtcDays(startIso);
  const endDays = isoToUtcDays(endIso);
  if (startDays === null || endDays === null || endDays <= startDays) {
    return 0;
  }
  return Math.min(MAX_DURASI_HARI_KERJA, endDays - startDays);
}

export const MIN_TAHUN_ANGGARAN = 2000;
export const MAX_TAHUN_ANGGARAN = 2100;

export function getPaketTahunAnggaran(
  paket: Pick<PaketPekerjaan, 'tahunAnggaran' | 'tanggalMulai'>
): number {
  if (
    typeof paket.tahunAnggaran === 'number' &&
    Number.isInteger(paket.tahunAnggaran) &&
    paket.tahunAnggaran >= MIN_TAHUN_ANGGARAN &&
    paket.tahunAnggaran <= MAX_TAHUN_ANGGARAN
  ) {
    return paket.tahunAnggaran;
  }
  const match = /^(\d{4})-/.exec((paket.tanggalMulai || '').trim());
  if (match) {
    const yr = Number(match[1]);
    if (yr >= MIN_TAHUN_ANGGARAN && yr <= MAX_TAHUN_ANGGARAN) {
      return yr;
    }
  }
  return new Date().getFullYear();
}

export function getAvailableTahunAnggaran(list: PaketPekerjaan[]): number[] {
  const years = new Set<number>();
  for (const item of list) {
    years.add(getPaketTahunAnggaran(item));
  }
  return Array.from(years).sort((a, b) => b - a);
}

export function getPaketDurasiHariKerja(
  paket: Pick<PaketPekerjaan, 'tanggalMulai' | 'tenggatWaktu' | 'durasiHariKerja'>
): number {
  if (
    typeof paket.durasiHariKerja === 'number' &&
    Number.isFinite(paket.durasiHariKerja) &&
    paket.durasiHariKerja >= 1
  ) {
    return Math.min(MAX_DURASI_HARI_KERJA, Math.round(paket.durasiHariKerja));
  }
  const derived = countCalendarDaysBetweenIso(paket.tanggalMulai, paket.tenggatWaktu);
  return derived >= 1 ? derived : 1;
}

export type PaketOverallStatus =
  | 'belum_mulai'
  | 'sedang_berjalan'
  | 'terlambat'
  | 'selesai';

export interface PaketProgressSummary {
  totalTahapan: number;
  selesaiCount: number;
  sedangCount: number;
  persentase: number;
  activeStage: TahapPekerjaan | null;
  overallStatus: PaketOverallStatus;
  overallStatusLabel: string;
  isOverdue: boolean;
  isNearDeadline: boolean;
  daysRemaining: number | null;
  deadlineLabel: string;
  durasiHariKerja: number;
}

export function computePaketProgress(
  paket: Pick<
    PaketPekerjaan,
    'tahapan' | 'tanggalMulai' | 'tenggatWaktu' | 'tanggalSelesai' | 'durasiHariKerja'
  >,
  todayIso: string
): PaketProgressSummary {
  const tahapan = Array.isArray(paket.tahapan) ? paket.tahapan : [];
  const totalTahapan = tahapan.length;
  const selesaiCount = tahapan.filter((t) => t.status === 'selesai').length;
  const sedangCount = tahapan.filter((t) => t.status === 'sedang_berjalan').length;
  const allStagesDone = totalTahapan > 0 && selesaiCount === totalTahapan;
  const isCompleted = Boolean(paket.tanggalSelesai?.trim()) || allStagesDone;

  const persentase = isCompleted
    ? 100
    : totalTahapan > 0
    ? Math.round(((selesaiCount + sedangCount * 0.5) / totalTahapan) * 100)
    : 0;

  const activeStage =
    tahapan.find((t) => t.status === 'sedang_berjalan') ||
    tahapan.find((t) => t.status === 'belum_mulai') ||
    (tahapan.length > 0 ? tahapan[tahapan.length - 1] : null);

  const todayDays = isoToUtcDays(todayIso);
  const tenggatDays = isoToUtcDays(paket.tenggatWaktu);
  const daysRemaining =
    todayDays !== null && tenggatDays !== null ? tenggatDays - todayDays : null;

  const isOverdue = !isCompleted && daysRemaining !== null && daysRemaining < 0;
  const isNearDeadline =
    !isCompleted && daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 7;

  let overallStatus: PaketOverallStatus = 'belum_mulai';
  if (isCompleted) {
    overallStatus = 'selesai';
  } else if (isOverdue) {
    overallStatus = 'terlambat';
  } else if (selesaiCount > 0 || sedangCount > 0) {
    overallStatus = 'sedang_berjalan';
  }

  const overallStatusLabel =
    overallStatus === 'selesai'
      ? 'Selesai'
      : overallStatus === 'terlambat'
      ? 'Terlambat'
      : overallStatus === 'sedang_berjalan'
      ? 'Sedang Berjalan'
      : 'Belum Mulai';

  let deadlineLabel = '-';
  if (isCompleted) {
    deadlineLabel = paket.tanggalSelesai
      ? `Selesai (${paket.tanggalSelesai})`
      : 'Seluruh Tahapan Selesai';
  } else if (daysRemaining !== null) {
    if (daysRemaining < 0) {
      deadlineLabel = `Lewat ${Math.abs(daysRemaining)} hari`;
    } else if (daysRemaining === 0) {
      deadlineLabel = 'Jatuh tempo hari ini';
    } else {
      deadlineLabel = `Sisa ${daysRemaining} hari`;
    }
  }

  const durasiHariKerja = getPaketDurasiHariKerja({
    tanggalMulai: paket.tanggalMulai,
    tenggatWaktu: paket.tenggatWaktu,
    durasiHariKerja: paket.durasiHariKerja,
  });

  return {
    totalTahapan,
    selesaiCount,
    sedangCount,
    persentase,
    activeStage,
    overallStatus,
    overallStatusLabel,
    isOverdue,
    isNearDeadline,
    daysRemaining,
    deadlineLabel,
    durasiHariKerja,
  };
}

export interface PaketValidationInput {
  namaKegiatan: string;
  subKegiatan: string;
  jenisPelaksanaan: JenisPelaksanaan;
  tahunAnggaran?: number;
  nilaiAnggaran: number;
  tanggalMulai: string;
  durasiHariKerja?: number;
  tenggatWaktu: string;
  tanggalSelesai?: string;
  tahapan: TahapPekerjaan[];
}

export function validatePaketPekerjaanInput(input: PaketValidationInput): string | null {
  if (!input.namaKegiatan.trim()) {
    return 'Nama Kegiatan wajib diisi.';
  }
  if (!input.subKegiatan.trim()) {
    return 'Sub Kegiatan wajib diisi.';
  }
  if (!JENIS_PELAKSANAAN_LIST.includes(input.jenisPelaksanaan)) {
    return 'Jenis Pelaksanaan tidak valid.';
  }
  if (input.tahunAnggaran !== undefined) {
    if (
      !Number.isFinite(input.tahunAnggaran) ||
      !Number.isInteger(input.tahunAnggaran) ||
      input.tahunAnggaran < MIN_TAHUN_ANGGARAN ||
      input.tahunAnggaran > MAX_TAHUN_ANGGARAN
    ) {
      return `Tahun Anggaran harus berupa tahun valid (${MIN_TAHUN_ANGGARAN}–${MAX_TAHUN_ANGGARAN}).`;
    }
  }
  if (!Number.isFinite(input.nilaiAnggaran) || input.nilaiAnggaran < 0) {
    return 'Nilai Anggaran/Kontrak harus berupa angka bernilai 0 atau lebih.';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test((input.tanggalMulai || '').trim())) {
    return 'Tanggal Mulai wajib diisi dengan format tanggal yang valid.';
  }
  if (input.durasiHariKerja !== undefined) {
    if (
      !Number.isFinite(input.durasiHariKerja) ||
      !Number.isInteger(input.durasiHariKerja) ||
      input.durasiHariKerja < 1
    ) {
      return 'Durasi pelaksanaan wajib diisi minimal 1 hari kalender.';
    }
    if (input.durasiHariKerja > MAX_DURASI_HARI_KERJA) {
      return `Durasi pelaksanaan maksimal ${MAX_DURASI_HARI_KERJA.toLocaleString('id-ID')} hari kalender.`;
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test((input.tenggatWaktu || '').trim())) {
    return 'Tanggal Selesai otomatis belum valid. Periksa Tanggal Mulai dan Durasi hari kalender.';
  }
  if (input.tenggatWaktu.trim() < input.tanggalMulai.trim()) {
    return 'Tanggal Selesai tidak boleh lebih awal daripada Tanggal Mulai.';
  }
  if (input.tanggalSelesai && input.tanggalSelesai.trim() !== '') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.tanggalSelesai.trim())) {
      return 'Format Tanggal Selesai tidak valid.';
    }
    if (input.tanggalSelesai.trim() < input.tanggalMulai.trim()) {
      return 'Tanggal Selesai tidak boleh lebih awal daripada Tanggal Mulai.';
    }
  }
  if (!Array.isArray(input.tahapan) || input.tahapan.length === 0) {
    return 'Minimal harus terdapat 1 tahapan dalam alur kerja paket pekerjaan.';
  }
  if (input.tahapan.length > 30) {
    return 'Maksimal jumlah tahapan adalah 30 tahap per paket pekerjaan.';
  }
  if (input.tahapan.some((t) => !t.nama || !t.nama.trim())) {
    return 'Setiap tahapan wajib memiliki nama tahapan yang tidak kosong.';
  }
  return null;
}

export interface PekerjaanFilterOptions {
  searchQuery?: string;
  jenisPelaksanaan?: JenisPelaksanaan | 'all';
  status?: PaketOverallStatus | 'all';
  tahunAnggaran?: number | 'all';
}

export function filterPaketPekerjaan(
  list: PaketPekerjaan[],
  filters: PekerjaanFilterOptions,
  todayIso: string
): PaketPekerjaan[] {
  return list.filter((item) => {
    if (
      filters.tahunAnggaran !== undefined &&
      filters.tahunAnggaran !== 'all' &&
      getPaketTahunAnggaran(item) !== filters.tahunAnggaran
    ) {
      return false;
    }

    if (
      filters.jenisPelaksanaan &&
      filters.jenisPelaksanaan !== 'all' &&
      item.jenisPelaksanaan !== filters.jenisPelaksanaan
    ) {
      return false;
    }

    if (filters.status && filters.status !== 'all') {
      const progress = computePaketProgress(item, todayIso);
      if (progress.overallStatus !== filters.status) {
        return false;
      }
    }

    if (filters.searchQuery && filters.searchQuery.trim() !== '') {
      const q = filters.searchQuery.toLowerCase().trim();
      const matchKegiatan = item.namaKegiatan.toLowerCase().includes(q);
      const matchSub = item.subKegiatan.toLowerCase().includes(q);
      const matchPenyedia = (item.penyedia || '').toLowerCase().includes(q);
      const matchKodeRup = (item.kodeRup || '').toLowerCase().includes(q);
      const matchKontrak = (item.nomorKontrak || '').toLowerCase().includes(q);
      const matchPic = (item.picNama || '').toLowerCase().includes(q);
      const matchTahun = String(getPaketTahunAnggaran(item)).includes(q);
      const matchTahap = item.tahapan.some((t) => t.nama.toLowerCase().includes(q));
      if (!matchKegiatan && !matchSub && !matchPenyedia && !matchKodeRup && !matchKontrak && !matchPic && !matchTahun && !matchTahap) {
        return false;
      }
    }

    return true;
  });
}

export interface PekerjaanDashboardStats {
  totalPaket: number;
  totalAnggaran: number;
  anggaranSelesai: number;
  belumMulai: number;
  sedangBerjalan: number;
  terlambat: number;
  mendekatiTenggat: number;
  selesai: number;
  rataRataProgres: number;
}

export function calculatePekerjaanStats(
  list: PaketPekerjaan[],
  todayIso: string
): PekerjaanDashboardStats {
  const stats: PekerjaanDashboardStats = {
    totalPaket: list.length,
    totalAnggaran: 0,
    anggaranSelesai: 0,
    belumMulai: 0,
    sedangBerjalan: 0,
    terlambat: 0,
    mendekatiTenggat: 0,
    selesai: 0,
    rataRataProgres: 0,
  };

  if (list.length === 0) return stats;

  let totalPct = 0;
  for (const item of list) {
    const val = Number.isFinite(item.nilaiAnggaran) ? item.nilaiAnggaran : 0;
    stats.totalAnggaran += val;
    const progress = computePaketProgress(item, todayIso);
    totalPct += progress.persentase;

    if (progress.overallStatus === 'selesai') {
      stats.selesai += 1;
      stats.anggaranSelesai += val;
    } else if (progress.overallStatus === 'terlambat') {
      stats.terlambat += 1;
    } else if (progress.overallStatus === 'sedang_berjalan') {
      stats.sedangBerjalan += 1;
    } else {
      stats.belumMulai += 1;
    }

    if (progress.isNearDeadline) {
      stats.mendekatiTenggat += 1;
    }
  }

  stats.rataRataProgres = Math.round(totalPct / list.length);
  return stats;
}

export interface TahunAnggaranSummary extends PekerjaanDashboardStats {
  tahunAnggaran: number;
  persentaseRealisasiAnggaran: number;
}

export function summarizePaketByTahunAnggaran(
  list: PaketPekerjaan[],
  todayIso: string
): TahunAnggaranSummary[] {
  const byYear = new Map<number, PaketPekerjaan[]>();
  for (const item of list) {
    const year = getPaketTahunAnggaran(item);
    const bucket = byYear.get(year) || [];
    bucket.push(item);
    byYear.set(year, bucket);
  }

  return Array.from(byYear.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([tahunAnggaran, items]) => {
      const st = calculatePekerjaanStats(items, todayIso);
      const persentaseRealisasiAnggaran =
        st.totalAnggaran > 0
          ? Math.round((st.anggaranSelesai / st.totalAnggaran) * 100)
          : 0;
      return {
        tahunAnggaran,
        ...st,
        persentaseRealisasiAnggaran,
      };
    });
}

export interface JenisPelaksanaanSummary {
  jenisPelaksanaan: JenisPelaksanaan;
  totalPaket: number;
  selesai: number;
  totalAnggaran: number;
  anggaranSelesai: number;
}

export function summarizePaketByJenis(
  list: PaketPekerjaan[],
  todayIso: string
): JenisPelaksanaanSummary[] {
  return JENIS_PELAKSANAAN_LIST.map((jenis) => {
    const subset = list.filter((p) => p.jenisPelaksanaan === jenis);
    const st = calculatePekerjaanStats(subset, todayIso);
    return {
      jenisPelaksanaan: jenis,
      totalPaket: st.totalPaket,
      selesai: st.selesai,
      totalAnggaran: st.totalAnggaran,
      anggaranSelesai: st.anggaranSelesai,
    };
  });
}

export function buildPekerjaanCsvContent(
  list: PaketPekerjaan[],
  todayIso: string
): string {
  const escapeCsv = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;

  const headers = [
    'No',
    'Tahun Anggaran',
    'Nama Kegiatan',
    'Sub Kegiatan',
    'Jenis Pelaksanaan',
    'Kode RUP',
    'Nomor Kontrak / SPK',
    'Penyedia / Pelaksana',
    'PIC / Penanggung Jawab',
    'Nilai Anggaran / Kontrak (Rp)',
    'Tanggal Mulai',
    'Durasi (Hari Kalender)',
    'Tanggal Selesai',
    'Tanggal Tuntas Aktual',
    'Status Paket',
    'Progres (%)',
    'Tahap Aktif Saat Ini',
    'Rincian Seluruh Tahapan',
  ];

  const rows = list.map((item, idx) => {
    const progress = computePaketProgress(item, todayIso);
    const tahunAnggaran = getPaketTahunAnggaran(item);
    const tahapanDetail = item.tahapan
      .map(
        (t) =>
          `${t.urutan}. ${t.nama} [${
            t.status === 'selesai'
              ? 'Selesai'
              : t.status === 'sedang_berjalan'
              ? 'Sedang Berjalan'
              : 'Belum Mulai'
          }${t.tanggalSelesai ? ` · ${t.tanggalSelesai}` : ''}]`
      )
      .join(' | ');

    return [
      String(idx + 1),
      String(tahunAnggaran),
      escapeCsv(item.namaKegiatan),
      escapeCsv(item.subKegiatan),
      escapeCsv(item.jenisPelaksanaan),
      escapeCsv(item.kodeRup || ''),
      escapeCsv(item.nomorKontrak || ''),
      escapeCsv(item.penyedia || ''),
      escapeCsv(item.picNama || ''),
      String(item.nilaiAnggaran || 0),
      item.tanggalMulai || '',
      String(progress.durasiHariKerja),
      item.tenggatWaktu || '',
      item.tanggalSelesai || '',
      escapeCsv(progress.overallStatusLabel),
      `${progress.persentase}%`,
      escapeCsv(progress.activeStage?.nama || '-'),
      escapeCsv(tahapanDetail),
    ].join(',');
  });

  return '\uFEFF' + [headers.join(','), ...rows].join('\n');
}
