import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRekapCsvContent,
  filterRekapSurat,
  formatRekapPeriodeLabel,
  getRekapStatusLabel,
} from './rekapLogic.ts';
import type { SuratMasuk } from '../types/index.ts';

const sampleSurat: SuratMasuk[] = [
  {
    id: 's1',
    nomorSurat: '001/TEST/2026',
    tanggalSurat: '2026-10-05',
    tanggalDiterima: '2026-10-06',
    tanggalDisposisi: '2026-10-07',
    asalSurat: 'Developer A',
    perihal: 'Permohonan Rekomendasi Siteplan',
    sifat: 'Penting',
    penerimaDisposisiIds: ['p-chafidz'],
    penerimaDisposisiNama: ['Chafidz Ginanjar, ST'],
    instruksiDisposisi: 'Telaah berkas',
    tahapSaatIni: 7,
    statusSelesai: true,
    tanggalSelesai: '2026-10-20',
    riwayatTindakLanjut: [
      {
        id: 'r1',
        tahapId: 1,
        tahapNama: 'Disposisi Diterima Dari Kepala Bidang Perumahan',
        tanggal: '2026-10-06 09:00',
        aktor: 'Kepala Bidang Perumahan',
        catatan: 'Disposisi naskah dinas masuk diterima dari Kepala Bidang Perumahan.',
      },
      {
        id: 'r2',
        tahapId: 7,
        tahapNama: 'Proses PESONA',
        tanggal: '2026-10-20 14:30',
        aktor: 'Chafidz Ginanjar, ST',
        catatan: 'Surat jawaban terbit.',
      },
    ],
    createdAt: '2026-10-06',
    updatedAt: '2026-10-20',
  },
  {
    id: 's2',
    nomorSurat: '002/TEST/2026',
    tanggalSurat: '2026-11-10',
    tanggalDiterima: '2026-11-11',
    tanggalDisposisi: '2026-11-12',
    asalSurat: 'PPPSRS B',
    perihal: 'Laporan Pengawasan Lapangan',
    sifat: 'Segera',
    penerimaDisposisiIds: ['p-eva'],
    penerimaDisposisiNama: ['Eva Faoziah Alli, ST'],
    instruksiDisposisi: 'Jadwalkan peninjauan',
    tahapSaatIni: 4,
    statusSelesai: false,
    riwayatTindakLanjut: [
      {
        id: 'r3',
        tahapId: 1,
        tahapNama: 'Disposisi Diterima Dari Kepala Bidang Perumahan',
        tanggal: '2026-11-11 08:15',
        aktor: 'Kepala Bidang Perumahan',
        catatan: 'Disposisi surat masuk diterima dari Kepala Bidang Perumahan.',
      },
    ],
    createdAt: '2026-11-11',
    updatedAt: '2026-11-12',
  },
  {
    id: 's3',
    nomorSurat: '003/TEST/2026',
    tanggalSurat: '2026-11-18',
    tanggalDiterima: '2026-11-19',
    asalSurat: 'Warga C',
    perihal: 'Pengaduan Fasilitas Umum',
    sifat: 'Biasa',
    penerimaDisposisiIds: [],
    penerimaDisposisiNama: [],
    tahapSaatIni: 1,
    statusSelesai: false,
    riwayatTindakLanjut: [],
    createdAt: '2026-11-19',
    updatedAt: '2026-11-19',
  },
];

test('filterRekapSurat filters by status selesai, dalam proses, and semua', () => {
  assert.equal(filterRekapSurat(sampleSurat, { status: 'all' }).length, 3);
  const selesai = filterRekapSurat(sampleSurat, { status: 'selesai' });
  assert.equal(selesai.length, 1);
  assert.equal(selesai[0].id, 's1');

  const aktif = filterRekapSurat(sampleSurat, { status: 'aktif' });
  assert.equal(aktif.length, 2);
  assert.deepEqual(
    aktif.map((s) => s.id),
    ['s2', 's3']
  );
});

test('filterRekapSurat filters by dateFrom and dateTo inclusively across date bases', () => {
  const novSurat = filterRekapSurat(sampleSurat, {
    status: 'all',
    dateFrom: '2026-11-01',
    dateTo: '2026-11-15',
    dateBasis: 'tanggalSurat',
  });
  assert.deepEqual(
    novSurat.map((s) => s.id),
    ['s2']
  );

  const openEnd = filterRekapSurat(sampleSurat, {
    status: 'aktif',
    dateFrom: '2026-11-10',
    dateBasis: 'tanggalSurat',
  });
  assert.deepEqual(
    openEnd.map((s) => s.id),
    ['s2', 's3']
  );

  // s3 has no tanggalDisposisi, so filtering by tanggalDisposisi with range excludes s3
  const disposisiFiltered = filterRekapSurat(sampleSurat, {
    status: 'all',
    dateFrom: '2026-10-01',
    dateTo: '2026-12-31',
    dateBasis: 'tanggalDisposisi',
  });
  assert.deepEqual(
    disposisiFiltered.map((s) => s.id),
    ['s1', 's2']
  );
});

test('formatRekapPeriodeLabel and getRekapStatusLabel return human-readable Indonesian labels', () => {
  assert.equal(getRekapStatusLabel('selesai'), 'Selesai Tindak Lanjut');
  assert.equal(getRekapStatusLabel('aktif'), 'Dalam Proses');
  assert.equal(formatRekapPeriodeLabel(), 'Semua Periode Tanggal');
  assert.equal(
    formatRekapPeriodeLabel('2026-11-01', '2026-11-19').includes('s.d.'),
    true
  );
});

test('buildRekapCsvContent includes complete normalized history when enabled', () => {
  const csv = buildRekapCsvContent([sampleSurat[0]], true);
  assert.equal(csv.startsWith('\uFEFF'), true);
  assert.equal(csv.includes('Riwayat Tindak Lanjut Lengkap'), true);
  assert.equal(
    csv.includes('Disposisi surat masuk diterima dari Kepala Bidang Perumahan.'),
    true
  );
  assert.equal(csv.includes('Surat jawaban terbit.'), true);
});
