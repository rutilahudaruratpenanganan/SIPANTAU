import type { AgendaEvent, AgendaKategori, AgendaStatus } from '../types/index.ts';

export const AGENDA_KATEGORI_LIST: AgendaKategori[] = [
  'Rapat Koordinasi',
  'Tinjauan Lapangan',
  'Asistensi',
  'Audiensi',
  'Lainnya',
];

export const AGENDA_STATUS_LIST: AgendaStatus[] = [
  'terjadwal',
  'dijadwalkan_ulang',
  'dibatalkan',
];

export function normalizeAgendaStatus(status?: AgendaStatus): AgendaStatus {
  if (status === 'dibatalkan' || status === 'dijadwalkan_ulang') {
    return status;
  }
  return 'terjadwal';
}

export function getAgendaStatusLabel(status?: AgendaStatus): string {
  const normalized = normalizeAgendaStatus(status);
  if (normalized === 'dibatalkan') return 'Dibatalkan';
  if (normalized === 'dijadwalkan_ulang') return 'Dijadwalkan Ulang';
  return 'Terjadwal';
}

export interface KategoriStyle {
  bg: string;
  bgHover: string;
  border: string;
  text: string;
  dot: string;
  blockBg: string;
}

export function getKategoriStyle(kategori: AgendaKategori): KategoriStyle {
  switch (kategori) {
    case 'Rapat Koordinasi':
      return {
        bg: 'bg-blue-50',
        bgHover: 'hover:bg-blue-100',
        border: 'border-blue-200',
        text: 'text-blue-900',
        dot: 'bg-blue-600',
        blockBg: 'bg-blue-600',
      };
    case 'Tinjauan Lapangan':
      return {
        bg: 'bg-emerald-50',
        bgHover: 'hover:bg-emerald-100',
        border: 'border-emerald-200',
        text: 'text-emerald-900',
        dot: 'bg-emerald-600',
        blockBg: 'bg-emerald-600',
      };
    case 'Asistensi':
      return {
        bg: 'bg-amber-50',
        bgHover: 'hover:bg-amber-100',
        border: 'border-amber-200',
        text: 'text-amber-900',
        dot: 'bg-amber-600',
        blockBg: 'bg-amber-600',
      };
    case 'Audiensi':
      return {
        bg: 'bg-purple-50',
        bgHover: 'hover:bg-purple-100',
        border: 'border-purple-200',
        text: 'text-purple-900',
        dot: 'bg-purple-600',
        blockBg: 'bg-purple-600',
      };
    default:
      return {
        bg: 'bg-slate-100',
        bgHover: 'hover:bg-slate-200',
        border: 'border-slate-300',
        text: 'text-slate-900',
        dot: 'bg-slate-600',
        blockBg: 'bg-slate-700',
      };
  }
}

export const NAMA_HARI_SHORT = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
export const NAMA_HARI_FULL = [
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
  'Minggu',
];

export const NAMA_BULAN = [
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

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatIsoDateFromParts(year: number, monthIndex: number, day: number): string {
  const dt = new Date(Date.UTC(year, monthIndex, day));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

export function parseIsoDateParts(iso: string): { year: number; monthIndex: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || '').trim());
  if (!match) {
    const now = new Date();
    return {
      year: now.getFullYear(),
      monthIndex: now.getMonth(),
      day: now.getDate(),
    };
  }
  return {
    year: Number(match[1]),
    monthIndex: Number(match[2]) - 1,
    day: Number(match[3]),
  };
}

export function addDaysIso(iso: string, deltaDays: number): string {
  const { year, monthIndex, day } = parseIsoDateParts(iso);
  const dt = new Date(Date.UTC(year, monthIndex, day + deltaDays));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

export function addMonthsIso(iso: string, deltaMonths: number): string {
  const { year, monthIndex, day } = parseIsoDateParts(iso);
  const targetMonth = new Date(Date.UTC(year, monthIndex + deltaMonths, 1));
  const lastDayOfTarget = new Date(
    Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0)
  ).getUTCDate();
  return formatIsoDateFromParts(
    targetMonth.getUTCFullYear(),
    targetMonth.getUTCMonth(),
    Math.min(day, lastDayOfTarget)
  );
}

export function getDayOfWeekMonFirst(iso: string): number {
  const { year, monthIndex, day } = parseIsoDateParts(iso);
  const jsDay = new Date(Date.UTC(year, monthIndex, day)).getUTCDay(); // 0=Sun..6=Sat
  return (jsDay + 6) % 7; // 0=Mon..6=Sun
}

