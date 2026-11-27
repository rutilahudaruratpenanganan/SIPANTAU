import type {
  JenisPelaksanaan,
  MekanismePencairan,
  PaketPekerjaan,
  RekeningAnggaran,
  SkemaKontrak,
  SkemaPembayaran,
  StatusPencairan,
  StatusTahapPekerjaan,
  TahapPekerjaan,
  TerminPekerjaan,
} from '../types/index.ts';

export const JENIS_PELAKSANAAN_LIST: JenisPelaksanaan[] = [
  'Perorangan',
  'Badan Usaha',
];

export const SKEMA_KONTRAK_LIST: SkemaKontrak[] = [
  'Lump Sum',
  'Waktu Penugasan',
  'Pengadaan Langsung',
  'Katalog',
];

export const SKEMA_PEMBAYARAN_LIST: SkemaPembayaran[] = [
  'Sekaligus',
  'Termin',
];

export const MAX_TERMIN_PEKERJAAN = 20;

export const STATUS_PENCAIRAN_LIST: StatusPencairan[] = [
  'Belum',
  'Sudah',
];

export const MEKANISME_PENCAIRAN_LIST: MekanismePencairan[] = [
  'Langsung (LS)',
  'Ganti Uang Persediaan (GU)',
  'Tambahan Uang Persediaan (TU)',
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

export function createTerminId(index: number): string {
  return `termin-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`;
}

export function buildDefaultTerminPencairan(): TerminPekerjaan[] {
  return [
    {
      id: createTerminId(1),
      urutan: 1,
      nama: 'Termin 1',
      persentase: 50,
      status: 'Belum',
    },
    {
      id: createTerminId(2),
      urutan: 2,
      nama: 'Termin 2 (Pelunasan)',
      persentase: 50,
      status: 'Belum',
    },
  ];
}

export function normalizeTerminOrder(termins: TerminPekerjaan[]): TerminPekerjaan[] {
  return termins.slice(0, MAX_TERMIN_PEKERJAAN).map((t, idx) => ({
    ...t,
    id: (t.id || '').trim() || createTerminId(idx + 1),
    urutan: idx + 1,
    nama: (t.nama || '').trim() || `Termin ${idx + 1}`,
    status: t.status === 'Sudah' ? 'Sudah' : 'Belum',
  }));
}

export function resolveStatusPencairanFromTermin(
  skemaPembayaran?: SkemaPembayaran,
  currentStatus?: StatusPencairan,
  termins?: TerminPekerjaan[]
): StatusPencairan {
  if (skemaPembayaran === 'Termin' && Array.isArray(termins) && termins.length > 0) {
    return termins.every((t) => t.status === 'Sudah') ? 'Sudah' : 'Belum';
  }
  return currentStatus === 'Sudah' ? 'Sudah' : 'Belum';
}

export interface TerminPencairanSummary {
  skemaPembayaran: SkemaPembayaran;
  totalTermin: number;
  sudahCount: number;
  belumCount: number;
  isAllSudah: boolean;
  isPartial: boolean;
  totalPersenCair: number;
  totalNilaiCair: number;
  hasNominalCair: boolean;
  summaryLabel: string;
  compactLabel: string;
}

export function resolveTerminNominal(
  termin: Pick<TerminPekerjaan, 'nilaiRupiah' | 'persentase'>,
  nilaiKontrak?: number
): number | undefined {
  if (typeof termin.nilaiRupiah === 'number' && Number.isFinite(termin.nilaiRupiah)) {
    return Math.max(0, Math.round(termin.nilaiRupiah));
  }
  if (
    typeof termin.persentase === 'number' &&
    Number.isFinite(termin.persentase) &&
    typeof nilaiKontrak === 'number' &&
    Number.isFinite(nilaiKontrak) &&
    nilaiKontrak >= 0
  ) {
    return Math.round((termin.persentase / 100) * nilaiKontrak);
  }
  return undefined;
}

export function summarizeTerminPencairan(
  paket: Pick<
    PaketPekerjaan,
    'skemaPembayaran' | 'statusPencairan' | 'terminPencairan' | 'nilaiKontrak'
  >
): TerminPencairanSummary {
  const termins = Array.isArray(paket.terminPencairan) ? paket.terminPencairan : [];
  const skema: SkemaPembayaran =
    paket.skemaPembayaran === 'Termin' || (paket.skemaPembayaran === undefined && termins.length > 0)
      ? 'Termin'
      : 'Sekaligus';

  if (skema === 'Sekaligus' || termins.length === 0) {
    const isSudah = paket.statusPencairan === 'Sudah';
    const hasKontrak =
      typeof paket.nilaiKontrak === 'number' && Number.isFinite(paket.nilaiKontrak);
    const totalNilaiCair = isSudah && hasKontrak ? Math.max(0, Math.round(paket.nilaiKontrak!)) : 0;
    return {
      skemaPembayaran: 'Sekaligus',
      totalTermin: 0,
      sudahCount: isSudah ? 1 : 0,
      belumCount: isSudah ? 0 : 1,
      isAllSudah: isSudah,
      isPartial: false,
      totalPersenCair: isSudah ? 100 : 0,
      totalNilaiCair,
      hasNominalCair: isSudah && hasKontrak,
      summaryLabel: isSudah ? 'Sudah (Sekaligus)' : 'Belum (Sekaligus)',
      compactLabel: isSudah ? 'Sudah' : 'Belum',
    };
  }

  let sudahCount = 0;
  let totalPersenCair = 0;
  let totalNilaiCair = 0;
  let hasNominalCair = false;
  for (const t of termins) {
    if (t.status === 'Sudah') {
      sudahCount += 1;
      if (typeof t.persentase === 'number' && Number.isFinite(t.persentase)) {
        totalPersenCair += t.persentase;
      }
      const nominal = resolveTerminNominal(t, paket.nilaiKontrak);
      if (nominal !== undefined) {
        totalNilaiCair += nominal;
        hasNominalCair = true;
      }
    }
  }
  const totalTermin = termins.length;
  const belumCount = totalTermin - sudahCount;
  const isAllSudah = sudahCount === totalTermin;
  const isPartial = sudahCount > 0 && sudahCount < totalTermin;

  const summaryLabel = isAllSudah
    ? `Sudah (${sudahCount}/${totalTermin} Termin)`
    : isPartial
    ? `Sebagian (${sudahCount}/${totalTermin} Termin)`
    : `Belum (0/${totalTermin} Termin)`;

  return {
    skemaPembayaran: 'Termin',
    totalTermin,
    sudahCount,
    belumCount,
    isAllSudah,
    isPartial,
    totalPersenCair: Math.min(100, Math.round(totalPersenCair)),
    totalNilaiCair,
    hasNominalCair,
    summaryLabel,
    compactLabel: `${sudahCount}/${totalTermin} Termin Cair`,
  };
}

export function resolvePaketTanggalPencairan(
  paket: Pick<
    PaketPekerjaan,
    'skemaPembayaran' | 'statusPencairan' | 'tanggalPencairan' | 'terminPencairan'
  >
): string | undefined {
  const termins = Array.isArray(paket.terminPencairan) ? paket.terminPencairan : [];
  const skema: SkemaPembayaran =
    paket.skemaPembayaran === 'Termin' || (paket.skemaPembayaran === undefined && termins.length > 0)
      ? 'Termin'
      : 'Sekaligus';

  if (skema === 'Termin' && termins.length > 0) {
    const dates = termins
      .filter((tr) => tr.status === 'Sudah' && (tr.tanggalCair || '').trim() !== '')
      .map((tr) => (tr.tanggalCair || '').trim())
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort();
    return dates.length > 0 ? dates[dates.length - 1] : undefined;
  }

  const raw = (paket.tanggalPencairan || '').trim();
  return raw || undefined;
}

export function normalizeTahapanOrder(tahapan: TahapPekerjaan[]): TahapPekerjaan[] {
  return tahapan.map((t, idx) => ({
    ...t,
    urutan: idx + 1,
    nama: t.nama.trim(),
  }));
}

export function resolvePaketTanggalSelesai(
  tahapan: TahapPekerjaan[],
  currentTanggalSelesai?: string,
  todayIso: string = getTodayLocalIso()
): string | undefined {
  const allDone = tahapan.length > 0 && tahapan.every((t) => t.status === 'selesai');
  if (!allDone) {
    return undefined;
  }
  const existing = (currentTanggalSelesai || '').trim();
  if (existing) {
    return existing;
  }
  const stageDates = tahapan
    .map((t) => (t.tanggalSelesai || '').trim())
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
  return stageDates[stageDates.length - 1] || todayIso;
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

const BULAN_INDONESIA = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

/**
 * Formats YYYY-MM-DD into readable Indonesian date format (e.g., "1 Januari 2000").
 */
export function formatTanggalDisplay(iso?: string): string {
  const raw = (iso || '').trim();
  if (!raw) return '-';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return raw;
  const year = Number(m[1]);
  const monthIdx = Number(m[2]) - 1;
  const day = Number(m[3]);
  if (monthIdx < 0 || monthIdx > 11 || day < 1 || day > 31) return raw;
  return `${day} ${BULAN_INDONESIA[monthIdx]} ${year}`;
}

/**
 * Formats YYYY-MM-DD into numeric DD-MM-YYYY format (e.g., "01-01-2000").
 */
export function formatTanggalDdMmYyyy(iso?: string): string {
  const raw = (iso || '').trim();
  if (!raw) return '-';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return raw;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export const MAX_DURASI_HARI_KERJA = 1825;

/**
 * Calculates end date with Tanggal Mulai counted as Day 1 (Hari ke-1):
 * e.g. 2026-08-19 + 93 calendar days = 2026-11-19 (startDays + steps - 1).
 * Returns '' if startIso is invalid or calendarDays < 1.
 */
export function addCalendarDaysIso(startIso: string, calendarDays: number): string {
  const startDays = isoToUtcDays(startIso);
  if (startDays === null || !Number.isFinite(calendarDays)) return '';
  const steps = Math.floor(calendarDays);
  if (steps < 1) return '';
  const clampedSteps = Math.min(MAX_DURASI_HARI_KERJA, steps);
  return utcDaysToIso(startDays + clampedSteps - 1);
}

/**
 * Counts inclusive calendar days from startIso (Day 1) up to and including endIso.
 */
export function countCalendarDaysBetweenIso(startIso: string, endIso: string): number {
  const startDays = isoToUtcDays(startIso);
  const endDays = isoToUtcDays(endIso);
  if (startDays === null || endDays === null || endDays < startDays) {
    return 0;
  }
  return Math.min(MAX_DURASI_HARI_KERJA, endDays - startDays + 1);
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

export function getAvailableTahunAnggaran(
  list: PaketPekerjaan[],
  rekeningList: RekeningAnggaran[] = []
): number[] {
  const years = new Set<number>();
  for (const item of list) {
    years.add(getPaketTahunAnggaran(item));
  }
  for (const rek of rekeningList) {
    if (
      typeof rek.tahunAnggaran === 'number' &&
      Number.isInteger(rek.tahunAnggaran) &&
      rek.tahunAnggaran >= MIN_TAHUN_ANGGARAN &&
      rek.tahunAnggaran <= MAX_TAHUN_ANGGARAN
    ) {
      years.add(rek.tahunAnggaran);
    }
  }
  return Array.from(years).sort((a, b) => b - a);
}

export function getAvailablePicNames(list: PaketPekerjaan[]): string[] {
  const names = new Set<string>();
  for (const item of list) {
    const pic = (item.picNama || '').trim();
    if (pic) names.add(pic);
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b, 'id-ID'));
}

export function normalizeKodeRekening(raw?: string): string {
  return (raw || '').trim().replace(/\s+/g, '').toUpperCase();
}

export function buildRekeningUniqueKey(tahunAnggaran: number, kodeRekening: string): string {
  return `${tahunAnggaran}::${normalizeKodeRekening(kodeRekening)}`;
}

export interface RekeningValidationInput {
  kodeRekening: string;
  uraian: string;
  tahunAnggaran: number;
  paguAnggaran: number;
}

export function validateRekeningAnggaranInput(
  input: RekeningValidationInput,
  existingList: RekeningAnggaran[],
  editingId?: string
): string | null {
  const cleanedKode = (input.kodeRekening || '').trim();
  if (!cleanedKode) {
    return 'Kode Rekening wajib diisi (contoh: 5.1.02.02.01.0029).';
  }
  if (cleanedKode.length > 100) {
    return 'Kode Rekening maksimal 100 karakter.';
  }
  if (!/^[a-zA-Z0-9._\-\/\s]+$/.test(cleanedKode)) {
    return 'Kode Rekening hanya boleh berisi angka, huruf, titik, garis miring, atau tanda hubung.';
  }
  if (!(input.uraian || '').trim()) {
    return 'Uraian / Nama Rekening Belanja wajib diisi.';
  }
  if (input.uraian.trim().length > 300) {
    return 'Uraian Rekening maksimal 300 karakter.';
  }
  if (
    !Number.isFinite(input.tahunAnggaran) ||
    !Number.isInteger(input.tahunAnggaran) ||
    input.tahunAnggaran < MIN_TAHUN_ANGGARAN ||
    input.tahunAnggaran > MAX_TAHUN_ANGGARAN
  ) {
    return `Tahun Anggaran harus berupa tahun valid (${MIN_TAHUN_ANGGARAN}–${MAX_TAHUN_ANGGARAN}).`;
  }
  if (!Number.isFinite(input.paguAnggaran) || input.paguAnggaran < 0 || input.paguAnggaran > 1_000_000_000_000) {
    return 'Pagu Anggaran Rekening harus berupa angka bernilai 0 atau lebih.';
  }

  const targetKey = buildRekeningUniqueKey(input.tahunAnggaran, cleanedKode);
  const duplicate = existingList.find(
    (r) => r.id !== editingId && buildRekeningUniqueKey(r.tahunAnggaran, r.kodeRekening) === targetKey
  );
  if (duplicate) {
    return `Kode Rekening "${cleanedKode}" untuk TA ${input.tahunAnggaran} sudah terdaftar (${duplicate.uraian}). 1 Kode Rekening hanya memiliki 1 Pagu Anggaran.`;
  }

  return null;
}

export interface ResolvedPaketPaguInfo {
  rekening: RekeningAnggaran | null;
  dedupeKey: string;
  kodeRekening: string;
  namaRekening: string;
  paguAnggaran: number;
  hasRekening: boolean;
}

export function resolvePaketPaguInfo(
  paket: Pick<
    PaketPekerjaan,
    'id' | 'rekeningId' | 'kodeRekening' | 'namaRekening' | 'nilaiAnggaran' | 'tahunAnggaran' | 'tanggalMulai'
  >,
  rekeningList: RekeningAnggaran[] = []
): ResolvedPaketPaguInfo {
  const byId = paket.rekeningId
    ? rekeningList.find((r) => r.id === paket.rekeningId) || null
    : null;
  const tahun = getPaketTahunAnggaran(paket);
  const normalizedKode = normalizeKodeRekening(paket.kodeRekening);
  const byKode =
    !byId && normalizedKode
      ? rekeningList.find(
          (r) => buildRekeningUniqueKey(r.tahunAnggaran, r.kodeRekening) === `${tahun}::${normalizedKode}`
        ) || null
      : null;

  const matched = byId || byKode;
  if (matched) {
    return {
      rekening: matched,
      dedupeKey: `rek:${matched.id}`,
      kodeRekening: matched.kodeRekening,
      namaRekening: matched.uraian,
      paguAnggaran: Number.isFinite(matched.paguAnggaran) ? matched.paguAnggaran : 0,
      hasRekening: true,
    };
  }

  if (paket.rekeningId) {
    return {
      rekening: null,
      dedupeKey: `rek:${paket.rekeningId}`,
      kodeRekening: (paket.kodeRekening || '').trim(),
      namaRekening: (paket.namaRekening || '').trim(),
      paguAnggaran: Number.isFinite(paket.nilaiAnggaran) ? paket.nilaiAnggaran : 0,
      hasRekening: true,
    };
  }

  if (normalizedKode) {
    return {
      rekening: null,
      dedupeKey: `kode:${tahun}::${normalizedKode}`,
      kodeRekening: (paket.kodeRekening || '').trim(),
      namaRekening: (paket.namaRekening || '').trim(),
      paguAnggaran: Number.isFinite(paket.nilaiAnggaran) ? paket.nilaiAnggaran : 0,
      hasRekening: true,
    };
  }

  return {
    rekening: null,
    dedupeKey: `paket:${paket.id}`,
    kodeRekening: '',
    namaRekening: '',
    paguAnggaran: Number.isFinite(paket.nilaiAnggaran) ? paket.nilaiAnggaran : 0,
    hasRekening: false,
  };
}

export interface RekeningAnggaranSummary {
  rekening: RekeningAnggaran;
  jumlahPaket: number;
  paketSelesai: number;
  totalNilaiKontrak: number;
  sisaPagu: number;
  serapanPersen: number;
  isOverBudget: boolean;
}

export function summarizeRekeningAnggaran(
  rekeningList: RekeningAnggaran[],
  paketList: PaketPekerjaan[],
  todayIso: string = getTodayLocalIso()
): RekeningAnggaranSummary[] {
  const grouped = new Map<string, PaketPekerjaan[]>();
  for (const paket of paketList) {
    const info = resolvePaketPaguInfo(paket, rekeningList);
    if (info.rekening) {
      const bucket = grouped.get(info.rekening.id) || [];
      bucket.push(paket);
      grouped.set(info.rekening.id, bucket);
    }
  }

  return [...rekeningList]
    .sort((a, b) => {
      if (b.tahunAnggaran !== a.tahunAnggaran) return b.tahunAnggaran - a.tahunAnggaran;
      return a.kodeRekening.localeCompare(b.kodeRekening, 'id-ID');
    })
    .map((rekening) => {
      const linked = grouped.get(rekening.id) || [];
      let totalNilaiKontrak = 0;
      let paketSelesai = 0;
      for (const p of linked) {
        if (typeof p.nilaiKontrak === 'number' && Number.isFinite(p.nilaiKontrak)) {
          totalNilaiKontrak += p.nilaiKontrak;
        }
        if (computePaketProgress(p, todayIso).overallStatus === 'selesai') {
          paketSelesai += 1;
        }
      }
      const pagu = Number.isFinite(rekening.paguAnggaran) ? rekening.paguAnggaran : 0;
      const sisaPagu = pagu - totalNilaiKontrak;
      const serapanPersen = pagu > 0 ? Math.round((totalNilaiKontrak / pagu) * 100) : 0;
      return {
        rekening,
        jumlahPaket: linked.length,
        paketSelesai,
        totalNilaiKontrak,
        sisaPagu,
        serapanPersen,
        isOverBudget: totalNilaiKontrak > pagu,
      };
    });
}

export function filterRekeningByTahun(
  rekeningList: RekeningAnggaran[],
  tahunAnggaran?: number | 'all'
): RekeningAnggaran[] {
  const filtered =
    typeof tahunAnggaran === 'number' && Number.isInteger(tahunAnggaran)
      ? rekeningList.filter((r) => r.tahunAnggaran === tahunAnggaran)
      : rekeningList;
  return [...filtered].sort((a, b) => {
    if (b.tahunAnggaran !== a.tahunAnggaran) return b.tahunAnggaran - a.tahunAnggaran;
    return a.kodeRekening.localeCompare(b.kodeRekening, 'id-ID');
  });
}

export interface RolloverRekeningCandidate {
  sourceRekeningId: string;
  kodeRekening: string;
  uraian: string;
  tahunAnggaran: number;
  paguAnggaran: number;
  sourcePaguAnggaran: number;
  catatan?: string;
  selected: boolean;
}

export interface RolloverRekeningPreview {
  candidates: RolloverRekeningCandidate[];
  skippedExistingCount: number;
  sourceCount: number;
}

/**
 * Menyiapkan daftar salinan Kode Rekening dari Tahun Anggaran sumber ke Tahun Anggaran tujuan
 * sesuai prinsip penganggaran tahunan DPA-SKPD (Permendagri 90/2019 & Permendagri 77/2020):
 * 1 kode rekening + 1 pagu anggaran bersifat unik per Tahun Anggaran.
 */
export function buildRolloverRekeningPreview(
  rekeningList: RekeningAnggaran[],
  sourceYear: number,
  targetYear: number,
  copyPaguNominal: boolean = true
): RolloverRekeningPreview {
  if (
    !Number.isInteger(sourceYear) ||
    !Number.isInteger(targetYear) ||
    sourceYear < MIN_TAHUN_ANGGARAN ||
    targetYear < MIN_TAHUN_ANGGARAN ||
    targetYear > MAX_TAHUN_ANGGARAN ||
    sourceYear === targetYear
  ) {
    return { candidates: [], skippedExistingCount: 0, sourceCount: 0 };
  }

  const sourceList = filterRekeningByTahun(rekeningList, sourceYear);
  const existingTargetKeys = new Set(
    filterRekeningByTahun(rekeningList, targetYear).map((r) =>
      buildRekeningUniqueKey(targetYear, r.kodeRekening)
    )
  );

  const candidates: RolloverRekeningCandidate[] = [];
  let skippedExistingCount = 0;

  for (const src of sourceList) {
    const targetKey = buildRekeningUniqueKey(targetYear, src.kodeRekening);
    if (existingTargetKeys.has(targetKey)) {
      skippedExistingCount += 1;
      continue;
    }
    existingTargetKeys.add(targetKey);
    const sourcePagu = Number.isFinite(src.paguAnggaran) ? src.paguAnggaran : 0;
    candidates.push({
      sourceRekeningId: src.id,
      kodeRekening: src.kodeRekening,
      uraian: src.uraian,
      tahunAnggaran: targetYear,
      paguAnggaran: copyPaguNominal ? sourcePagu : 0,
      sourcePaguAnggaran: sourcePagu,
      catatan: src.catatan,
      selected: true,
    });
  }

  return {
    candidates,
    skippedExistingCount,
    sourceCount: sourceList.length,
  };
}

export function getAvailableKodeRekeningOptions(
  paketList: PaketPekerjaan[],
  rekeningList: RekeningAnggaran[] = [],
  filterTahun?: number | 'all'
): Array<{
  key: string;
  kodeRekening: string;
  uraian: string;
  tahunAnggaran?: number;
  paguAnggaran?: number;
}> {
  const map = new Map<
    string,
    {
      key: string;
      kodeRekening: string;
      uraian: string;
      tahunAnggaran?: number;
      paguAnggaran?: number;
    }
  >();
  const scopedRekening =
    filterTahun !== undefined && filterTahun !== 'all'
      ? rekeningList.filter((r) => r.tahunAnggaran === filterTahun)
      : rekeningList;
  const scopedPaket =
    filterTahun !== undefined && filterTahun !== 'all'
      ? paketList.filter((p) => getPaketTahunAnggaran(p) === filterTahun)
      : paketList;

  for (const r of scopedRekening) {
    const norm = normalizeKodeRekening(r.kodeRekening);
    if (norm && !map.has(norm)) {
      map.set(norm, {
        key: norm,
        kodeRekening: r.kodeRekening,
        uraian: r.uraian,
        tahunAnggaran: r.tahunAnggaran,
        paguAnggaran: r.paguAnggaran,
      });
    }
  }
  for (const p of scopedPaket) {
    const norm = normalizeKodeRekening(p.kodeRekening);
    if (norm && !map.has(norm)) {
      map.set(norm, {
        key: norm,
        kodeRekening: (p.kodeRekening || '').trim(),
        uraian: (p.namaRekening || '').trim(),
        tahunAnggaran: getPaketTahunAnggaran(p),
      });
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.kodeRekening.localeCompare(b.kodeRekening, 'id-ID')
  );
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
      ? `Selesai (${formatTanggalDisplay(paket.tanggalSelesai)})`
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
  rekeningId?: string;
  matchedRekening?: RekeningAnggaran | null;
  requireRekening?: boolean;
  namaKegiatan: string;
  subKegiatan: string;
  jenisPelaksanaan: JenisPelaksanaan;
  skemaKontrak?: SkemaKontrak;
  tahunAnggaran?: number;
  nilaiAnggaran: number;
  hps?: number;
  nilaiKontrak?: number;
  tanggalMulai: string;
  durasiHariKerja?: number;
  tenggatWaktu: string;
  tanggalSelesai?: string;
  skemaPembayaran?: SkemaPembayaran;
  terminPencairan?: TerminPekerjaan[];
  statusPencairan?: StatusPencairan;
  tanggalPencairan?: string;
  mekanismePencairan?: MekanismePencairan;
  tahapan: TahapPekerjaan[];
}

export function validatePaketPekerjaanInput(input: PaketValidationInput): string | null {
  if (input.requireRekening && !(input.rekeningId || '').trim()) {
    return 'Kode Rekening wajib dipilih atau dibuat baru agar Pagu Anggaran sesuai dengan master Kode Rekening pada Tahun Anggaran tersebut.';
  }
  if (!input.namaKegiatan.trim()) {
    return 'Nama Kegiatan wajib diisi.';
  }
  if (!input.subKegiatan.trim()) {
    return 'Sub Kegiatan wajib diisi.';
  }
  if (!JENIS_PELAKSANAAN_LIST.includes(input.jenisPelaksanaan)) {
    return 'Jenis Pelaksanaan tidak valid.';
  }
  if (input.skemaKontrak !== undefined && !SKEMA_KONTRAK_LIST.includes(input.skemaKontrak)) {
    return 'Skema Kontrak tidak valid.';
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
    return 'Pagu Anggaran harus berupa angka bernilai 0 atau lebih.';
  }
  if (input.matchedRekening) {
    if (
      input.tahunAnggaran !== undefined &&
      input.tahunAnggaran !== input.matchedRekening.tahunAnggaran
    ) {
      return `Tahun Anggaran paket (${input.tahunAnggaran}) harus sama dengan Tahun Anggaran Kode Rekening (${input.matchedRekening.tahunAnggaran}).`;
    }
    if (Math.round(input.nilaiAnggaran) !== Math.round(input.matchedRekening.paguAnggaran)) {
      return 'Pagu Anggaran paket harus sesuai dengan Pagu Anggaran pada Kode Rekening terpilih.';
    }
  }
  if (
    input.hps !== undefined &&
    (!Number.isFinite(input.hps) || input.hps < 0)
  ) {
    return 'Nilai HPS harus berupa angka bernilai 0 atau lebih.';
  }
  if (
    input.nilaiKontrak !== undefined &&
    (!Number.isFinite(input.nilaiKontrak) || input.nilaiKontrak < 0)
  ) {
    return 'Nilai Kontrak / Realisasi harus berupa angka bernilai 0 atau lebih.';
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
  if (
    input.skemaPembayaran !== undefined &&
    !SKEMA_PEMBAYARAN_LIST.includes(input.skemaPembayaran)
  ) {
    return 'Skema Pembayaran Pencairan tidak valid.';
  }
  if (input.skemaPembayaran === 'Termin') {
    if (!Array.isArray(input.terminPencairan) || input.terminPencairan.length === 0) {
      return 'Minimal harus terdapat 1 termin pencairan untuk skema pembayaran Termin.';
    }
    if (input.terminPencairan.length > MAX_TERMIN_PEKERJAAN) {
      return `Maksimal jumlah termin pencairan adalah ${MAX_TERMIN_PEKERJAAN} termin.`;
    }
    for (const t of input.terminPencairan) {
      if (!t.nama || !t.nama.trim()) {
        return 'Setiap termin wajib memiliki nama termin (mis. Termin 1).';
      }
      if (!STATUS_PENCAIRAN_LIST.includes(t.status)) {
        return 'Status pencairan pada salah satu termin tidak valid.';
      }
      if (
        t.persentase !== undefined &&
        (!Number.isFinite(t.persentase) || t.persentase < 0 || t.persentase > 100)
      ) {
        return 'Persentase termin harus bernilai antara 0% sampai 100%.';
      }
      if (
        t.nilaiRupiah !== undefined &&
        (!Number.isFinite(t.nilaiRupiah) || t.nilaiRupiah < 0)
      ) {
        return 'Nilai Rupiah termin harus bernilai 0 atau lebih.';
      }
      if (
        t.tanggalCair &&
        t.tanggalCair.trim() !== '' &&
        !/^\d{4}-\d{2}-\d{2}$/.test(t.tanggalCair.trim())
      ) {
        return `Format Tanggal Pencairan pada "${t.nama}" tidak valid.`;
      }
    }
  }
  if (
    input.statusPencairan !== undefined &&
    !STATUS_PENCAIRAN_LIST.includes(input.statusPencairan)
  ) {
    return 'Status Tahapan Pencairan tidak valid.';
  }
  if (
    input.tanggalPencairan &&
    input.tanggalPencairan.trim() !== '' &&
    !/^\d{4}-\d{2}-\d{2}$/.test(input.tanggalPencairan.trim())
  ) {
    return 'Format Tanggal Pencairan tidak valid.';
  }
  if (
    input.mekanismePencairan !== undefined &&
    !MEKANISME_PENCAIRAN_LIST.includes(input.mekanismePencairan)
  ) {
    return 'Mekanisme Pencairan tidak valid.';
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
  rekeningId?: string | 'all';
  kodeRekening?: string | 'all';
  jenisPelaksanaan?: JenisPelaksanaan | 'all';
  skemaKontrak?: SkemaKontrak | 'all';
  skemaPembayaran?: SkemaPembayaran | 'all';
  status?: PaketOverallStatus | 'all';
  tahunAnggaran?: number | 'all';
  statusPencairan?: StatusPencairan | 'all';
  mekanismePencairan?: MekanismePencairan | 'all';
  picNama?: string | 'all';
}

export function filterPaketPekerjaan(
  list: PaketPekerjaan[],
  filters: PekerjaanFilterOptions,
  todayIso: string,
  rekeningList: RekeningAnggaran[] = []
): PaketPekerjaan[] {
  return list.filter((item) => {
    const paguInfo = resolvePaketPaguInfo(item, rekeningList);

    if (
      filters.rekeningId &&
      filters.rekeningId !== 'all' &&
      item.rekeningId !== filters.rekeningId &&
      paguInfo.rekening?.id !== filters.rekeningId
    ) {
      return false;
    }

    if (filters.kodeRekening && filters.kodeRekening !== 'all') {
      const targetNorm = normalizeKodeRekening(filters.kodeRekening);
      if (normalizeKodeRekening(paguInfo.kodeRekening) !== targetNorm) {
        return false;
      }
    }

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

    if (
      filters.skemaKontrak &&
      filters.skemaKontrak !== 'all' &&
      item.skemaKontrak !== filters.skemaKontrak
    ) {
      return false;
    }

    if (filters.skemaPembayaran && filters.skemaPembayaran !== 'all') {
      const effectiveSkema = summarizeTerminPencairan(item).skemaPembayaran;
      if (effectiveSkema !== filters.skemaPembayaran) {
        return false;
      }
    }

    if (filters.statusPencairan && filters.statusPencairan !== 'all') {
      const resolvedStatus = resolveStatusPencairanFromTermin(
        item.skemaPembayaran,
        item.statusPencairan,
        item.terminPencairan
      );
      if (resolvedStatus !== filters.statusPencairan) {
        return false;
      }
    }

    if (
      filters.mekanismePencairan &&
      filters.mekanismePencairan !== 'all' &&
      item.mekanismePencairan !== filters.mekanismePencairan
    ) {
      return false;
    }

    if (
      filters.picNama &&
      filters.picNama !== 'all' &&
      (item.picNama || '').trim() !== filters.picNama
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
      const matchKodeRekening = paguInfo.kodeRekening.toLowerCase().includes(q);
      const matchNamaRekening = paguInfo.namaRekening.toLowerCase().includes(q);
      const matchKegiatan = item.namaKegiatan.toLowerCase().includes(q);
      const matchSub = item.subKegiatan.toLowerCase().includes(q);
      const matchPekerjaan = (item.pekerjaan || '').toLowerCase().includes(q);
      const matchSkema = (item.skemaKontrak || '').toLowerCase().includes(q);
      const matchSkemaBayar = (item.skemaPembayaran || '').toLowerCase().includes(q);
      const matchMekanisme = (item.mekanismePencairan || '').toLowerCase().includes(q);
      const matchPenyedia = (item.penyedia || '').toLowerCase().includes(q);
      const matchKodeRup = (item.kodeRup || '').toLowerCase().includes(q);
      const matchKontrak = (item.nomorKontrak || '').toLowerCase().includes(q);
      const matchPic = (item.picNama || '').toLowerCase().includes(q);
      const matchTahun = String(getPaketTahunAnggaran(item)).includes(q);
      const matchTahap = item.tahapan.some((t) => t.nama.toLowerCase().includes(q));
      const matchTermin = (item.terminPencairan || []).some((tr) =>
        tr.nama.toLowerCase().includes(q)
      );
      if (
        !matchKodeRekening &&
        !matchNamaRekening &&
        !matchKegiatan &&
        !matchSub &&
        !matchPekerjaan &&
        !matchSkema &&
        !matchSkemaBayar &&
        !matchMekanisme &&
        !matchPenyedia &&
        !matchKodeRup &&
        !matchKontrak &&
        !matchPic &&
        !matchTahun &&
        !matchTahap &&
        !matchTermin
      ) {
        return false;
      }
    }

    return true;
  });
}

export interface PekerjaanDashboardStats {
  totalPaket: number;
  jumlahRekeningUnik: number;
  totalAnggaran: number;
  totalNilaiKontrak: number;
  totalNilaiSudahCair: number;
  sisaPaguTotal: number;
  anggaranSelesai: number;
  kontrakSelesai: number;
  sudahCairCount: number;
  belumCairCount: number;
  belumMulai: number;
  sedangBerjalan: number;
  terlambat: number;
  mendekatiTenggat: number;
  selesai: number;
  rataRataProgres: number;
}

export function calculatePekerjaanStats(
  list: PaketPekerjaan[],
  todayIso: string,
  rekeningList: RekeningAnggaran[] = []
): PekerjaanDashboardStats {
  const stats: PekerjaanDashboardStats = {
    totalPaket: list.length,
    jumlahRekeningUnik: 0,
    totalAnggaran: 0,
    totalNilaiKontrak: 0,
    totalNilaiSudahCair: 0,
    sisaPaguTotal: 0,
    anggaranSelesai: 0,
    kontrakSelesai: 0,
    sudahCairCount: 0,
    belumCairCount: 0,
    belumMulai: 0,
    sedangBerjalan: 0,
    terlambat: 0,
    mendekatiTenggat: 0,
    selesai: 0,
    rataRataProgres: 0,
  };

  if (list.length === 0) return stats;

  const seenPaguKeys = new Set<string>();
  const seenRekeningKeys = new Set<string>();
  const seenCompletedPaguKeys = new Set<string>();
  let totalPct = 0;

  for (const item of list) {
    const paguInfo = resolvePaketPaguInfo(item, rekeningList);
    const val = Number.isFinite(paguInfo.paguAnggaran) ? paguInfo.paguAnggaran : 0;
    const kontrakVal =
      typeof item.nilaiKontrak === 'number' && Number.isFinite(item.nilaiKontrak)
        ? item.nilaiKontrak
        : 0;

    // 1 Kode Rekening = 1 Pagu Anggaran: jangan pernah menjumlahkan pagu yang sama berulang kali
    if (!seenPaguKeys.has(paguInfo.dedupeKey)) {
      seenPaguKeys.add(paguInfo.dedupeKey);
      stats.totalAnggaran += val;
    }
    if (paguInfo.hasRekening) {
      seenRekeningKeys.add(paguInfo.dedupeKey);
    }
    stats.totalNilaiKontrak += kontrakVal;

    const terminSum = summarizeTerminPencairan(item);
    stats.totalNilaiSudahCair += terminSum.totalNilaiCair;

    const resolvedStatus = resolveStatusPencairanFromTermin(
      item.skemaPembayaran,
      item.statusPencairan,
      item.terminPencairan
    );
    if (resolvedStatus === 'Sudah') {
      stats.sudahCairCount += 1;
    } else {
      stats.belumCairCount += 1;
    }

    const progress = computePaketProgress(item, todayIso);
    totalPct += progress.persentase;

    if (progress.overallStatus === 'selesai') {
      stats.selesai += 1;
      stats.kontrakSelesai += kontrakVal;
      if (!seenCompletedPaguKeys.has(paguInfo.dedupeKey)) {
        seenCompletedPaguKeys.add(paguInfo.dedupeKey);
        stats.anggaranSelesai += val;
      }
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

  stats.jumlahRekeningUnik = seenRekeningKeys.size;
  stats.sisaPaguTotal = stats.totalAnggaran - stats.totalNilaiKontrak;
  stats.rataRataProgres = Math.round(totalPct / list.length);
  return stats;
}

export interface TahunAnggaranSummary extends PekerjaanDashboardStats {
  tahunAnggaran: number;
  persentaseRealisasiAnggaran: number;
}

export function summarizePaketByTahunAnggaran(
  list: PaketPekerjaan[],
  todayIso: string,
  rekeningList: RekeningAnggaran[] = []
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
      const st = calculatePekerjaanStats(items, todayIso, rekeningList);
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
  totalNilaiKontrak: number;
  anggaranSelesai: number;
}

export function summarizePaketByJenis(
  list: PaketPekerjaan[],
  todayIso: string,
  rekeningList: RekeningAnggaran[] = []
): JenisPelaksanaanSummary[] {
  return JENIS_PELAKSANAAN_LIST.map((jenis) => {
    const subset = list.filter((p) => p.jenisPelaksanaan === jenis);
    const st = calculatePekerjaanStats(subset, todayIso, rekeningList);
    return {
      jenisPelaksanaan: jenis,
      totalPaket: st.totalPaket,
      selesai: st.selesai,
      totalAnggaran: st.totalAnggaran,
      totalNilaiKontrak: st.totalNilaiKontrak,
      anggaranSelesai: st.anggaranSelesai,
    };
  });
}

export function buildPekerjaanCsvContent(
  list: PaketPekerjaan[],
  todayIso: string,
  rekeningList: RekeningAnggaran[] = []
): string {
  const escapeCsv = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;

  const headers = [
    'No',
    'Tahun Anggaran',
    'Kode Rekening',
    'Uraian Rekening',
    'Nama Kegiatan',
    'Sub Kegiatan',
    'Pekerjaan',
    'Jenis Pelaksanaan',
    'Skema Kontrak',
    'Kode RUP',
    'Nomor Kontrak / SPK',
    'Penyedia / Pelaksana',
    'PIC / Penanggung Jawab',
    'Pagu Anggaran Rekening (Rp)',
    'Nilai HPS (Rp)',
    'Nilai Kontrak / Realisasi (Rp)',
    'Total Sudah Dibayar (Rp)',
    'Skema Pembayaran',
    'Tahapan Pencairan',
    'Tanggal Pencairan',
    'Mekanisme Pencairan',
    'Rincian Termin Pencairan',
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
    const paguInfo = resolvePaketPaguInfo(item, rekeningList);
    const terminInfo = summarizeTerminPencairan(item);
    const terminDetail =
      terminInfo.skemaPembayaran === 'Termin' &&
      Array.isArray(item.terminPencairan) &&
      item.terminPencairan.length > 0
        ? item.terminPencairan
            .map((tr) => {
              const parts: string[] = [];
              if (typeof tr.persentase === 'number') parts.push(`${tr.persentase}%`);
              const nom = resolveTerminNominal(tr, item.nilaiKontrak);
              if (nom !== undefined) parts.push(formatRupiah(nom));
              if (tr.tanggalCair) parts.push(`Cair ${formatTanggalDdMmYyyy(tr.tanggalCair)}`);
              const meta = parts.length > 0 ? ` (${parts.join(' · ')})` : '';
              return `${tr.urutan}. ${tr.nama}: ${tr.status}${meta}`;
            })
            .join(' | ')
        : 'Sekaligus';
    const tahapanDetail = item.tahapan
      .map(
        (t) =>
          `${t.urutan}. ${t.nama} [${
            t.status === 'selesai'
              ? 'Selesai'
              : t.status === 'sedang_berjalan'
              ? 'Sedang Berjalan'
              : 'Belum Mulai'
          }${t.tanggalSelesai ? ` · ${formatTanggalDisplay(t.tanggalSelesai)}` : ''}]`
      )
      .join(' | ');

    return [
      String(idx + 1),
      String(tahunAnggaran),
      escapeCsv(paguInfo.kodeRekening),
      escapeCsv(paguInfo.namaRekening),
      escapeCsv(item.namaKegiatan),
      escapeCsv(item.subKegiatan),
      escapeCsv(item.pekerjaan || ''),
      escapeCsv(item.jenisPelaksanaan),
      escapeCsv(item.skemaKontrak || '-'),
      escapeCsv(item.kodeRup || ''),
      escapeCsv(item.nomorKontrak || ''),
      escapeCsv(item.penyedia || ''),
      escapeCsv(item.picNama || ''),
      String(paguInfo.paguAnggaran || 0),
      typeof item.hps === 'number' ? String(item.hps) : '',
      String(item.nilaiKontrak ?? 0),
      String(terminInfo.totalNilaiCair || 0),
      escapeCsv(terminInfo.skemaPembayaran),
      escapeCsv(terminInfo.summaryLabel),
      escapeCsv(
        (() => {
          const tgl = resolvePaketTanggalPencairan(item);
          return tgl ? formatTanggalDisplay(tgl) : '-';
        })()
      ),
      escapeCsv(item.mekanismePencairan || '-'),
      escapeCsv(terminDetail),
      escapeCsv(item.tanggalMulai ? formatTanggalDisplay(item.tanggalMulai) : ''),
      String(progress.durasiHariKerja),
      escapeCsv(item.tenggatWaktu ? formatTanggalDisplay(item.tenggatWaktu) : ''),
      escapeCsv(item.tanggalSelesai ? formatTanggalDisplay(item.tanggalSelesai) : ''),
      escapeCsv(progress.overallStatusLabel),
      `${progress.persentase}%`,
      escapeCsv(progress.activeStage?.nama || '-'),
      escapeCsv(tahapanDetail),
    ].join(',');
  });

  return '\uFEFF' + [headers.join(','), ...rows].join('\n');
}

