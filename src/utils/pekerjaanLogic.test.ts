import test from 'node:test';
import assert from 'node:assert/strict';
import {
  JENIS_PELAKSANAAN_LIST,
  MEKANISME_PENCAIRAN_LIST,
  SKEMA_KONTRAK_LIST,
  STATUS_PENCAIRAN_LIST,
  TEMPLATE_TAHAPAN_PEKERJAAN,
  addCalendarDaysIso,
  buildPekerjaanCsvContent,
  buildTemplateTahapan,
  calculatePekerjaanStats,
  computePaketProgress,
  countCalendarDaysBetweenIso,
  filterPaketPekerjaan,
  formatRupiah,
  formatTanggalDdMmYyyy,
  formatTanggalDisplay,
  getAvailablePicNames,
  getAvailableTahunAnggaran,
  getPaketDurasiHariKerja,
  getPaketTahunAnggaran,
  normalizeTahapanOrder,
  parseRupiahInput,
  resolvePaketTanggalSelesai,
  summarizePaketByTahunAnggaran,
  validatePaketPekerjaanInput,
} from './pekerjaanLogic.ts';
import type {
  JenisPelaksanaan,
  MekanismePencairan,
  PaketPekerjaan,
  SkemaKontrak,
  StatusPencairan,
} from '../types/index.ts';

test('Auto-templates match exact requested workflow stages per Jenis Pelaksanaan', () => {
  assert.deepEqual(JENIS_PELAKSANAAN_LIST, ['Perorangan', 'Badan Usaha']);

  assert.deepEqual(TEMPLATE_TAHAPAN_PEKERJAAN.Perorangan, [
    'Persiapan & SPK',
    'Laporan Pendahuluan',
    'Laporan Antara (Jika Ada)',
    'Laporan Akhir & BAST',
    'Laporan Pertanggungjawaban (Dokumen Pencairan)',
  ]);

  assert.deepEqual(TEMPLATE_TAHAPAN_PEKERJAAN['Badan Usaha'], [
    'Rapat Persiapan/PCM',
    'Laporan Pendahuluan',
    'Laporan Antara (Jika Ada)',
    'Draf Laporan Akhir',
    'Laporan Akhir & BAST',
  ]);

  const built = buildTemplateTahapan('Badan Usaha');
  assert.equal(built.length, 5);
  assert.equal(built[0].urutan, 1);
  assert.equal(built[0].status, 'belum_mulai');
  assert.equal(built[4].nama, 'Laporan Akhir & BAST');
});

test('Manual stage customization & re-indexing preserves clean urutan', () => {
  const template = buildTemplateTahapan('Perorangan');
  const customized = normalizeTahapanOrder([
    template[0],
    {
      id: 'custom-1',
      urutan: 99,
      nama: '  Verifikasi Lapangan Tambahan  ',
      status: 'belum_mulai',
    },
    template[3],
  ]);

  assert.deepEqual(
    customized.map((t) => [t.urutan, t.nama]),
    [
      [1, 'Persiapan & SPK'],
      [2, 'Verifikasi Lapangan Tambahan'],
      [3, 'Laporan Akhir & BAST'],
    ]
  );
});

test('resolvePaketTanggalSelesai syncs completion date when all stages finish or reopen', () => {
  const doneStages = [
    { id: '1', urutan: 1, nama: 'Tahap 1', status: 'selesai' as const, tanggalSelesai: '2026-11-10' },
    { id: '2', urutan: 2, nama: 'Tahap 2', status: 'selesai' as const, tanggalSelesai: '2026-11-15' },
  ];
  assert.equal(resolvePaketTanggalSelesai(doneStages, undefined, '2026-11-24'), '2026-11-15');
  assert.equal(resolvePaketTanggalSelesai(doneStages, '2026-11-20', '2026-11-24'), '2026-11-20');

  const reopenedStages = [
    doneStages[0],
    { id: '2', urutan: 2, nama: 'Tahap 2', status: 'sedang_berjalan' as const },
  ];
  assert.equal(resolvePaketTanggalSelesai(reopenedStages, '2026-11-20', '2026-11-24'), undefined);
});

