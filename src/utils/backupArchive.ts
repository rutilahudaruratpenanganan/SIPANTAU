import JSZip from 'jszip';
import type { DokumenFile, PejabatConfig, SuratMasuk } from '../types/index.ts';
import { TAHAP_TINDAK_LANJUT } from './disposisiLogic.ts';

export interface DecodedBinaryFile {
  bytes: Uint8Array;
  mimeType: string;
}

export interface BackupProgress {
  processed: number;
  total: number;
  currentLabel: string;
}

export interface BackupArchiveResult {
  blob: Blob;
  filename: string;
  stats: {
    totalSurat: number;
    pdfMasukCount: number;
    pdfKeluarCount: number;
    metadataOnlyCount: number;
  };
}

export interface CreateBackupZipParams {
  suratList: SuratMasuk[];
  pejabatConfig: PejabatConfig;
  exportedBy: string;
  selectedIds?: Set<string>;
  resolvePdfDataUrl: (file: DokumenFile | undefined, suratId: string, kind: 'masuk' | 'keluar') => Promise<string | undefined>;
  onProgress?: (progress: BackupProgress) => void;
}

export function getSuratSelesaiForBackup(suratList: SuratMasuk[]): SuratMasuk[] {
  return suratList
    .filter((s) => Boolean(s.statusSelesai))
    .slice()
    .sort((a, b) => {
      const dateA = a.tanggalSelesai || a.tanggalSurat || '';
      const dateB = b.tanggalSelesai || b.tanggalSurat || '';
      const cmp = dateB.localeCompare(dateA);
      if (cmp !== 0) return cmp;
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    });
}

export function sanitizeFileNameSegment(input: string, maxLen = 48): string {
  const cleaned = (input || '')
    .normalize('NFKD')
    .replace(/[^\w\s.-]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '');
  if (!cleaned) return 'dokumen';
  return cleaned.slice(0, maxLen).replace(/[._-]+$/g, '') || 'dokumen';
}

export function decodeDataUrlToBytes(dataUrl?: string): DecodedBinaryFile | null {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    return null;
  }
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return null;

  const header = dataUrl.slice(5, commaIdx);
  const mimeMatch = header.match(/^([^;]+)/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'application/pdf';
  const isBase64 = header.includes(';base64');
  const body = dataUrl.slice(commaIdx + 1);
  if (!body) return null;

  try {
    if (!isBase64) {
      const decoded = decodeURIComponent(body);
      const bytes = new TextEncoder().encode(decoded);
      return bytes.length > 0 ? { bytes, mimeType } : null;
    }

    const cleanBase64 = body.replace(/\s+/g, '');
    let bytes: Uint8Array;
    if (typeof atob === 'function') {
      const binary = atob(cleanBase64);
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
    } else if (typeof Buffer !== 'undefined') {
      bytes = new Uint8Array(Buffer.from(cleanBase64, 'base64'));
    } else {
      return null;
    }
    return bytes.length > 0 ? { bytes, mimeType } : null;
  } catch {
    return null;
  }
}

function escapeHtml(value: string | undefined | null): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeCsvCell(value: string | number | undefined | null): string {
  const str = String(value ?? '');
  return `"${str.replace(/"/g, '""')}"`;
}