export interface CalendarCell {
  isoDate: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

export function getMonthCalendarGrid(
  year: number,
  monthIndex: number,
  todayIso: string
): CalendarCell[] {
  const firstIso = formatIsoDateFromParts(year, monthIndex, 1);
  const startOffset = getDayOfWeekMonFirst(firstIso); // 0..6 (Mon..Sun)
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const totalCells = startOffset + daysInMonth > 35 ? 42 : 35;

  const cells: CalendarCell[] = [];
  for (let i = 0; i < totalCells; i++) {
    const dayOffset = i - startOffset;
    const isoDate = formatIsoDateFromParts(year, monthIndex, 1 + dayOffset);
    const parts = parseIsoDateParts(isoDate);
    cells.push({
      isoDate,
      dayNumber: parts.day,
      isCurrentMonth: parts.year === year && parts.monthIndex === monthIndex,
      isToday: isoDate === todayIso,
    });
  }
  return cells;
}

export function getWeekDays(anchorIso: string): string[] {
  const offset = getDayOfWeekMonFirst(anchorIso);
  const mondayIso = addDaysIso(anchorIso, -offset);
  return Array.from({ length: 7 }, (_, i) => addDaysIso(mondayIso, i));
}

export function formatIndonesianDateFull(iso: string): string {
  const { year, monthIndex, day } = parseIsoDateParts(iso);
  const dow = getDayOfWeekMonFirst(iso);
  return `${NAMA_HARI_FULL[dow]}, ${day} ${NAMA_BULAN[monthIndex]} ${year}`;
}

export function formatMonthYearLabel(iso: string): string {
  const { year, monthIndex } = parseIsoDateParts(iso);
  return `${NAMA_BULAN[monthIndex]} ${year}`;
}

export function formatWeekRangeLabel(anchorIso: string): string {
  const days = getWeekDays(anchorIso);
  const first = parseIsoDateParts(days[0]);
  const last = parseIsoDateParts(days[6]);
  if (first.monthIndex === last.monthIndex && first.year === last.year) {
    return `${first.day}–${last.day} ${NAMA_BULAN[first.monthIndex]} ${first.year}`;
  }
  if (first.year === last.year) {
    return `${first.day} ${NAMA_BULAN[first.monthIndex].slice(0, 3)} – ${last.day} ${NAMA_BULAN[last.monthIndex].slice(0, 3)} ${first.year}`;
  }
  return `${first.day} ${NAMA_BULAN[first.monthIndex].slice(0, 3)} ${first.year} – ${last.day} ${NAMA_BULAN[last.monthIndex].slice(0, 3)} ${last.year}`;
}

export function timeToMinutes(hhmm: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec((hhmm || '').trim());
  if (!match) return 9 * 60;
  const h = Math.min(23, Math.max(0, Number(match[1])));
  const m = Math.min(59, Math.max(0, Number(match[2])));
  return h * 60 + m;
}

export function minutesToHhmm(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMinutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

export function formatAgendaTimeRange(event: Pick<AgendaEvent, 'sepanjangHari' | 'jamMulai' | 'jamSelesai'>): string {
  if (event.sepanjangHari) return 'Sepanjang hari';
  return `${event.jamMulai}–${event.jamSelesai} WIB`;
}

export interface AgendaValidationInput {
  judul: string;
  tanggal: string;
  sepanjangHari: boolean;
  jamMulai: string;
  jamSelesai: string;
  lokasi: string;
  pesertaIds: string[];
  pesertaTambahan?: string;
}

export function validateAgendaInput(input: AgendaValidationInput): string | null {
  if (!input.judul.trim()) {
    return 'Judul agenda kegiatan wajib diisi.';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.tanggal.trim())) {
    return 'Tanggal agenda harus diisi dengan format yang valid.';
  }
  if (!input.sepanjangHari) {
    if (!/^\d{2}:\d{2}$/.test(input.jamMulai) || !/^\d{2}:\d{2}$/.test(input.jamSelesai)) {
      return 'Waktu mulai dan waktu selesai wajib diisi.';
    }
    if (timeToMinutes(input.jamSelesai) <= timeToMinutes(input.jamMulai)) {
      return 'Waktu selesai harus lebih lambat daripada waktu mulai.';
    }
  }
  if (!input.lokasi.trim()) {
    return 'Lokasi / tempat kegiatan wajib diisi.';
  }
  if (input.pesertaIds.length === 0 && !input.pesertaTambahan?.trim()) {
    return 'Pilih minimal satu personel yang menghadiri agenda atau isi peserta tambahan.';
  }
  return null;
}

export interface RescheduleValidationInput {
  currentTanggal: string;
  currentSepanjangHari: boolean;
  currentJamMulai: string;
  currentJamSelesai: string;
  currentLokasi: string;
  currentStatus?: AgendaStatus;
  newTanggal: string;
  newSepanjangHari: boolean;
  newJamMulai: string;
  newJamSelesai: string;
  newLokasi: string;
}

export function validateRescheduleInput(input: RescheduleValidationInput): string | null {
  const nextDate = input.newTanggal.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) {
    return 'Tanggal jadwal ulang harus diisi dengan format yang valid.';
  }
  if (!input.newSepanjangHari) {
    if (!/^\d{2}:\d{2}$/.test(input.newJamMulai) || !/^\d{2}:\d{2}$/.test(input.newJamSelesai)) {
      return 'Waktu mulai dan waktu selesai jadwal ulang wajib diisi.';
    }
    if (timeToMinutes(input.newJamSelesai) <= timeToMinutes(input.newJamMulai)) {
      return 'Waktu selesai harus lebih lambat daripada waktu mulai.';
    }
  }
  if (!input.newLokasi.trim()) {
    return 'Lokasi / tempat kegiatan wajib diisi.';
  }

