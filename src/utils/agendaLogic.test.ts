import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysIso,
  addMonthsIso,
  buildAgendaRekapCsvContent,
  calculateAgendaRekapStats,
  computeTimeBlockPosition,
  filterAgendaEvents,
  filterAgendaForRekap,
  formatAgendaTimeRange,
  formatMonthYearLabel,
  formatWeekRangeLabel,
  getAgendaStatusLabel,
  getMonthCalendarGrid,
  getTodayActiveAndUpcomingAgendas,
  getUpcomingAgendaEvents,
  getWeekDays,
  formatAgendaTickerEntry,
  normalizeAgendaStatus,
  resolveAgendaRekapRange,
  sortAgendaEvents,
  timeToMinutes,
  validateAgendaInput,
  validateRescheduleInput,
} from './agendaLogic.ts';
import type { AgendaEvent } from '../types/index.ts';

const sampleEvents: AgendaEvent[] = [
  {
    id: 'ag-1',
    judul: 'Tinjauan Lapangan Apartemen Dago Butik',
    kategori: 'Tinjauan Lapangan',
    tanggal: '2026-11-24',
    sepanjangHari: false,
    jamMulai: '10:00',
    jamSelesai: '12:00',
    lokasi: 'Apartemen Dago Butik Bandung',
    pesertaIds: ['p-2', 'p-3'],
    pesertaNama: ['Chafidz Ginanjar, ST', 'Eva Faoziah Alli, ST'],
    dibuatOlehId: 'p-1',
    dibuatOlehNama: 'Yuliani, ST',
    createdAt: '2026-11-22 08:00',
    updatedAt: '2026-11-22 08:00',
  },
  {
    id: 'ag-2',
    judul: 'Rapat Koordinasi PPPSRS',
    kategori: 'Rapat Koordinasi',
    tanggal: '2026-11-24',
    sepanjangHari: false,
    jamMulai: '08:30',
    jamSelesai: '09:30',
    lokasi: 'Ruang Rapat DPKP Lt. 2',
    pesertaIds: ['p-1', 'p-2'],
    pesertaNama: ['Yuliani, ST', 'Chafidz Ginanjar, ST'],
    dibuatOlehId: 'p-1',
    dibuatOlehNama: 'Yuliani, ST',
    createdAt: '2026-11-22 08:00',
    updatedAt: '2026-11-22 08:00',
  },
  {
    id: 'ag-3',
    judul: 'Monitoring Pengaduan Penghuni',
    kategori: 'Audiensi',
    tanggal: '2026-11-20',
    sepanjangHari: true,
    jamMulai: '08:00',
    jamSelesai: '16:00',
    lokasi: 'Rusunami The Jarrdin',
    pesertaIds: ['p-4'],
    pesertaNama: ['Eryanti Septian, S.Pd'],
    dibuatOlehId: 'p-1',
    dibuatOlehNama: 'Yuliani, ST',
    createdAt: '2026-11-19 10:00',
    updatedAt: '2026-11-19 10:00',
  },
  {
    id: 'ag-4',
    judul: 'Asistensi Pengembang Rusunawa "Cibeunying"',
    kategori: 'Asistensi',
    tanggal: '2026-12-03',
    sepanjangHari: false,
    jamMulai: '13:00',
    jamSelesai: '15:00',
    lokasi: 'Kantor DPKP Kota Bandung',
    pesertaIds: ['p-2'],
    pesertaNama: ['Chafidz Ginanjar, ST'],
    pesertaTambahan: 'Tim Legal Pengembang',
    catatan: 'Membawa dokumen "SK Pertelaan" terbaru',
    dibuatOlehId: 'p-1',
    dibuatOlehNama: 'Yuliani, ST',
    createdAt: '2026-11-22 09:00',
    updatedAt: '2026-11-22 09:00',
  },
];

test('getMonthCalendarGrid generates Monday-first calendar cells with accurate today flag', () => {
  // November 2026 starts on Sunday (Nov 1, 2026 = Sunday => 6 offset days from Monday Oct 26)
  const grid = getMonthCalendarGrid(2026, 10, '2026-11-22');
  assert.equal(grid.length % 7, 0);
  assert.equal(grid[0].isoDate, '2026-10-26');
  assert.equal(grid[0].isCurrentMonth, false);
  const nov1 = grid.find((c) => c.isoDate === '2026-11-01');
  assert.ok(nov1);
  assert.equal(nov1.isCurrentMonth, true);
  const todayCell = grid.find((c) => c.isToday);
  assert.equal(todayCell?.isoDate, '2026-11-22');
});