test('Rupiah formatting and parsing handle Indonesian currency safely', () => {
  assert.equal(parseRupiahInput('Rp 125.000.000'), 125000000);
  assert.equal(parseRupiahInput(''), 0);
  const formatted = formatRupiah(125000000);
  assert.equal(formatted.includes('125.000.000'), true);
});

test('Calendar-days calculation counts tanggalMulai as Day 1 and formats Indonesian display dates accurately', () => {
  // User example: start 19-08-2026 + 93 calendar days (Day 1 = 19 Aug) => 19-11-2026
  assert.equal(addCalendarDaysIso('2026-08-19', 93), '2026-11-19');
  assert.equal(countCalendarDaysBetweenIso('2026-08-19', '2026-11-19'), 93);

  // 2026-11-01 + 30 calendar days (Day 1 = 01 Nov) => 2026-11-30
  assert.equal(addCalendarDaysIso('2026-11-01', 30), '2026-11-30');
  // 2026-11-06 + 1 calendar day (same day) => 2026-11-06
  assert.equal(addCalendarDaysIso('2026-11-06', 1), '2026-11-06');
  // Month rollover: 2026-11-28 + 5 calendar days => 2026-12-02 (Nov 28,29,30, Dec 1,2)
  assert.equal(addCalendarDaysIso('2026-11-28', 5), '2026-12-02');
  // Leap year check: 2024-02-28 + 3 calendar days => 2024-03-01 (Feb 28, Feb 29, Mar 1)
  assert.equal(addCalendarDaysIso('2024-02-28', 3), '2024-03-01');
  // Invalid inputs return empty string
  assert.equal(addCalendarDaysIso('2026-11-02', 0), '');
  assert.equal(addCalendarDaysIso('', 5), '');

  assert.equal(countCalendarDaysBetweenIso('2026-11-02', '2026-11-09'), 8);
  assert.equal(countCalendarDaysBetweenIso('2026-11-02', '2026-11-02'), 1);
  assert.equal(
    getPaketDurasiHariKerja({
      tanggalMulai: '2026-11-02',
      tenggatWaktu: '2026-11-09',
      durasiHariKerja: undefined,
    }),
    8
  );
  assert.equal(
    getPaketDurasiHariKerja({
      tanggalMulai: '2026-11-02',
      tenggatWaktu: '2026-11-09',
      durasiHariKerja: 12,
    }),
    12
  );

  assert.equal(formatTanggalDisplay('2000-01-01'), '1 Januari 2000');
  assert.equal(formatTanggalDisplay('2026-08-19'), '19 Agustus 2026');
  assert.equal(formatTanggalDisplay('2026-11-19'), '19 November 2026');
  assert.equal(formatTanggalDdMmYyyy('2026-08-19'), '19-08-2026');
  assert.equal(formatTanggalDdMmYyyy('2026-11-19'), '19-11-2026');

  assert.deepEqual(SKEMA_KONTRAK_LIST, ['Lump Sum', 'Waktu Penugasan']);
  assert.deepEqual(STATUS_PENCAIRAN_LIST, ['Belum', 'Sudah']);
  assert.deepEqual(MEKANISME_PENCAIRAN_LIST, [
    'Langsung (LS)',
    'Ganti Uang Persediaan (GU)',
    'Tambahan Uang Persediaan (TU)',
  ]);
});