  const sameDate = nextDate === (input.currentTanggal || '').trim();
  const sameAllDay = Boolean(input.newSepanjangHari) === Boolean(input.currentSepanjangHari);
  const sameTime =
    input.newSepanjangHari ||
    (input.newJamMulai === input.currentJamMulai && input.newJamSelesai === input.currentJamSelesai);
  const sameLokasi = input.newLokasi.trim() === (input.currentLokasi || '').trim();

  if (
    normalizeAgendaStatus(input.currentStatus) !== 'dibatalkan' &&
    sameDate &&
    sameAllDay &&
    sameTime &&
    sameLokasi
  ) {
    return 'Pilih tanggal baru atau ubah waktu/lokasi untuk menjadwalkan ulang agenda.';
  }
  return null;
}

export function sortAgendaEvents(events: AgendaEvent[]): AgendaEvent[] {
  return [...events].sort((a, b) => {
    const cmpDate = (a.tanggal || '').localeCompare(b.tanggal || '');
    if (cmpDate !== 0) return cmpDate;
    if (a.sepanjangHari !== b.sepanjangHari) {
      return a.sepanjangHari ? -1 : 1;
    }
    const cmpTime = timeToMinutes(a.jamMulai) - timeToMinutes(b.jamMulai);
    if (cmpTime !== 0) return cmpTime;
    return a.judul.localeCompare(b.judul);
  });
}

export interface AgendaFilterOptions {
  searchQuery?: string;
  personelNama?: string | 'all';
  kategori?: AgendaKategori | 'all';
  status?: AgendaStatus | 'all';
}

export function filterAgendaEvents(
  events: AgendaEvent[],
  filters: AgendaFilterOptions
): AgendaEvent[] {
  return sortAgendaEvents(events).filter((ev) => {
    if (filters.status && filters.status !== 'all') {
      if (normalizeAgendaStatus(ev.status) !== filters.status) {
        return false;
      }
    }
    if (filters.kategori && filters.kategori !== 'all' && ev.kategori !== filters.kategori) {
      return false;
    }
    if (filters.personelNama && filters.personelNama !== 'all') {
      const target = filters.personelNama.toLowerCase();
      const hasPerson = ev.pesertaNama.some((p) => p.toLowerCase() === target);
      if (!hasPerson) return false;
    }
    if (filters.searchQuery && filters.searchQuery.trim() !== '') {
      const q = filters.searchQuery.toLowerCase().trim();
      const matchJudul = ev.judul.toLowerCase().includes(q);
      const matchLokasi = ev.lokasi.toLowerCase().includes(q);
      const matchCatatan = (ev.catatan || '').toLowerCase().includes(q);
      const matchAlasan = (ev.alasanStatus || '').toLowerCase().includes(q);
      const matchPeserta = ev.pesertaNama.some((p) => p.toLowerCase().includes(q));
      const matchTambahan = (ev.pesertaTambahan || '').toLowerCase().includes(q);
      if (!matchJudul && !matchLokasi && !matchCatatan && !matchAlasan && !matchPeserta && !matchTambahan) {
        return false;
      }
    }
    return true;
  });
}