test('getWeekDays and date navigation helpers work across month boundaries', () => {
  // 2026-11-22 is Sunday -> week is Mon 2026-11-16 .. Sun 2026-11-22
  const week = getWeekDays('2026-11-22');
  assert.equal(week.length, 7);
  assert.equal(week[0], '2026-11-16');
  assert.equal(week[6], '2026-11-22');

  assert.equal(addDaysIso('2026-11-30', 1), '2026-12-01');
  assert.equal(addMonthsIso('2026-01-31', 1), '2026-02-28');
  assert.equal(formatMonthYearLabel('2026-11-22'), 'November 2026');
  assert.equal(formatWeekRangeLabel('2026-11-22'), '16–22 November 2026');
});

test('validateAgendaInput enforces required fields, valid time order, and attendee presence', () => {
  assert.match(
    validateAgendaInput({
      judul: '',
      tanggal: '2026-11-24',
      sepanjangHari: false,
      jamMulai: '09:00',
      jamSelesai: '10:00',
      lokasi: 'DPKP',
      pesertaIds: ['p-1'],
    }) || '',
    /Judul/
  );

  assert.match(
    validateAgendaInput({
      judul: 'Rapat Tim',
      tanggal: '2026-11-24',
      sepanjangHari: false,
      jamMulai: '11:00',
      jamSelesai: '10:00',
      lokasi: 'DPKP',
      pesertaIds: ['p-1'],
    }) || '',
    /lebih lambat/
  );

  assert.match(
    validateAgendaInput({
      judul: 'Rapat Tim',
      tanggal: '2026-11-24',
      sepanjangHari: false,
      jamMulai: '09:00',
      jamSelesai: '10:00',
      lokasi: 'DPKP',
      pesertaIds: [],
      pesertaTambahan: '',
    }) || '',
    /personel/
  );

  assert.equal(
    validateAgendaInput({
      judul: 'Rapat Tim',
      tanggal: '2026-11-24',
      sepanjangHari: false,
      jamMulai: '09:00',
      jamSelesai: '10:00',
      lokasi: 'Ruang Rapat DPKP',
      pesertaIds: ['p-1'],
    }),
    null
  );
});

test('sortAgendaEvents, filterAgendaEvents, and getUpcomingAgendaEvents work deterministically', () => {
  const sorted = sortAgendaEvents(sampleEvents);
  assert.deepEqual(
    sorted.map((e) => e.id),
    ['ag-3', 'ag-2', 'ag-1', 'ag-4']
  );

  const byPersonel = filterAgendaEvents(sampleEvents, {
    personelNama: 'Eva Faoziah Alli, ST',
  });
  assert.deepEqual(
    byPersonel.map((e) => e.id),
    ['ag-1']
  );

  const bySearch = filterAgendaEvents(sampleEvents, {
    searchQuery: 'Ruang Rapat',
  });
  assert.deepEqual(
    bySearch.map((e) => e.id),
    ['ag-2']
  );

  const upcoming = getUpcomingAgendaEvents(sampleEvents, '2026-11-22', 5);
  assert.deepEqual(
    upcoming.map((e) => e.id),
    ['ag-2', 'ag-1', 'ag-4']
  );
});

test('time calculation and positioning helpers format and clamp correctly', () => {
  assert.equal(timeToMinutes('09:30'), 570);
  assert.equal(
    formatAgendaTimeRange({ sepanjangHari: true, jamMulai: '08:00', jamSelesai: '16:00' }),
    'Sepanjang hari'
  );
  assert.equal(
    formatAgendaTimeRange({ sepanjangHari: false, jamMulai: '09:00', jamSelesai: '11:30' }),
    '09:00–11:30 WIB'
  );

  const pos = computeTimeBlockPosition('09:00', '11:00', 7, 20);
  assert.ok(pos.topPct > 15 && pos.topPct < 16);
  assert.ok(pos.heightPct > 15 && pos.heightPct < 16);
});