test('validatePaketPekerjaanInput rejects invalid dates, durasiHariKerja, budgets, and empty stages', () => {
  const validStages = buildTemplateTahapan('Perorangan');

  assert.equal(
    validatePaketPekerjaanInput({
      namaKegiatan: '',
      subKegiatan: 'Sub A',
      jenisPelaksanaan: 'Perorangan',
      nilaiAnggaran: 10000000,
      tanggalMulai: '2026-11-01',
      durasiHariKerja: 10,
      tenggatWaktu: '2026-11-11',
      tahapan: validStages,
    }),
    'Nama Kegiatan wajib diisi.'
  );

  assert.equal(
    validatePaketPekerjaanInput({
      namaKegiatan: 'Keg A',
      subKegiatan: 'Sub A',
      jenisPelaksanaan: 'Perorangan',
      nilaiAnggaran: 10000000,
      tanggalMulai: '2026-11-02',
      durasiHariKerja: 0,
      tenggatWaktu: '',
      tahapan: validStages,
    }),
    'Durasi pelaksanaan wajib diisi minimal 1 hari kalender.'
  );

  assert.equal(
    validatePaketPekerjaanInput({
      namaKegiatan: 'Keg A',
      subKegiatan: 'Sub A',
      jenisPelaksanaan: 'Perorangan',
      nilaiAnggaran: 10000000,
      tanggalMulai: '2026-11-02',
      durasiHariKerja: 2000,
      tenggatWaktu: '2032-04-21',
      tahapan: validStages,
    }),
    'Durasi pelaksanaan maksimal 1.825 hari kalender.'
  );

  assert.equal(
    validatePaketPekerjaanInput({
      namaKegiatan: 'Keg A',
      subKegiatan: 'Sub A',
      jenisPelaksanaan: 'Perorangan',
      nilaiAnggaran: 10000000,
      tanggalMulai: '2026-11-15',
      durasiHariKerja: 5,
      tenggatWaktu: '2026-11-01',
      tahapan: validStages,
    }),
    'Tanggal Selesai tidak boleh lebih awal daripada Tanggal Mulai.'
  );

  assert.equal(
    validatePaketPekerjaanInput({
      namaKegiatan: 'Keg A',
      subKegiatan: 'Sub A',
      jenisPelaksanaan: 'Perorangan',
      nilaiAnggaran: 10000000,
      tanggalMulai: '2026-11-01',
      durasiHariKerja: 22,
      tenggatWaktu: '2026-12-01',
      tahapan: [],
    }),
    'Minimal harus terdapat 1 tahapan dalam alur kerja paket pekerjaan.'
  );

  assert.equal(
    validatePaketPekerjaanInput({
      namaKegiatan: 'Keg A',
      subKegiatan: 'Sub A',
      jenisPelaksanaan: 'Perorangan',
      tahunAnggaran: 1995,
      nilaiAnggaran: 10000000,
      tanggalMulai: '2026-11-01',
      durasiHariKerja: 22,
      tenggatWaktu: '2026-12-01',
      tahapan: validStages,
    }),
    'Tahun Anggaran harus berupa tahun valid (2000–2100).'
  );

  assert.equal(
    validatePaketPekerjaanInput({
      namaKegiatan: 'Keg A',
      subKegiatan: 'Sub A',
      jenisPelaksanaan: 'Swakelola/Rutin' as JenisPelaksanaan,
      tahunAnggaran: 2026,
      nilaiAnggaran: 10000000,
      tanggalMulai: '2026-11-01',
      durasiHariKerja: 22,
      tenggatWaktu: '2026-12-01',
      tahapan: validStages,
    }),
    'Jenis Pelaksanaan tidak valid.'
  );

  assert.equal(
    validatePaketPekerjaanInput({
      namaKegiatan: 'Keg A',
      subKegiatan: 'Sub A',
      jenisPelaksanaan: 'Perorangan',
      skemaKontrak: 'Turnkey' as SkemaKontrak,
      tahunAnggaran: 2026,
      nilaiAnggaran: 10000000,
      tanggalMulai: '2026-11-01',
      durasiHariKerja: 22,
      tenggatWaktu: '2026-11-22',
      tahapan: validStages,
    }),
    'Skema Kontrak tidak valid.'
  );

  assert.equal(
    validatePaketPekerjaanInput({
      namaKegiatan: 'Keg A',
      subKegiatan: 'Sub A',
      jenisPelaksanaan: 'Perorangan',
      tahunAnggaran: 2026,
      nilaiAnggaran: 10000000,
      hps: -500,
      tanggalMulai: '2026-11-01',
      durasiHariKerja: 22,
      tenggatWaktu: '2026-11-22',
      tahapan: validStages,
    }),
    'Harga Perkiraan Sendiri (HPS) harus berupa angka bernilai 0 atau lebih.'
  );

  assert.equal(
    validatePaketPekerjaanInput({
      namaKegiatan: 'Keg A',
      subKegiatan: 'Sub A',
      jenisPelaksanaan: 'Perorangan',
      tahunAnggaran: 2026,
      nilaiAnggaran: 10000000,
      nilaiKontrak: -1,
      tanggalMulai: '2026-11-01',
      durasiHariKerja: 22,
      tenggatWaktu: '2026-11-22',
      tahapan: validStages,
    }),
    'Nilai Kontrak / Realisasi harus berupa angka bernilai 0 atau lebih.'
  );

  assert.equal(
    validatePaketPekerjaanInput({
      namaKegiatan: 'Keg A',
      subKegiatan: 'Sub A',
      jenisPelaksanaan: 'Perorangan',
      tahunAnggaran: 2026,
      nilaiAnggaran: 10000000,
      statusPencairan: 'Proses' as StatusPencairan,
      tanggalMulai: '2026-11-01',
      durasiHariKerja: 22,
      tenggatWaktu: '2026-11-22',
      tahapan: validStages,
    }),
    'Status Tahapan Pencairan tidak valid.'
  );

  assert.equal(
    validatePaketPekerjaanInput({
      namaKegiatan: 'Keg A',
      subKegiatan: 'Sub A',
      jenisPelaksanaan: 'Perorangan',
      tahunAnggaran: 2026,
      nilaiAnggaran: 10000000,
      mekanismePencairan: 'UP' as MekanismePencairan,
      tanggalMulai: '2026-11-01',
      durasiHariKerja: 22,
      tenggatWaktu: '2026-11-22',
      tahapan: validStages,
    }),
    'Mekanisme Pencairan tidak valid.'
  );

  assert.equal(
    validatePaketPekerjaanInput({
      namaKegiatan: 'Keg A',
      subKegiatan: 'Sub A',
      jenisPelaksanaan: 'Perorangan',
      skemaKontrak: 'Lump Sum',
      tahunAnggaran: 2026,
      nilaiAnggaran: 10000000,
      hps: 9500000,
      nilaiKontrak: 9200000,
      tanggalMulai: '2026-11-01',
      durasiHariKerja: 22,
      tenggatWaktu: '2026-11-22',
      statusPencairan: 'Sudah',
      mekanismePencairan: 'Langsung (LS)',
      tahapan: validStages,
    }),
    null
  );
});

