import test from 'node:test';
import assert from 'node:assert/strict';
import {
  JENIS_PELAKSANAAN_LIST,
  TEMPLATE_TAHAPAN_PEKERJAAN,
  addCalendarDaysIso,
  buildPekerjaanCsvContent,
  buildTemplateTahapan,
  calculatePekerjaanStats,
  computePaketProgress,
  countCalendarDaysBetweenIso,
  filterPaketPekerjaan,
  formatRupiah,
  getAvailableTahunAnggaran,
  getPaketDurasiHariKerja,
  getPaketTahunAnggaran,
  normalizeTahapanOrder,
  parseRupiahInput,
  summarizePaketByTahunAnggaran,
  validatePaketPekerjaanInput,
} from './pekerjaanLogic.ts';
import type { JenisPelaksanaan, PaketPekerjaan } from '../types/index.ts';

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

test('Rupiah formatting and parsing handle Indonesian currency safely', () => {
  assert.equal(parseRupiahInput('Rp 125.000.000'), 125000000);
  assert.equal(parseRupiahInput(''), 0);
  const formatted = formatRupiah(125000000);
  assert.equal(formatted.includes('125.000.000'), true);
});

test('Calendar-days calculation includes weekends and handles month/leap-year rollovers accurately', () => {
  // 2026-11-02 (Monday) + 5 calendar days => 2026-11-07 (Saturday)
  assert.equal(addCalendarDaysIso('2026-11-02', 5), '2026-11-07');
  // 2026-11-06 (Friday) + 1 calendar day => 2026-11-07 (Saturday)
  assert.equal(addCalendarDaysIso('2026-11-06', 1), '2026-11-07');
  // Month rollover: 2026-11-28 + 5 calendar days => 2026-12-03
  assert.equal(addCalendarDaysIso('2026-11-28', 5), '2026-12-03');
  // Leap year check: 2024-02-28 + 2 calendar days => 2024-03-01
  assert.equal(addCalendarDaysIso('2024-02-28', 2), '2024-03-01');
  // Invalid inputs return empty string
  assert.equal(addCalendarDaysIso('2026-11-02', 0), '');
  assert.equal(addCalendarDaysIso('', 5), '');

  assert.equal(countCalendarDaysBetweenIso('2026-11-02', '2026-11-09'), 7);
  assert.equal(
    getPaketDurasiHariKerja({
      tanggalMulai: '2026-11-02',
      tenggatWaktu: '2026-11-09',
      durasiHariKerja: undefined,
    }),
    7
  );
  assert.equal(
    getPaketDurasiHariKerja({
      tanggalMulai: '2026-11-02',
      tenggatWaktu: '2026-11-09',
      durasiHariKerja: 12,
    }),
    12
  );
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
      tahunAnggaran: 2026,
      nilaiAnggaran: 10000000,
      tanggalMulai: '2026-11-01',
      durasiHariKerja: 22,
      tenggatWaktu: '2026-12-01',
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
      jenisPelaksanaan: 'Perorangan',
      tahunAnggaran: 2025,
      nilaiAnggaran: 45000000,
      tanggalMulai: '2025-11-01',
      tenggatWaktu: '2025-12-10',
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
      tahunAnggaran: 2026,
      nilaiAnggaran: 155000000,
      tanggalMulai: '2026-11-05',
      tenggatWaktu: '2026-11-20',
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

  const byRup = filterPaketPekerjaan(list, { searchQuery: '51234567' }, '2026-11-24');
  assert.equal(byRup.length, 1);
  assert.equal(byRup[0].id, 'pkt-1');

  const csv = buildPekerjaanCsvContent(list, '2026-11-24');
  assert.equal(csv.includes('Tahun Anggaran'), true);
  assert.equal(csv.includes('Kode RUP'), true);
  assert.equal(csv.includes('51234567'), true);
  assert.equal(csv.includes('2025'), true);
  assert.equal(csv.includes('Durasi (Hari Kalender)'), true);
  assert.equal(csv.includes('Tanggal Selesai'), true);
  assert.equal(csv.includes('Kajian Teknis A'), true);
  assert.equal(csv.includes('Badan Usaha'), true);
});