export function getUpcomingAgendaEvents(
  events: AgendaEvent[],
  fromIso: string,
  limit = 5
): AgendaEvent[] {
  return sortAgendaEvents(events)
    .filter((ev) => ev.tanggal >= fromIso && normalizeAgendaStatus(ev.status) !== 'dibatalkan')
    .slice(0, limit);
}

export function computeTimeBlockPosition(
  jamMulai: string,
  jamSelesai: string,
  gridStartHour = 7,
  gridEndHour = 20
): { topPct: number; heightPct: number } {
  const minMin = gridStartHour * 60;
  const maxMin = gridEndHour * 60;
  const totalSpan = maxMin - minMin;

  const start = Math.max(minMin, Math.min(maxMin - 15, timeToMinutes(jamMulai)));
  const rawEnd = Math.max(start + 30, Math.min(maxMin, timeToMinutes(jamSelesai)));

  const topPct = ((start - minMin) / totalSpan) * 100;
  const heightPct = Math.max(4, ((rawEnd - start) / totalSpan) * 100);
  return { topPct, heightPct };
}

// ============================================================================
// REKAP AGENDA HELPERS (Harian, Mingguan, Bulanan, Range Tanggal)
// ============================================================================

export type AgendaRekapPeriodMode = 'harian' | 'mingguan' | 'bulanan' | 'range';

export interface AgendaRekapRangeInput {
  mode: AgendaRekapPeriodMode;
  anchorDate: string; // YYYY-MM-DD (used for harian & mingguan)
  monthStr: string; // YYYY-MM (used for bulanan)
  dateFrom?: string; // YYYY-MM-DD (used for range)
  dateTo?: string; // YYYY-MM-DD (used for range)
}

export interface ResolvedAgendaRekapRange {
  mode: AgendaRekapPeriodMode;
  startDate: string;
  endDate: string;
  hasError: boolean;
  errorMessage: string | null;
  periodeLabel: string;
}

