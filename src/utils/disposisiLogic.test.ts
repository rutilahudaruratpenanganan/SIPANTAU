import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TAHAP_TINDAK_LANJUT,
  getNextStage,
  getPrevStage,
  canAdvanceStage,
  canDeleteSurat,
  canManagePersonel,
  filterSurat,
  calculateDashboardStats,
} from './disposisiLogic.ts';
import type { SuratMasuk, Personel } from '../types/index.ts';

const mockPersonel: Personel[] = [
  { id: '1', nama: 'Ir. H. Budi Santoso, S.T., M.T.', jabatan: 'Ketua Tim Wasdal', peran: 'ketua_tim', isKetuaTim: true },
  { id: '2', nama: 'Chafidz', jabatan: 'Staf Wasdal Perumahan', peran: 'staf' },
  { id: '3', nama: 'Eva', jabatan: 'Staf Wasdal Perumahan', peran: 'staf' },
  { id: '4', nama: 'Eryanti', jabatan: 'Staf Wasdal Perumahan', peran: 'staf' },
];

const mockSurat: SuratMasuk[] = [
  {
    id: 's1',
    nomorAgenda: 'AG/2026/101',
    nomorSurat: '001/SS/XI/2026',
    tanggalSurat: '2026-11-02',
    tanggalDiterima: '2026-11-03',
    asalSurat: 'Sudirman Suite',
    perihal: 'Permohonan Surat Keterangan Penegasan Status Hukum PPPSRS Non NIB',
    sifat: 'Penting',
    tanggalDisposisi: '2026-11-06',
    penerimaDisposisiIds: ['2'],
    penerimaDisposisiNama: ['Chafidz'],
    instruksiDisposisi: 'Segera telaah dan siapkan konsep naskah pertimbangan hukum.',
    tahapSaatIni: 7,
    statusSelesai: false,
    riwayatTindakLanjut: [],
    createdAt: '2026-11-03',
    updatedAt: '2026-11-10',
  },
  {
    id: 's2',
    nomorAgenda: 'AG/2026/102',
    nomorSurat: '45/BCW/X/2026',
    tanggalSurat: '2026-10-26',
    tanggalDiterima: '2026-10-27',
    asalSurat: 'Ir. Max Bambang Sumantri',
    perihal: 'Pengaduan pelanggaran perwal no. 543/2018',
    sifat: 'Segera',
    tanggalDisposisi: '2026-11-06',
    penerimaDisposisiIds: ['2', '3'],
    penerimaDisposisiNama: ['Chafidz', 'Eva'],
    tahapSaatIni: 4,
    statusSelesai: false,
    riwayatTindakLanjut: [],
    createdAt: '2026-10-27',
    updatedAt: '2026-11-09',
  },
  {
    id: 's3',
    nomorAgenda: 'AG/2026/103',
    nomorSurat: 'PKP/2026/89',
    tanggalSurat: '2026-10-28',
    tanggalDiterima: '2026-10-29',
    asalSurat: 'Kementerian PKP',
    perihal: 'Penjaringan masukan Rancangan Peraturan Menteri PKP',
    sifat: 'Biasa',
    tanggalDisposisi: '2026-11-06',
    penerimaDisposisiIds: ['3'],
    penerimaDisposisiNama: ['Eva'],
    tahapSaatIni: 3,
    statusSelesai: true,
    fileSuratKeluar: {
      nama: 'Surat_Jawaban_Menteri_PKP.pdf',
      ukuran: '1.4 MB',
      tipe: 'application/pdf',
      tanggalUnggah: '2026-11-10',
      pengunggah: 'Eva',
    },
    riwayatTindakLanjut: [],
    createdAt: '2026-10-29',
    updatedAt: '2026-11-10',
  },
];

test('TAHAP_TINDAK_LANJUT contains exact 7 mandated stages', () => {
  assert.equal(Object.keys(TAHAP_TINDAK_LANJUT).length, 7);
  assert.equal(TAHAP_TINDAK_LANJUT[1].nama, 'Disposisi Diterima Dari Kepala Bidang Perumahan');
  assert.equal(TAHAP_TINDAK_LANJUT[2].nama, 'Diterima Ketua Tim Pengawasan dan Pengendalian Perumahan');
  assert.equal(TAHAP_TINDAK_LANJUT[3].nama, 'Disposisi Tim Pengawasan dan Pengendalian Perumahan');
  assert.equal(TAHAP_TINDAK_LANJUT[4].nama, 'Pembuatan Draft Tanggapan/Jawaban/Surat');
  assert.equal(TAHAP_TINDAK_LANJUT[5].nama, 'Asistensi Ketua Tim Pengawasan dan Pengendalian Perumahan');
  assert.equal(TAHAP_TINDAK_LANJUT[6].nama, 'Asistensi Kepala Bidang Perumahan');
  assert.equal(TAHAP_TINDAK_LANJUT[7].nama, 'Proses PESONA');
});

test('stage transitions work sequentially', () => {
  assert.equal(getNextStage(1), 2);
  assert.equal(getNextStage(6), 7);
  assert.equal(getNextStage(7), null);

  assert.equal(getPrevStage(7), 6);
  assert.equal(getPrevStage(2), 1);
  assert.equal(getPrevStage(1), null);
});

