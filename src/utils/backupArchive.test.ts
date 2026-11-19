import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
  getSuratSelesaiForBackup,
  sanitizeFileNameSegment,
  decodeDataUrlToBytes,
  buildSuratRiwayatHtml,
  buildBackupCsvSummary,
  createBackupZipBlob,
} from './backupArchive.ts';
import { INITIAL_PEJABAT } from '../data/initialData.ts';
import type { SuratMasuk } from '../types/index.ts';

function encodePdfDataUrl(text: string): string {
  const raw = `%PDF-1.4\n% ${text}\n%%EOF\n`;
  const b64 = Buffer.from(raw, 'utf8').toString('base64');
  return `data:application/pdf;base64,${b64}`;
}

const sampleSuratList: SuratMasuk[] = [
  {
    id: 'surat-aktif-1',
    nomorSurat: '001/AKTIF/2026',
    tanggalSurat: '2026-11-10',
    tanggalDiterima: '2026-11-11',
    asalSurat: 'Pengembang A',
    perihal: 'Masih Berjalan',
    sifat: 'Biasa',
    penerimaDisposisiIds: ['p2'],
    penerimaDisposisiNama: ['Chafidz'],
    tahapSaatIni: 4,
    statusSelesai: false,
    riwayatTindakLanjut: [],
    createdAt: '2026-11-11',
    updatedAt: '2026-11-11',
  },
  {
    id: 'surat-selesai-1',
    nomorSurat: '002/SLS/XI/2026',
    tanggalSurat: '2026-11-01',
    tanggalDiterima: '2026-11-02',
    asalSurat: 'PT Graha Mandiri',
    perihal: 'Permohonan Penegasan Status PPPSRS',
    sifat: 'Penting',
    tanggalDisposisi: '2026-11-03',
    penerimaDisposisiIds: ['p2', 'p3'],
    penerimaDisposisiNama: ['Chafidz', 'Eva'],
    instruksiDisposisi: 'Pelajari berkas dan siapkan surat jawaban resmi.',
    catatanDisposisiKetuaTim: 'Prioritaskan minggu ini.',
    tenggatWaktu: '2026-11-10',
    tahapSaatIni: 7,
    statusSelesai: true,
    tanggalSelesai: '2026-11-09',
    riwayatTindakLanjut: [
      {
        id: 'r1',
        tahapId: 1,
        tahapNama: 'Disposisi Diterima Dari Kepala Bidang Perumahan',
        tanggal: '2026-11-02 09:00',
        aktor: 'Kabid Perumahan',
        catatan: 'Diterima dari Kabid.',
      },
      {
        id: 'r2',
        tahapId: 3,
        tahapNama: 'Disposisi Tim Pengawasan dan Pengendalian Perumahan',
        tanggal: '2026-11-03 10:15',
        aktor: 'Yuliani, ST',
        catatan: 'Didisposisikan ke Chafidz & Eva.',
      },
      {
        id: 'r3',
        tahapId: 7,
        tahapNama: 'Selesai Tindak Lanjut',
        tanggal: '2026-11-09 15:30',
        aktor: 'Eva',
        catatan: 'Surat keluar ditandatangani PESONA.',
      },
    ],
    fileSuratMasuk: {
      nama: 'Masuk_Graha.pdf',
      ukuran: '0.2 MB',
      tipe: 'application/pdf',
      tanggalUnggah: '2026-11-02 09:00',
      pengunggah: 'Yuliani, ST',
      dataUrl: encodePdfDataUrl('MASUK_GRAHA_BINARY'),
    },
    fileSuratKeluar: {
      nama: 'Keluar_Jawaban_Graha.pdf',
      ukuran: '0.3 MB',
      tipe: 'application/pdf',
      tanggalUnggah: '2026-11-09 15:30',
      pengunggah: 'Eva',
      dataUrl: encodePdfDataUrl('KELUAR_GRAHA_BINARY'),
    },
    nomorSuratKeluar: '503/WASDAL/099/DPKP',
    tanggalSuratKeluar: '2026-11-09',
    perihalSuratKeluar: 'Jawaban Resmi Permohonan PPPSRS',
    createdAt: '2026-11-02',
    updatedAt: '2026-11-09',
  },
  {
    id: 'surat-selesai-2',
    nomorSurat: '003/SLS/XI/2026',
    tanggalSurat: '2026-11-04',
    tanggalDiterima: '2026-11-04',
    asalSurat: 'Warga Komplek Melati',
    perihal: 'Pengaduan Fasos Fasum Selesai Tanpa Surat Keluar',
    sifat: 'Segera',
    tanggalDisposisi: '2026-11-05',
    penerimaDisposisiIds: ['p4'],
    penerimaDisposisiNama: ['Eryanti'],
    instruksiDisposisi: 'Verifikasi lapangan bersama pengurus RW.',
    tahapSaatIni: 4,
    statusSelesai: true,
    tanggalSelesai: '2026-11-12',
    riwayatTindakLanjut: [
      {
        id: 'r21',
        tahapId: 4,
        tahapNama: 'Selesai Tindak Lanjut',
        tanggal: '2026-11-12 11:00',
        aktor: 'Eryanti',
        catatan: 'Berita acara musyawarah lapangan selesai.',
      },
    ],
    fileSuratMasuk: {
      nama: 'Pengaduan_Melati.pdf',
      ukuran: '0.1 MB',
      tipe: 'application/pdf',
      tanggalUnggah: '2026-11-04 08:30',
      pengunggah: 'Yuliani, ST',
      dataUrl: encodePdfDataUrl('MASUK_MELATI_BINARY'),
    },
    createdAt: '2026-11-04',
    updatedAt: '2026-11-12',
  },
];