test('resolveAgendaRekapRange resolves harian, mingguan, bulanan, and range accurately including error validation', () => {
  const harian = resolveAgendaRekapRange({
    mode: 'harian',
    anchorDate: '2026-11-24',
    monthStr: '2026-11',
  });
  assert.equal(harian.hasError, false);
  assert.equal(harian.startDate, '2026-11-24');
  assert.equal(harian.endDate, '2026-11-24');
  assert.match(harian.periodeLabel, /Harian · Selasa, 24 November 2026/);

  const mingguan = resolveAgendaRekapRange({
    mode: 'mingguan',
    anchorDate: '2026-11-24',
    monthStr: '2026-11',
  });
  assert.equal(mingguan.hasError, false);
  assert.equal(mingguan.startDate, '2026-11-23');
  assert.equal(mingguan.endDate, '2026-11-29');
  assert.match(mingguan.periodeLabel, /Mingguan · 23–29 November 2026/);

  const bulananNov = resolveAgendaRekapRange({
    mode: 'bulanan',
    anchorDate: '2026-11-24',
    monthStr: '2026-11',
  });
  assert.equal(bulananNov.startDate, '2026-11-01');
  assert.equal(bulananNov.endDate, '2026-11-30');

  const bulananFebLeap = resolveAgendaRekapRange({
    mode: 'bulanan',
    anchorDate: '2024-02-10',
    monthStr: '2024-02',
  });
  assert.equal(bulananFebLeap.endDate, '2024-02-29');

  const validRange = resolveAgendaRekapRange({
    mode: 'range',
    anchorDate: '2026-11-24',
    monthStr: '2026-11',
    dateFrom: '2026-11-20',
    dateTo: '2026-12-03',
  });
  assert.equal(validRange.hasError, false);
  assert.equal(validRange.startDate, '2026-11-20');
  assert.equal(validRange.endDate, '2026-12-03');
  assert.match(validRange.periodeLabel, /20 November 2026 s\.d\. 3 Desember 2026/);

  const invalidRange = resolveAgendaRekapRange({
    mode: 'range',
    anchorDate: '2026-11-24',
    monthStr: '2026-11',
    dateFrom: '2026-12-10',
    dateTo: '2026-12-01',
  });
  assert.equal(invalidRange.hasError, true);
  assert.match(invalidRange.errorMessage || '', /tidak valid/i);
});

test('filterAgendaForRekap filters across all 4 modes and combines with kategori/personel/search', () => {
  // Harian 2026-11-24 -> ag-2 (08:30) & ag-1 (10:00)
  const daily = filterAgendaForRekap(sampleEvents, {
    mode: 'harian',
    anchorDate: '2026-11-24',
    monthStr: '2026-11',
  });
  assert.deepEqual(
    daily.map((e) => e.id),
    ['ag-2', 'ag-1']
  );

  // Mingguan 2026-11-20 (Mon Nov 16 .. Sun Nov 22) -> ag-3 only
  const weeklyPrev = filterAgendaForRekap(sampleEvents, {
    mode: 'mingguan',
    anchorDate: '2026-11-20',
    monthStr: '2026-11',
  });
  assert.deepEqual(
    weeklyPrev.map((e) => e.id),
    ['ag-3']
  );

  // Bulanan 2026-11 -> ag-3, ag-2, ag-1 (excludes ag-4 in Dec)
  const monthlyNov = filterAgendaForRekap(sampleEvents, {
    mode: 'bulanan',
    anchorDate: '2026-11-22',
    monthStr: '2026-11',
  });
  assert.deepEqual(
    monthlyNov.map((e) => e.id),
    ['ag-3', 'ag-2', 'ag-1']
  );

  // Range inclusive 2026-11-24 .. 2026-12-03 -> ag-2, ag-1, ag-4
  const rangeAll = filterAgendaForRekap(sampleEvents, {
    mode: 'range',
    anchorDate: '2026-11-22',
    monthStr: '2026-11',
    dateFrom: '2026-11-24',
    dateTo: '2026-12-03',
  });
  assert.deepEqual(
    rangeAll.map((e) => e.id),
    ['ag-2', 'ag-1', 'ag-4']
  );

  // Range combined with personel filter
  const rangePersonel = filterAgendaForRekap(sampleEvents, {
    mode: 'range',
    anchorDate: '2026-11-22',
    monthStr: '2026-11',
    dateFrom: '2026-11-20',
    dateTo: '2026-12-05',
    personelNama: 'Chafidz Ginanjar, ST',
  });
  assert.deepEqual(
    rangePersonel.map((e) => e.id),
    ['ag-2', 'ag-1', 'ag-4']
  );

  // Invalid range returns empty list
  const badRange = filterAgendaForRekap(sampleEvents, {
    mode: 'range',
    anchorDate: '2026-11-22',
    monthStr: '2026-11',
    dateFrom: '2026-12-05',
    dateTo: '2026-11-20',
  });
  assert.deepEqual(badRange, []);
});