test('role-based access control enforces restrictions', () => {
  // Ketua Tim has full privileges
  assert.equal(canAdvanceStage('ketua_tim', 1), true);
  assert.equal(canAdvanceStage('ketua_tim', 6), true);
  assert.equal(canDeleteSurat('ketua_tim'), true);
  assert.equal(canManagePersonel('ketua_tim'), true);

  // Staf has restricted privileges
  assert.equal(canDeleteSurat('staf'), false);
  assert.equal(canManagePersonel('staf'), false);
  // Staf can advance stage 4 (Drafting to Asistensi Ketua Tim)
  assert.equal(canAdvanceStage('staf', 4), true);
  // Staf cannot advance stage 1 (Diterima Kabid)
  assert.equal(canAdvanceStage('staf', 1), false);
});

test('filterSurat correctly filters by search query and filters', () => {
  // Search by keyword
  const searchSudirman = filterSurat(mockSurat, { searchQuery: 'Sudirman' });
  assert.equal(searchSudirman.length, 1);
  assert.equal(searchSudirman[0].asalSurat, 'Sudirman Suite');

  // Filter by personel Chafidz
  const chafidzSurat = filterSurat(mockSurat, { personelName: 'Chafidz' });
  assert.equal(chafidzSurat.length, 2);

  // Filter by status selesai
  const selesaiSurat = filterSurat(mockSurat, { status: 'selesai' });
  assert.equal(selesaiSurat.length, 1);
  assert.equal(selesaiSurat[0].id, 's3');

  // Filter by tahap 7 (PESONA)
  const pesonaSurat = filterSurat(mockSurat, { tahapId: 7 });
  assert.equal(pesonaSurat.length, 1);
  assert.equal(pesonaSurat[0].id, 's1');
});

test('calculateDashboardStats produces accurate summary data including totalPerluDisposisi', () => {
  const stats = calculateDashboardStats(mockSurat, mockPersonel);
  assert.equal(stats.totalSurat, 3);
  assert.equal(stats.totalAktif, 2);
  assert.equal(stats.totalSelesai, 1);
  assert.equal(stats.totalPerluDisposisi, 0); // all mockSurat have penerimaDisposisiIds
  assert.equal(stats.tahapCounts[7], 1);
  assert.equal(stats.tahapCounts[4], 1);
  assert.equal(stats.tahapCounts[3], 1);
  assert.equal(stats.totalDenganSuratKeluar, 1);
  assert.equal(stats.totalDalamPesona, 1);
  assert.equal(stats.totalDraftDanAsistensi, 1); // 1 item at stage 4

  // Test with an undisposed new surat
  const suratBaru: SuratMasuk = {
    id: 's4',
    nomorAgenda: 'AG/2026/104',
    nomorSurat: '99/DPKP/2026',
    tanggalSurat: '2026-11-10',
    tanggalDiterima: '2026-11-11',
    asalSurat: 'Dinas Cipta Karya',
    perihal: 'Koordinasi PSU',
    sifat: 'Biasa',
    penerimaDisposisiIds: [],
    penerimaDisposisiNama: [],
    tahapSaatIni: 1,
    statusSelesai: false,
    riwayatTindakLanjut: [],
    createdAt: '2026-11-11',
    updatedAt: '2026-11-11',
  };

  const statsWithNew = calculateDashboardStats([...mockSurat, suratBaru], mockPersonel);
  assert.equal(statsWithNew.totalSurat, 4);
  assert.equal(statsWithNew.totalAktif, 3);
  assert.equal(statsWithNew.totalPerluDisposisi, 1);

  // Test filter perlu_disposisi
  const perluDisposisiList = filterSurat([...mockSurat, suratBaru], { tahapId: 'perlu_disposisi' });
  assert.equal(perluDisposisiList.length, 1);
  assert.equal(perluDisposisiList[0].id, 's4');
});

test('personel deletion preserves ketua_tim and handles active user fallback', () => {
  const list: Personel[] = [
    { id: 'p1', nama: 'Ketua Wasdal', jabatan: 'Ketua Tim', peran: 'ketua_tim', isKetuaTim: true },
    { id: 'p2', nama: 'Staf A', jabatan: 'Staf Wasdal', peran: 'staf' },
    { id: 'p3', nama: 'Staf B', jabatan: 'Staf Wasdal', peran: 'staf' },
  ];

  // Deleting Staf A (p2)
  const remainingAfterP2 = list.filter((p) => p.id !== 'p2');
  assert.equal(remainingAfterP2.length, 2);
  assert.equal(remainingAfterP2.find((p) => p.id === 'p2'), undefined);

  // Fallback when active user is deleted
  let currentUser = list.find((p) => p.id === 'p2')!;
  if (currentUser.id === 'p2') {
    currentUser = remainingAfterP2.find((p) => p.isKetuaTim || p.peran === 'ketua_tim') || remainingAfterP2[0];
  }
  assert.equal(currentUser.id, 'p1');
  assert.equal(currentUser.nama, 'Ketua Wasdal');
});

test('filterSurat supports filtering by tahapId: selesai', () => {
  const selesaiSuratViaTahap = filterSurat(mockSurat, { tahapId: 'selesai' });
  assert.equal(selesaiSuratViaTahap.length, 1);
  assert.equal(selesaiSuratViaTahap[0].id, 's3');
  assert.equal(selesaiSuratViaTahap[0].statusSelesai, true);

  // When filtering by specific tahap 4
  const tahap4 = filterSurat(mockSurat, { tahapId: 4 });
  assert.equal(tahap4.length, 1);
  assert.equal(tahap4[0].id, 's2');
});