test('computePaketProgress derives percentage, overdue detection, and completed state accurately', () => {
  const base: PaketPekerjaan = {
    id: 'pkt-1',
    namaKegiatan: 'Kegiatan Pengawasan',
    subKegiatan: 'Jasa Konsultansi Perorangan',
    jenisPelaksanaan: 'Perorangan',
    nilaiAnggaran: 50000000,
    tanggalMulai: '2026-11-01',
    tenggatWaktu: '2026-11-30',
    tahapan: [
      { id: 't1', urutan: 1, nama: 'Persiapan & SPK', status: 'selesai' },
      { id: 't2', urutan: 2, nama: 'Laporan Pendahuluan', status: 'sedang_berjalan' },
      { id: 't3', urutan: 3, nama: 'Laporan Akhir & BAST', status: 'belum_mulai' },
    ],
    dibuatOlehId: 'p-ketua',
    dibuatOlehNama: 'Yuliani, ST',
    createdAt: '2026-11-01',
    updatedAt: '2026-11-01',
  };

  // 1 selesai (1.0) + 1 sedang_berjalan (0.5) / 3 = 50%
  const active = computePaketProgress(base, '2026-11-24');
  assert.equal(active.persentase, 50);
  assert.equal(active.overallStatus, 'sedang_berjalan');
  assert.equal(active.isNearDeadline, true);
  assert.equal(active.isOverdue, false);
  assert.equal(active.daysRemaining, 6);
  assert.equal(active.activeStage?.nama, 'Laporan Pendahuluan');

  // Overdue when today > tenggatWaktu
  const overdue = computePaketProgress(base, '2026-12-03');
  assert.equal(overdue.overallStatus, 'terlambat');
  assert.equal(overdue.isOverdue, true);
  assert.equal(overdue.deadlineLabel, 'Lewat 3 hari');

  // Completed when all stages are selesai
  const completed = computePaketProgress(
    {
      ...base,
      tanggalSelesai: '2026-11-28',
      tahapan: base.tahapan.map((t) => ({ ...t, status: 'selesai' })),
    },
    '2026-12-03'
  );
  assert.equal(completed.persentase, 100);
  assert.equal(completed.overallStatus, 'selesai');
  assert.equal(completed.isOverdue, false);
});