test('calculateAgendaRekapStats and buildAgendaRekapCsvContent summarize and escape CSV properly', () => {
  const stats = calculateAgendaRekapStats(sampleEvents);
  assert.equal(stats.totalAgenda, 4);
  assert.equal(stats.hariAktif, 3); // Nov 20, Nov 24, Dec 3
  assert.equal(stats.totalSehariPenuh, 1);
  assert.equal(stats.totalTerjadwalJam, 3);
  assert.equal(stats.byKategori['Tinjauan Lapangan'], 1);
  assert.equal(stats.byKategori.Asistensi, 1);
  assert.equal(stats.personelBreakdown[0].nama, 'Chafidz Ginanjar, ST');
  assert.equal(stats.personelBreakdown[0].jumlah, 3);

  const csv = buildAgendaRekapCsvContent(sampleEvents, 'Bulanan · November 2026');
  assert.ok(
    csv.startsWith(
      '\uFEFFNo,Tanggal,Hari,Waktu,Status,Tanggal Sebelumnya,Keterangan Status,Kategori,Judul Agenda'
    )
  );
  // Quotes inside judul/catatan of ag-4 must be doubled
  assert.match(csv, /"Asistensi Pengembang Rusunawa ""Cibeunying"""/);
  assert.match(csv, /"Membawa dokumen ""SK Pertelaan"" terbaru"/);
  assert.match(csv, /"Bulanan · November 2026"/);
});

test('getTodayActiveAndUpcomingAgendas returns only ongoing and upcoming agendas for today', () => {
  const today = '2026-11-22';
  const todayEvents: AgendaEvent[] = [
    {
      ...sampleEvents[0],
      id: 'past-today',
      judul: 'Apel Pagi (Sudah Selesai)',
      tanggal: today,
      sepanjangHari: false,
      jamMulai: '07:30',
      jamSelesai: '08:30',
    },
    {
      ...sampleEvents[1],
      id: 'exact-end',
      judul: 'Briefing Tepat Selesai',
      tanggal: today,
      sepanjangHari: false,
      jamMulai: '09:00',
      jamSelesai: '10:00',
    },
    {
      ...sampleEvents[0],
      id: 'ongoing-today',
      judul: 'Rapat Evaluasi Berjalan',
      tanggal: today,
      sepanjangHari: false,
      jamMulai: '09:30',
      jamSelesai: '11:30',
    },
    {
      ...sampleEvents[2],
      id: 'allday-today',
      judul: 'Piket Posko Hari Ini',
      tanggal: today,
      sepanjangHari: true,
      jamMulai: '00:00',
      jamSelesai: '23:59',
    },
    {
      ...sampleEvents[3],
      id: 'upcoming-today',
      judul: 'Tinjauan Lapangan Sore',
      tanggal: today,
      sepanjangHari: false,
      jamMulai: '14:00',
      jamSelesai: '16:00',
    },
    {
      ...sampleEvents[0],
      id: 'tomorrow-event',
      judul: 'Agenda Besok',
      tanggal: '2026-11-23',
      sepanjangHari: false,
      jamMulai: '09:00',
      jamSelesai: '11:00',
    },
  ];

  // At 10:00 WIB (600 mins): past-today & exact-end excluded; tomorrow-event excluded
  const result = getTodayActiveAndUpcomingAgendas(todayEvents, today, 10 * 60);
  assert.deepEqual(
    result.map((item) => ({ id: item.event.id, status: item.status })),
    [
      { id: 'allday-today', status: 'sedang' },
      { id: 'ongoing-today', status: 'sedang' },
      { id: 'upcoming-today', status: 'akan' },
    ]
  );

  assert.match(
    formatAgendaTickerEntry(result[1]),
    /\[SEDANG BERLANGSUNG\] 09:30–11:30 WIB · Rapat Evaluasi Berjalan · Lokasi:/
  );
  assert.match(
    formatAgendaTickerEntry(result[2]),
    /\[AKAN BERJALAN\] 14:00–16:00 WIB · Tinjauan Lapangan Sore · Lokasi:/
  );
});