export function buildSuratRiwayatHtml(surat: SuratMasuk, pejabatConfig: PejabatConfig): string {
  const riwayat = surat.riwayatTindakLanjut || [];
  const tahapNama = TAHAP_TINDAK_LANJUT[surat.tahapSaatIni]?.nama || `Tahap ${surat.tahapSaatIni}`;

  const historyRowsHtml = riwayat.length > 0
    ? riwayat
        .map(
          (r, idx) => `
          <tr>
            <td style="text-align:center;">${idx + 1}</td>
            <td style="font-family:monospace;white-space:nowrap;">${escapeHtml(r.tanggal || '-')}</td>
            <td><strong>Tahap ${escapeHtml(String(r.tahapId))}</strong>: ${escapeHtml(r.tahapNama)}</td>
            <td>${escapeHtml(r.aktor || '-')}</td>
            <td>${escapeHtml(r.catatan || '-')}${r.fileLampiran ? `<br/><small>Lampiran: ${escapeHtml(r.fileLampiran.nama)} (${escapeHtml(r.fileLampiran.ukuran)})</small>` : ''}</td>
          </tr>`
        )
        .join('\n')
    : '<tr><td colspan="5" style="text-align:center;color:#64748b;">Tidak ada catatan riwayat proses.</td></tr>';

  const penerimaTags = surat.penerimaDisposisiNama && surat.penerimaDisposisiNama.length > 0
    ? surat.penerimaDisposisiNama.join(', ')
    : 'Belum tercatat penerima disposisi';

  const suratKeluarSection = (surat.fileSuratKeluar || surat.nomorSuratKeluar || surat.perihalSuratKeluar)
    ? `
      <section class="card">
        <h2>4. Dokumen & Data Surat Keluar</h2>
        <table class="meta">
          <tr><th>Nomor Surat Keluar</th><td>${escapeHtml(surat.nomorSuratKeluar || '-')}</td></tr>
          <tr><th>Tanggal Surat Keluar</th><td>${escapeHtml(surat.tanggalSuratKeluar || '-')}</td></tr>
          <tr><th>Perihal Surat Keluar</th><td>${escapeHtml(surat.perihalSuratKeluar || '-')}</td></tr>
          <tr><th>Berkas PDF Surat Keluar</th><td>${surat.fileSuratKeluar ? `${escapeHtml(surat.fileSuratKeluar.nama)} (${escapeHtml(surat.fileSuratKeluar.ukuran)} · Diunggah ${escapeHtml(surat.fileSuratKeluar.tanggalUnggah)} oleh ${escapeHtml(surat.fileSuratKeluar.pengunggah)})` : 'Tidak ada berkas terlampir'}</td></tr>
        </table>
      </section>`
    : `
      <section class="card">
        <h2>4. Dokumen & Data Surat Keluar</h2>
        <p class="muted">Tidak ada dokumen surat keluar untuk berkas ini (diselesaikan tanpa lampiran surat keluar).</p>
      </section>`;

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Arsip Surat Selesai - ${escapeHtml(surat.nomorSurat || surat.id)}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 28px auto; max-width: 920px; line-height: 1.5; font-size: 13px; }
    .kop { text-align: center; border-bottom: 3px double #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
    .kop h3 { margin: 0; font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; color: #334155; }
    .kop h1 { margin: 4px 0 2px; font-size: 16px; text-transform: uppercase; }
    .kop p { margin: 2px 0; font-size: 11px; color: #475569; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; background: #dcfce7; color: #166534; font-weight: bold; font-size: 11px; border: 1px solid #86efac; }
    .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px 16px; margin-bottom: 16px; background: #fff; }
    h2 { margin: 0 0 10px; font-size: 14px; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    table.meta th { width: 220px; text-align: left; padding: 6px 8px; background: #f8fafc; border: 1px solid #e2e8f0; color: #334155; vertical-align: top; }
    table.meta td { padding: 6px 8px; border: 1px solid #e2e8f0; vertical-align: top; }
    table.log th, table.log td { padding: 7px 8px; border: 1px solid #cbd5e1; vertical-align: top; }
    table.log th { background: #f1f5f9; text-align: left; }
    .muted { color: #64748b; font-style: italic; margin: 0; }
    .footer { margin-top: 20px; font-size: 11px; color: #64748b; display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 10px; }
  </style>
</head>
<body>
  <div class="kop">
    <h3>Pemerintah Kota Bandung</h3>
    <h1>${escapeHtml(pejabatConfig.kepalaDinas.instansi)}</h1>
    <p>Bidang Perumahan · Tim Pengawasan dan Pengendalian Perumahan (WASDAL)</p>
    <p>Jalan Caringin Nomor 103 Telp. (022) 5410403, Fax 5410403 · Email: dpkpkotabandung@gmail.com</p>
  </div>

  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
    <strong>ARSIP DIGITAL SURAT MASUK SELESAI (SIPANTAU-WASDAL)</strong>
    <span class="badge">STATUS: SELESAI TINDAK LANJUT</span>
  </div>

  <section class="card">
    <h2>1. Identitas Surat Masuk</h2>
    <table class="meta">
      <tr><th>Nomor Surat Masuk</th><td>${escapeHtml(surat.nomorSurat || '-')}</td></tr>
      <tr><th>Tanggal Surat</th><td>${escapeHtml(surat.tanggalSurat || '-')}</td></tr>
      <tr><th>Tanggal Diterima</th><td>${escapeHtml(surat.tanggalDiterima || '-')}</td></tr>
      <tr><th>Asal Surat / Pengirim</th><td>${escapeHtml(surat.asalSurat || '-')}</td></tr>
      <tr><th>Sifat Surat</th><td>${escapeHtml(surat.sifat || '-')}</td></tr>
      <tr><th>Perihal</th><td>${escapeHtml(surat.perihal || '-')}</td></tr>
      <tr><th>Tanggal Selesai</th><td>${escapeHtml(surat.tanggalSelesai || '-')} (Posisi akhir: Tahap ${escapeHtml(String(surat.tahapSaatIni))} - ${escapeHtml(tahapNama)})</td></tr>
      <tr><th>Berkas PDF Surat Masuk</th><td>${surat.fileSuratMasuk ? `${escapeHtml(surat.fileSuratMasuk.nama)} (${escapeHtml(surat.fileSuratMasuk.ukuran)} · Diunggah ${escapeHtml(surat.fileSuratMasuk.tanggalUnggah)} oleh ${escapeHtml(surat.fileSuratMasuk.pengunggah)})` : 'Tidak ada berkas'}</td></tr>
    </table>
  </section>

  <section class="card">
    <h2>2. History Disposisi Pendisposisi (Ketua Tim)</h2>
    <table class="meta">
      <tr><th>Pejabat Pendisposisi</th><td>${escapeHtml(pejabatConfig.ketuaTim.nama)} (NIP. ${escapeHtml(pejabatConfig.ketuaTim.nip)})</td></tr>
      <tr><th>Tanggal Disposisi</th><td>${escapeHtml(surat.tanggalDisposisi || '-')}</td></tr>
      <tr><th>Penerima Disposisi</th><td>${escapeHtml(penerimaTags)}</td></tr>
      <tr><th>Tenggat Waktu</th><td>${escapeHtml(surat.tenggatWaktu || 'Tidak ditentukan')}</td></tr>
      <tr><th>Instruksi Disposisi</th><td>${escapeHtml(surat.instruksiDisposisi || '-')}</td></tr>
      <tr><th>Catatan Khusus Ketua Tim</th><td>${escapeHtml(surat.catatanDisposisiKetuaTim || '-')}</td></tr>
    </table>
  </section>

  <section class="card">
    <h2>3. History Proses & Riwayat Tindak Lanjut</h2>
    <table class="log">
      <thead>
        <tr>
          <th style="width:40px;text-align:center;">No</th>
          <th style="width:130px;">Tanggal</th>
          <th style="width:230px;">Tahap Proses</th>
          <th style="width:160px;">Aktor</th>
          <th>Catatan / Progres</th>
        </tr>
      </thead>
      <tbody>
        ${historyRowsHtml}
      </tbody>
    </table>
  </section>

  ${suratKeluarSection}

  <div class="footer">
    <span>Dicadangkan via SIPANTAU-WASDAL · Akun Pendisposisi</span>
    <span>ID Dokumen: ${escapeHtml(surat.id)}</span>
  </div>
</body>
</html>`;
}

export function buildBackupCsvSummary(suratSelesai: SuratMasuk[]): string {
  const headers = [
    'No',
    'ID Dokumen',
    'Nomor Surat Masuk',
    'Tanggal Surat',
    'Tanggal Diterima',
    'Asal Surat',
    'Perihal',
    'Sifat',
    'Tanggal Disposisi',
    'Penerima Disposisi',
    'Instruksi Disposisi',
    'Catatan Khusus Disposisi',
    'Tenggat Waktu',
    'Tahap Akhir',
    'Tanggal Selesai',
    'Jumlah Log Proses',
    'Ringkasan History Proses',
    'Nama File Surat Masuk',
    'Nomor Surat Keluar',
    'Tanggal Surat Keluar',
    'Perihal Surat Keluar',
    'Nama File Surat Keluar',
  ];

  const rows = suratSelesai.map((s, idx) => {
    const prosesText = (s.riwayatTindakLanjut || [])
      .map((r) => `[${r.tanggal}] ${r.tahapNama} (${r.aktor}): ${r.catatan}`)
      .join(' | ');

    return [
      idx + 1,
      escapeCsvCell(s.id),
      escapeCsvCell(s.nomorSurat),
      escapeCsvCell(s.tanggalSurat),
      escapeCsvCell(s.tanggalDiterima),
      escapeCsvCell(s.asalSurat),
      escapeCsvCell(s.perihal),
      escapeCsvCell(s.sifat),
      escapeCsvCell(s.tanggalDisposisi || ''),
      escapeCsvCell((s.penerimaDisposisiNama || []).join(', ')),
      escapeCsvCell(s.instruksiDisposisi || ''),
      escapeCsvCell(s.catatanDisposisiKetuaTim || ''),
      escapeCsvCell(s.tenggatWaktu || ''),
      escapeCsvCell(`Tahap ${s.tahapSaatIni}: ${TAHAP_TINDAK_LANJUT[s.tahapSaatIni]?.nama || ''}`),
      escapeCsvCell(s.tanggalSelesai || ''),
      (s.riwayatTindakLanjut || []).length,
      escapeCsvCell(prosesText),
      escapeCsvCell(s.fileSuratMasuk?.nama || ''),
      escapeCsvCell(s.nomorSuratKeluar || ''),
      escapeCsvCell(s.tanggalSuratKeluar || ''),
      escapeCsvCell(s.perihalSuratKeluar || ''),
      escapeCsvCell(s.fileSuratKeluar?.nama || ''),
    ].join(',');
  });

  return '\uFEFF' + [headers.join(','), ...rows].join('\n');
}

export function buildBackupManifestJson(
  suratSelesai: SuratMasuk[],
  pejabatConfig: PejabatConfig,
  exportedBy: string
) {
  return {
    aplikasi: 'SIPANTAU-WASDAL',
    instansi: pejabatConfig.kepalaDinas.instansi,
    dieksportOleh: exportedBy,
    waktuBackupIso: new Date().toISOString(),
    totalSuratSelesai: suratSelesai.length,
    daftarSuratSelesai: suratSelesai.map((s) => ({
      id: s.id,
      nomorSurat: s.nomorSurat,
      tanggalSurat: s.tanggalSurat,
      tanggalDiterima: s.tanggalDiterima,
      asalSurat: s.asalSurat,
      perihal: s.perihal,
      sifat: s.sifat,
      statusSelesai: s.statusSelesai,
      tanggalSelesai: s.tanggalSelesai || null,
      tahapAkhir: s.tahapSaatIni,
      historyDisposisi: {
        tanggalDisposisi: s.tanggalDisposisi || null,
        tenggatWaktu: s.tenggatWaktu || null,
        penerimaDisposisiIds: s.penerimaDisposisiIds || [],
        penerimaDisposisiNama: s.penerimaDisposisiNama || [],
        instruksiDisposisi: s.instruksiDisposisi || null,
        catatanDisposisiKetuaTim: s.catatanDisposisiKetuaTim || null,
      },
      historyProses: s.riwayatTindakLanjut || [],
      suratMasukFile: s.fileSuratMasuk
        ? {
            nama: s.fileSuratMasuk.nama,
            ukuran: s.fileSuratMasuk.ukuran,
            tanggalUnggah: s.fileSuratMasuk.tanggalUnggah,
            pengunggah: s.fileSuratMasuk.pengunggah,
          }
        : null,
      suratKeluar:
        s.fileSuratKeluar || s.nomorSuratKeluar || s.perihalSuratKeluar
          ? {
              nomorSuratKeluar: s.nomorSuratKeluar || null,
              tanggalSuratKeluar: s.tanggalSuratKeluar || null,
              perihalSuratKeluar: s.perihalSuratKeluar || null,
              file: s.fileSuratKeluar
                ? {
                    nama: s.fileSuratKeluar.nama,
                    ukuran: s.fileSuratKeluar.ukuran,
                    tanggalUnggah: s.fileSuratKeluar.tanggalUnggah,
                    pengunggah: s.fileSuratKeluar.pengunggah,
                  }
                : null,
            }
          : null,
    })),
  };
}

export async function createBackupZipBlob({
  suratList,
  pejabatConfig,
  exportedBy,
  selectedIds,
  resolvePdfDataUrl,
  onProgress,
}: CreateBackupZipParams): Promise<BackupArchiveResult> {
  let targetSurat = getSuratSelesaiForBackup(suratList);
  if (selectedIds && selectedIds.size > 0) {
    targetSurat = targetSurat.filter((s) => selectedIds.has(s.id));
  }

  if (targetSurat.length === 0) {
    throw new Error('Tidak ada surat masuk berstatus selesai yang dipilih untuk di-backup.');
  }

  const zip = new JSZip();
  zip.file('00_Daftar_Rekap_Backup.csv', buildBackupCsvSummary(targetSurat));
  zip.file(
    '00_Backup_Manifest.json',
    JSON.stringify(buildBackupManifestJson(targetSurat, pejabatConfig, exportedBy), null, 2)
  );

  let pdfMasukCount = 0;
  let pdfKeluarCount = 0;
  let metadataOnlyCount = 0;

  for (let i = 0; i < targetSurat.length; i++) {
    const surat = targetSurat[i];
    onProgress?.({
      processed: i,
      total: targetSurat.length,
      currentLabel: `${surat.nomorSurat || surat.id} — ${surat.asalSurat}`,
    });

    const idxPrefix = String(i + 1).padStart(2, '0');
    const folderName = `${idxPrefix}_${sanitizeFileNameSegment(surat.nomorSurat || surat.id, 30)}_${sanitizeFileNameSegment(surat.asalSurat, 32)}`;
    const folder = zip.folder(folderName);
    if (!folder) continue;

    folder.file('01_Ringkasan_Disposisi_dan_Proses.html', buildSuratRiwayatHtml(surat, pejabatConfig));
    folder.file(
      '02_Data_Lengkap.json',
      JSON.stringify(
        buildBackupManifestJson([surat], pejabatConfig, exportedBy).daftarSuratSelesai[0],
        null,
        2
      )
    );

    if (surat.fileSuratMasuk) {
      let resolvedMasuk: string | undefined;
      try {
        resolvedMasuk = await resolvePdfDataUrl(surat.fileSuratMasuk, surat.id, 'masuk');
      } catch {
        resolvedMasuk = undefined;
      }
      const decodedMasuk = decodeDataUrlToBytes(resolvedMasuk);
      const safeMasukName = sanitizeFileNameSegment(surat.fileSuratMasuk.nama.replace(/\.pdf$/i, ''), 60);
      if (decodedMasuk) {
        folder.file(`03_Surat_Masuk_${safeMasukName}.pdf`, decodedMasuk.bytes);
        pdfMasukCount += 1;
      } else {
        metadataOnlyCount += 1;
        folder.file(
          '03_Catatan_Berkas_Surat_Masuk.txt',
          `Metadata tercatat: ${surat.fileSuratMasuk.nama} (${surat.fileSuratMasuk.ukuran})\nStatus: Isi biner PDF tidak tersedia di penyimpanan server (arsip awal berbasis metadata).\n`
        );
      }
    }

    if (surat.fileSuratKeluar) {
      let resolvedKeluar: string | undefined;
      try {
        resolvedKeluar = await resolvePdfDataUrl(surat.fileSuratKeluar, surat.id, 'keluar');
      } catch {
        resolvedKeluar = undefined;
      }
      const decodedKeluar = decodeDataUrlToBytes(resolvedKeluar);
      const safeKeluarName = sanitizeFileNameSegment(surat.fileSuratKeluar.nama.replace(/\.pdf$/i, ''), 60);
      if (decodedKeluar) {
        folder.file(`04_Surat_Keluar_${safeKeluarName}.pdf`, decodedKeluar.bytes);
        pdfKeluarCount += 1;
      } else {
        metadataOnlyCount += 1;
        folder.file(
          '04_Catatan_Berkas_Surat_Keluar.txt',
          `Metadata tercatat: ${surat.fileSuratKeluar.nama} (${surat.fileSuratKeluar.ukuran})\nNomor Surat Keluar: ${surat.nomorSuratKeluar || '-'}\nStatus: Isi biner PDF tidak tersedia di penyimpanan server.\n`
        );
      }
    }
  }

  onProgress?.({
    processed: targetSurat.length,
    total: targetSurat.length,
    currentLabel: 'Mengompresi arsip ZIP...',
  });

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const dateStamp = new Date().toISOString().split('T')[0];
  const filename = `Backup_Surat_Selesai_WASDAL_${dateStamp}.zip`;

  return {
    blob,
    filename,
    stats: {
      totalSurat: targetSurat.length,
      pdfMasukCount,
      pdfKeluarCount,
      metadataOnlyCount,
    },
  };
}