function normalizeIsoDateOnly(value?: string): string {
  const trimmed = (value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  return '';
}

function formatIndonesianDateCompact(iso: string): string {
  const normalized = normalizeIsoDateOnly(iso);
  if (!normalized) return iso;
  const { year, monthIndex, day } = parseIsoDateParts(normalized);
  return `${day} ${NAMA_BULAN[monthIndex]} ${year}`;
}

export function getMonthStartAndEndIso(monthStr: string): { startDate: string; endDate: string; label: string } {
  const match = /^(\d{4})-(\d{2})$/.exec((monthStr || '').trim());
  const now = new Date();
  const year = match ? Number(match[1]) : now.getFullYear();
  const monthIndex = match ? Math.min(11, Math.max(0, Number(match[2]) - 1)) : now.getMonth();
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

  return {
    startDate: formatIsoDateFromParts(year, monthIndex, 1),
    endDate: formatIsoDateFromParts(year, monthIndex, lastDay),
    label: `${NAMA_BULAN[monthIndex]} ${year}`,
  };
}

export function resolveAgendaRekapRange(input: AgendaRekapRangeInput): ResolvedAgendaRekapRange {
  const safeAnchor = normalizeIsoDateOnly(input.anchorDate) || (() => {
    const now = new Date();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  })();

  if (input.mode === 'harian') {
    return {
      mode: 'harian',
      startDate: safeAnchor,
      endDate: safeAnchor,
      hasError: false,
      errorMessage: null,
      periodeLabel: `Harian · ${formatIndonesianDateFull(safeAnchor)}`,
    };
  }

  if (input.mode === 'mingguan') {
    const weekDays = getWeekDays(safeAnchor);
    return {
      mode: 'mingguan',
      startDate: weekDays[0],
      endDate: weekDays[6],
      hasError: false,
      errorMessage: null,
      periodeLabel: `Mingguan · ${formatWeekRangeLabel(safeAnchor)}`,
    };
  }

  if (input.mode === 'bulanan') {
    const { startDate, endDate, label } = getMonthStartAndEndIso(input.monthStr);
    return {
      mode: 'bulanan',
      startDate,
      endDate,
      hasError: false,
      errorMessage: null,
      periodeLabel: `Bulanan · ${label}`,
    };
  }

  // mode === 'range'
  const from = normalizeIsoDateOnly(input.dateFrom);
  const to = normalizeIsoDateOnly(input.dateTo);

  if (from && to && from > to) {
    return {
      mode: 'range',
      startDate: '',
      endDate: '',
      hasError: true,
      errorMessage:
        'Rentang tanggal tidak valid: "Dari Tanggal" tidak boleh lebih akhir daripada "Sampai Tanggal".',
      periodeLabel: 'Rentang Tanggal Tidak Valid',
    };
  }

  let rangeLabel = 'Semua Periode Tanggal';
  if (from && to) {
    rangeLabel = `${formatIndonesianDateCompact(from)} s.d. ${formatIndonesianDateCompact(to)}`;
  } else if (from) {
    rangeLabel = `Mulai ${formatIndonesianDateCompact(from)}`;
  } else if (to) {
    rangeLabel = `Sampai dengan ${formatIndonesianDateCompact(to)}`;
  }

  return {
    mode: 'range',
    startDate: from,
    endDate: to,
    hasError: false,
    errorMessage: null,
    periodeLabel: `Rentang Tanggal · ${rangeLabel}`,
  };
}

export interface AgendaRekapFilterOptions extends AgendaRekapRangeInput, AgendaFilterOptions {}

export function filterAgendaForRekap(
  events: AgendaEvent[],
  options: AgendaRekapFilterOptions
): AgendaEvent[] {
  const resolved = resolveAgendaRekapRange(options);
  if (resolved.hasError) return [];

  const inRange = events.filter((ev) => {
    const tgl = normalizeIsoDateOnly(ev.tanggal);
    if (!tgl) return false;
    if (resolved.startDate && tgl < resolved.startDate) return false;
    if (resolved.endDate && tgl > resolved.endDate) return false;
    return true;
  });

  return filterAgendaEvents(inRange, {
    searchQuery: options.searchQuery,
    personelNama: options.personelNama,
    kategori: options.kategori,
    status: options.status,
  });
}

export interface AgendaRekapStats {
  totalAgenda: number;
  totalAktif: number;
  totalDijadwalkanUlang: number;
  totalDibatalkan: number;
  hariAktif: number;
  totalSehariPenuh: number;
  totalTerjadwalJam: number;
  byKategori: Record<AgendaKategori, number>;
  personelBreakdown: { nama: string; jumlah: number }[];
}

export function calculateAgendaRekapStats(events: AgendaEvent[]): AgendaRekapStats {
  const byKategori: Record<AgendaKategori, number> = {
    'Rapat Koordinasi': 0,
    'Tinjauan Lapangan': 0,
    Asistensi: 0,
    Audiensi: 0,
    Lainnya: 0,
  };

  const uniqueDates = new Set<string>();
  const personelCountMap = new Map<string, number>();
  let totalSehariPenuh = 0;
  let totalDijadwalkanUlang = 0;
  let totalDibatalkan = 0;

  for (const ev of events) {
    const status = normalizeAgendaStatus(ev.status);
    if (status === 'dibatalkan') {
      totalDibatalkan++;
    } else if (status === 'dijadwalkan_ulang') {
      totalDijadwalkanUlang++;
    }

    if (ev.tanggal) uniqueDates.add(ev.tanggal);
    if (ev.sepanjangHari) totalSehariPenuh++;
    if (ev.kategori in byKategori) {
      byKategori[ev.kategori]++;
    } else {
      byKategori.Lainnya++;
    }
    for (const nama of ev.pesertaNama || []) {
      const clean = nama.trim();
      if (!clean) continue;
      personelCountMap.set(clean, (personelCountMap.get(clean) || 0) + 1);
    }
  }

  const personelBreakdown = Array.from(personelCountMap.entries())
    .map(([nama, jumlah]) => ({ nama, jumlah }))
    .sort((a, b) => b.jumlah - a.jumlah || a.nama.localeCompare(b.nama));

  return {
    totalAgenda: events.length,
    totalAktif: events.length - totalDibatalkan,
    totalDijadwalkanUlang,
    totalDibatalkan,
    hariAktif: uniqueDates.size,
    totalSehariPenuh,
    totalTerjadwalJam: events.length - totalSehariPenuh,
    byKategori,
    personelBreakdown,
  };
}

export function buildAgendaRekapCsvContent(
  events: AgendaEvent[],
  periodeLabel?: string
): string {
  const escapeCsv = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;

  const headers = [
    'No',
    'Tanggal',
    'Hari',
    'Waktu',
    'Status',
    'Tanggal Sebelumnya',
    'Keterangan Status',
    'Kategori',
    'Judul Agenda',
    'Lokasi',
    'Personel Peserta',
    'Peserta Tambahan',
    'Catatan',
    'Dibuat Oleh',
    ...(periodeLabel ? ['Periode Rekap'] : []),
  ];

  const rows = sortAgendaEvents(events).map((ev, idx) => {
    const dow = getDayOfWeekMonFirst(ev.tanggal);
    const cols = [
      String(idx + 1),
      ev.tanggal || '',
      NAMA_HARI_FULL[dow] || '',
      formatAgendaTimeRange(ev),
      escapeCsv(getAgendaStatusLabel(ev.status)),
      ev.tanggalSebelumnya || '',
      escapeCsv(ev.alasanStatus || ''),
      escapeCsv(ev.kategori || ''),
      escapeCsv(ev.judul || ''),
      escapeCsv(ev.lokasi || ''),
      escapeCsv((ev.pesertaNama || []).join(', ')),
      escapeCsv(ev.pesertaTambahan || ''),
      escapeCsv(ev.catatan || ''),
      escapeCsv(ev.dibuatOlehNama || ''),
    ];
    if (periodeLabel) {
      cols.push(escapeCsv(periodeLabel));
    }
    return cols.join(',');
  });

  return '\uFEFF' + [headers.join(','), ...rows].join('\n');
}

// ============================================================================
// RUNNING TEXT AGENDA HARI INI (Sedang Berlangsung & Akan Berjalan)
// ============================================================================

export type TodayAgendaStatus = 'sedang' | 'akan';

export interface TodayRunningAgendaItem {
  event: AgendaEvent;
  status: TodayAgendaStatus;
}

export function getTodayActiveAndUpcomingAgendas(
  events: AgendaEvent[],
  todayIso: string,
  nowMinutes: number
): TodayRunningAgendaItem[] {
  const safeNow = Math.max(0, Math.min(24 * 60 - 1, Math.floor(nowMinutes)));
  const results: TodayRunningAgendaItem[] = [];

  for (const ev of events) {
    if (normalizeAgendaStatus(ev.status) === 'dibatalkan') {
      continue;
    }
    if (normalizeIsoDateOnly(ev.tanggal) !== todayIso) {
      continue;
    }

    if (ev.sepanjangHari) {
      results.push({ event: ev, status: 'sedang' });
      continue;
    }

    const startMin = timeToMinutes(ev.jamMulai);
    const endMin = timeToMinutes(ev.jamSelesai);

    // Exclude agendas that have already ended today
    if (endMin <= safeNow) {
      continue;
    }

    const status: TodayAgendaStatus = startMin <= safeNow ? 'sedang' : 'akan';
    results.push({ event: ev, status });
  }

  return results.sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'sedang' ? -1 : 1;
    }
    if (a.event.sepanjangHari !== b.event.sepanjangHari) {
      return a.event.sepanjangHari ? -1 : 1;
    }
    const cmpTime = timeToMinutes(a.event.jamMulai) - timeToMinutes(b.event.jamMulai);
    if (cmpTime !== 0) return cmpTime;
    return a.event.judul.localeCompare(b.event.judul);
  });
}

export function formatAgendaTickerEntry(item: TodayRunningAgendaItem): string {
  const { event, status } = item;
  const statusTag = status === 'sedang' ? 'SEDANG BERLANGSUNG' : 'AKAN BERJALAN';
  const timeText = formatAgendaTimeRange(event);
  const rescheduleNote =
    normalizeAgendaStatus(event.status) === 'dijadwalkan_ulang' ? ' · Jadwal Ulang' : '';
  const pesertaText =
    event.pesertaNama.length > 0
      ? event.pesertaNama.length > 2
        ? `${event.pesertaNama.slice(0, 2).join(', ')} +${event.pesertaNama.length - 2}`
        : event.pesertaNama.join(', ')
      : event.pesertaTambahan || '-';

  return `[${statusTag}] ${timeText} · ${event.judul}${rescheduleNote} · Lokasi: ${event.lokasi} · Peserta: ${pesertaText}`;
}