test('cancelled agendas are excluded from ticker & upcoming, while rescheduled agendas remain active with status metadata', () => {
  const today = '2026-11-22';
  const statusEvents: AgendaEvent[] = [
    {
      ...sampleEvents[0],
      id: 'cancelled-today',
      judul: 'Rapat Batal Hari Ini',
      tanggal: today,
      sepanjangHari: false,
      jamMulai: '13:00',
      jamSelesai: '14:00',
      status: 'dibatalkan',
      alasanStatus: 'Narasumber berhalangan hadir',
    },
    {
      ...sampleEvents[1],
      id: 'rescheduled-today',
      judul: 'Asistensi Pindahan Kemarin',
      tanggal: today,
      tanggalSebelumnya: '2026-11-21',
      sepanjangHari: false,
      jamMulai: '14:00',
      jamSelesai: '15:30',
      status: 'dijadwalkan_ulang',
      alasanStatus: 'Digeser ke hari ini',
    },
  ];

  // Ticker excludes cancelled event, includes rescheduled event
  const tickerItems = getTodayActiveAndUpcomingAgendas(statusEvents, today, 10 * 60);
  assert.deepEqual(
    tickerItems.map((i) => i.event.id),
    ['rescheduled-today']
  );
  assert.match(formatAgendaTickerEntry(tickerItems[0]), /Jadwal Ulang/);

  // Upcoming excludes cancelled event
  const upcoming = getUpcomingAgendaEvents(statusEvents, today, 5);
  assert.deepEqual(
    upcoming.map((e) => e.id),
    ['rescheduled-today']
  );

  // Filter by status
  assert.deepEqual(
    filterAgendaEvents(statusEvents, { status: 'dibatalkan' }).map((e) => e.id),
    ['cancelled-today']
  );
  assert.deepEqual(
    filterAgendaEvents(statusEvents, { status: 'dijadwalkan_ulang' }).map((e) => e.id),
    ['rescheduled-today']
  );

  // Status labels & normalization
  assert.equal(normalizeAgendaStatus(undefined), 'terjadwal');
  assert.equal(getAgendaStatusLabel(undefined), 'Terjadwal');
  assert.equal(getAgendaStatusLabel('dibatalkan'), 'Dibatalkan');
  assert.equal(getAgendaStatusLabel('dijadwalkan_ulang'), 'Dijadwalkan Ulang');

  // Rekap stats & CSV include status counts and columns
  const stats = calculateAgendaRekapStats(statusEvents);
  assert.equal(stats.totalAgenda, 2);
  assert.equal(stats.totalDibatalkan, 1);
  assert.equal(stats.totalDijadwalkanUlang, 1);
  assert.equal(stats.totalAktif, 1);

  const csv = buildAgendaRekapCsvContent(statusEvents);
  assert.match(csv, /Status,Tanggal Sebelumnya,Keterangan Status/);
  assert.match(csv, /"Dibatalkan"/);
  assert.match(csv, /"Dijadwalkan Ulang"/);
  assert.match(csv, /2026-11-21/);
});

test('validateRescheduleInput enforces schedule change for active agenda and allows reactivating cancelled agenda', () => {
  // Unchanged active schedule rejected
  assert.match(
    validateRescheduleInput({
      currentTanggal: '2026-11-24',
      currentSepanjangHari: false,
      currentJamMulai: '09:00',
      currentJamSelesai: '10:00',
      currentLokasi: 'Ruang Rapat',
      currentStatus: 'terjadwal',
      newTanggal: '2026-11-24',
      newSepanjangHari: false,
      newJamMulai: '09:00',
      newJamSelesai: '10:00',
      newLokasi: 'Ruang Rapat',
    }) || '',
    /Pilih tanggal baru/
  );

  // Moving to another date accepted
  assert.equal(
    validateRescheduleInput({
      currentTanggal: '2026-11-24',
      currentSepanjangHari: false,
      currentJamMulai: '09:00',
      currentJamSelesai: '10:00',
      currentLokasi: 'Ruang Rapat',
      currentStatus: 'terjadwal',
      newTanggal: '2026-11-27',
      newSepanjangHari: false,
      newJamMulai: '09:00',
      newJamSelesai: '10:00',
      newLokasi: 'Ruang Rapat',
    }),
    null
  );

  // Invalid end <= start rejected
  assert.match(
    validateRescheduleInput({
      currentTanggal: '2026-11-24',
      currentSepanjangHari: false,
      currentJamMulai: '09:00',
      currentJamSelesai: '10:00',
      currentLokasi: 'Ruang Rapat',
      currentStatus: 'terjadwal',
      newTanggal: '2026-11-27',
      newSepanjangHari: false,
      newJamMulai: '14:00',
      newJamSelesai: '13:00',
      newLokasi: 'Ruang Rapat',
    }) || '',
    /lebih lambat/
  );

  // Cancelled agenda rescheduled back on same date & time is allowed
  assert.equal(
    validateRescheduleInput({
      currentTanggal: '2026-11-24',
      currentSepanjangHari: false,
      currentJamMulai: '09:00',
      currentJamSelesai: '10:00',
      currentLokasi: 'Ruang Rapat',
      currentStatus: 'dibatalkan',
      newTanggal: '2026-11-24',
      newSepanjangHari: false,
      newJamMulai: '09:00',
      newJamSelesai: '10:00',
      newLokasi: 'Ruang Rapat',
    }),
    null
  );
});