test('filterPaketPekerjaan, calculatePekerjaanStats, Tahun Anggaran summaries, and CSV export behave consistently', () => {
  const list: PaketPekerjaan[] = [
    {
      id: 'pkt-1',
      namaKegiatan: 'Kajian Teknis A',
      subKegiatan: 'Penyusunan Dokumen',
      pekerjaan: 'Pengawasan Pembangunan Perumahan Wilayah Barat',
      jenisPelaksanaan: 'Perorangan',
      skemaKontrak: 'Lump Sum',
      tahunAnggaran: 2025,
      nilaiAnggaran: 45000000,
      hps: 44000000,
      nilaiKontrak: 43500000,
      tanggalMulai: '2025-11-01',
      tenggatWaktu: '2025-12-10',
      statusPencairan: 'Sudah',
      mekanismePencairan: 'Langsung (LS)',
      kodeRup: '51234567',
      penyedia: 'Tenaga Ahli Sipil',
      tahapan: [
        { id: '1', urutan: 1, nama: 'Persiapan & SPK', status: 'selesai' },
        { id: '2', urutan: 2, nama: 'Laporan Akhir & BAST', status: 'selesai' },
      ],
      dibuatOlehId: 'p1',
      dibuatOlehNama: 'Yuliani',
      createdAt: '2025-11-01',
      updatedAt: '2025-11-01',
    },
    {
      id: 'pkt-2',
      namaKegiatan: 'Perbaikan Drainase B',
      subKegiatan: 'Konsultansi Badan Usaha',
      jenisPelaksanaan: 'Badan Usaha',
      skemaKontrak: 'Waktu Penugasan',
      tahunAnggaran: 2026,
      nilaiAnggaran: 155000000,
      hps: 150000000,
      nilaiKontrak: 148000000,
      tanggalMulai: '2026-11-05',
      tenggatWaktu: '2026-11-20',
      statusPencairan: 'Belum',
      mekanismePencairan: 'Ganti Uang Persediaan (GU)',
      tahapan: [
        { id: '1', urutan: 1, nama: 'Rapat Persiapan/PCM', status: 'sedang_berjalan' },
        { id: '2', urutan: 2, nama: 'Laporan Pendahuluan', status: 'belum_mulai' },
      ],
      dibuatOlehId: 'p1',
      dibuatOlehNama: 'Yuliani',
      createdAt: '2026-11-05',
      updatedAt: '2026-11-05',
    },
  ];

  assert.deepEqual(getAvailableTahunAnggaran(list), [2026, 2025]);
  assert.equal(getPaketTahunAnggaran({ tahunAnggaran: undefined, tanggalMulai: '2024-03-15' }), 2024);

  const ta2025 = filterPaketPekerjaan(list, { tahunAnggaran: 2025 }, '2026-11-24');
  assert.equal(ta2025.length, 1);
  assert.equal(ta2025[0].id, 'pkt-1');

  const summaries = summarizePaketByTahunAnggaran(list, '2026-11-24');
  assert.equal(summaries.length, 2);
  assert.equal(summaries[0].tahunAnggaran, 2026);
  assert.equal(summaries[0].totalAnggaran, 155000000);
  assert.equal(summaries[1].tahunAnggaran, 2025);
  assert.equal(summaries[1].persentaseRealisasiAnggaran, 100);

  const stats = calculatePekerjaanStats(list, '2026-11-24');
  assert.equal(stats.totalPaket, 2);
  assert.equal(stats.totalAnggaran, 200000000);
  assert.equal(stats.totalHps, 194000000);
  assert.equal(stats.totalNilaiKontrak, 191500000);
  assert.equal(stats.anggaranSelesai, 45000000);
  assert.equal(stats.selesai, 1);
  assert.equal(stats.terlambat, 1);

  const filtered = filterPaketPekerjaan(
    list,
    { searchQuery: 'Drainase', status: 'terlambat' },
    '2026-11-24'
  );
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 'pkt-2');

  const byPencairan = filterPaketPekerjaan(list, { statusPencairan: 'Sudah' }, '2026-11-24');
  assert.equal(byPencairan.length, 1);
  assert.equal(byPencairan[0].id, 'pkt-1');

  const byRup = filterPaketPekerjaan(list, { searchQuery: '51234567' }, '2026-11-24');
  assert.equal(byRup.length, 1);
  assert.equal(byRup[0].id, 'pkt-1');

  const byPekerjaan = filterPaketPekerjaan(list, { searchQuery: 'Wilayah Barat' }, '2026-11-24');
  assert.equal(byPekerjaan.length, 1);
  assert.equal(byPekerjaan[0].id, 'pkt-1');

  const csv = buildPekerjaanCsvContent(list, '2026-11-24');
  assert.equal(csv.includes('Tahun Anggaran'), true);
  assert.equal(csv.includes('Pekerjaan'), true);
  assert.equal(csv.includes('Skema Kontrak'), true);
  assert.equal(csv.includes('Lump Sum'), true);
  assert.equal(csv.includes('Waktu Penugasan'), true);
  assert.equal(csv.includes('Pengawasan Pembangunan Perumahan Wilayah Barat'), true);
  assert.equal(csv.includes('Pagu Anggaran (Rp)'), true);
  assert.equal(csv.includes('Harga Perkiraan Sendiri / HPS (Rp)'), true);
  assert.equal(csv.includes('Nilai Kontrak / Realisasi (Rp)'), true);
  assert.equal(csv.includes('Tahapan Pencairan'), true);
  assert.equal(csv.includes('Mekanisme Pencairan'), true);
  assert.equal(csv.includes('Langsung (LS)'), true);
  assert.equal(csv.includes('1 November 2025'), true);
  assert.equal(csv.includes('Kode RUP'), true);
  assert.equal(csv.includes('51234567'), true);
  assert.equal(csv.includes('2025'), true);
  assert.equal(csv.includes('Durasi (Hari Kalender)'), true);
  assert.equal(csv.includes('Tanggal Selesai'), true);
  assert.equal(csv.includes('Kajian Teknis A'), true);
  assert.equal(csv.includes('Badan Usaha'), true);

  assert.equal(stats.sudahCairCount, 1);
  assert.equal(stats.belumCairCount, 1);
  assert.equal(stats.efisiensiKontrakVsHps, 2500000);

  const bySkema = filterPaketPekerjaan(list, { skemaKontrak: 'Waktu Penugasan' }, '2026-11-24');
  assert.equal(bySkema.length, 1);
  assert.equal(bySkema[0].id, 'pkt-2');

  const byMekanisme = filterPaketPekerjaan(
    list,
    { mekanismePencairan: 'Ganti Uang Persediaan (GU)' },
    '2026-11-24'
  );
  assert.equal(byMekanisme.length, 1);
  assert.equal(byMekanisme[0].id, 'pkt-2');

  const listWithPic: PaketPekerjaan[] = [
    { ...list[0], picNama: 'Wahyudi, ST' },
    { ...list[1], picNama: 'Chafidz Ginanjar, ST' },
  ];
  assert.deepEqual(getAvailablePicNames(listWithPic), ['Chafidz Ginanjar, ST', 'Wahyudi, ST']);
  const byPic = filterPaketPekerjaan(listWithPic, { picNama: 'Wahyudi, ST' }, '2026-11-24');
  assert.equal(byPic.length, 1);
  assert.equal(byPic[0].id, 'pkt-1');
});