test('getSuratSelesaiForBackup filters only finished surat and sorts latest first', () => {
  const result = getSuratSelesaiForBackup(sampleSuratList);
  assert.equal(result.length, 2);
  assert.equal(result[0].id, 'surat-selesai-2');
  assert.equal(result[1].id, 'surat-selesai-1');
});

test('sanitizeFileNameSegment strips unsafe characters and path traversal', () => {
  assert.equal(sanitizeFileNameSegment('../../503/WASDAL:2026?'), '503_WASDAL_2026');
  assert.equal(sanitizeFileNameSegment('   '), 'dokumen');
});

test('decodeDataUrlToBytes decodes base64 PDF dataUrl and rejects non-data URLs', () => {
  const decoded = decodeDataUrlToBytes(encodePdfDataUrl('HELLO_PDF'));
  assert.ok(decoded);
  assert.equal(decoded.mimeType, 'application/pdf');
  assert.ok(Buffer.from(decoded.bytes).toString('utf8').includes('HELLO_PDF'));

  assert.equal(decodeDataUrlToBytes('chunked://id/masuk/2/tok'), null);
  assert.equal(decodeDataUrlToBytes(undefined), null);
});

test('buildSuratRiwayatHtml includes disposition history, process logs, and optional surat keluar', () => {
  const htmlWithKeluar = buildSuratRiwayatHtml(sampleSuratList[1], INITIAL_PEJABAT);
  assert.ok(htmlWithKeluar.includes('Pelajari berkas dan siapkan surat jawaban resmi.'));
  assert.ok(htmlWithKeluar.includes('Didisposisikan ke Chafidz &amp; Eva.'));
  assert.ok(htmlWithKeluar.includes('503/WASDAL/099/DPKP'));
  assert.ok(htmlWithKeluar.includes('Jalan Caringin Nomor 103'));

  const htmlWithoutKeluar = buildSuratRiwayatHtml(sampleSuratList[2], INITIAL_PEJABAT);
  assert.ok(htmlWithoutKeluar.includes('Tidak ada dokumen surat keluar untuk berkas ini'));
});

test('buildBackupCsvSummary starts with UTF-8 BOM and lists finished entries', () => {
  const csv = buildBackupCsvSummary(getSuratSelesaiForBackup(sampleSuratList));
  assert.ok(csv.startsWith('\uFEFFNo,'));
  assert.ok(csv.includes('002/SLS/XI/2026'));
  assert.ok(csv.includes('003/SLS/XI/2026'));
  assert.equal(csv.includes('001/AKTIF/2026'), false);
});

test('createBackupZipBlob packages masuk PDF, history HTML/JSON, and conditional keluar PDF', async () => {
  const archive = await createBackupZipBlob({
    suratList: sampleSuratList,
    pejabatConfig: INITIAL_PEJABAT,
    exportedBy: 'Yuliani, ST',
    resolvePdfDataUrl: async (file) => file?.dataUrl,
  });

  assert.equal(archive.stats.totalSurat, 2);
  assert.equal(archive.stats.pdfMasukCount, 2);
  assert.equal(archive.stats.pdfKeluarCount, 1);
  assert.equal(archive.stats.metadataOnlyCount, 0);
  assert.match(archive.filename, /^Backup_Surat_Selesai_WASDAL_\d{4}-\d{2}-\d{2}\.zip$/);

  const buf = Buffer.from(await archive.blob.arrayBuffer());
  const loadedZip = await JSZip.loadAsync(buf);
  const fileNames = Object.keys(loadedZip.files);

  assert.ok(fileNames.includes('00_Daftar_Rekap_Backup.csv'));
  assert.ok(fileNames.includes('00_Backup_Manifest.json'));

  const masukPdfFiles = fileNames.filter((n) => n.includes('03_Surat_Masuk_') && n.endsWith('.pdf'));
  const keluarPdfFiles = fileNames.filter((n) => n.includes('04_Surat_Keluar_') && n.endsWith('.pdf'));
  const htmlFiles = fileNames.filter((n) => n.endsWith('01_Ringkasan_Disposisi_dan_Proses.html'));

  assert.equal(masukPdfFiles.length, 2);
  assert.equal(keluarPdfFiles.length, 1);
  assert.equal(htmlFiles.length, 2);

  const keluarPdfContent = await loadedZip.file(keluarPdfFiles[0])!.async('string');
  assert.ok(keluarPdfContent.includes('KELUAR_GRAHA_BINARY'));

  const manifestStr = await loadedZip.file('00_Backup_Manifest.json')!.async('string');
  const manifest = JSON.parse(manifestStr);
  assert.equal(manifest.totalSuratSelesai, 2);
  assert.equal(manifest.dieksportOleh, 'Yuliani, ST');
});
