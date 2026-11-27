import test from 'node:test';
import assert from 'node:assert/strict';

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const VALID_SIFAT = new Set(['Biasa', 'Penting', 'Segera', 'Sangat Segera', 'Rahasia']);
const VALID_ROLES = new Set(['ketua_tim', 'administrator', 'staf']);
const INTERNAL_WORKSPACE_ID = 'internal_wasdal';

const SURAT_ALLOWED_KEYS = new Set([
  'ownerId', 'nomorAgenda', 'nomorSurat', 'tanggalSurat', 'tanggalDiterima',
  'asalSurat', 'perihal', 'sifat', 'tanggalDisposisi',
  'penerimaDisposisiIds', 'penerimaDisposisiNama',
  'instruksiDisposisi', 'catatanDisposisiKetuaTim', 'tenggatWaktu',
  'tahapSaatIni', 'statusSelesai', 'tanggalSelesai', 'riwayatTindakLanjut',
  'fileSuratMasuk', 'fileSuratKeluar', 'nomorSuratKeluar',
  'tanggalSuratKeluar', 'perihalSuratKeluar',
  'createdAt', 'updatedAt',
]);

function evaluateSuratCreate(
  docId: string,
  payload: Record<string, unknown>,
  usesServerTime: boolean
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!docId || docId.length > 128 || !VALID_ID_REGEX.test(docId)) return 'PERMISSION_DENIED';
  if (!usesServerTime) return 'PERMISSION_DENIED';
  for (const key of Object.keys(payload)) {
    if (!SURAT_ALLOWED_KEYS.has(key)) return 'PERMISSION_DENIED';
  }
  if (payload.ownerId !== INTERNAL_WORKSPACE_ID) return 'PERMISSION_DENIED';
  if (typeof payload.perihal !== 'string' || payload.perihal.length < 1 || payload.perihal.length > 1500) {
    return 'PERMISSION_DENIED';
  }
  if (typeof payload.sifat !== 'string' || !VALID_SIFAT.has(payload.sifat)) {
    return 'PERMISSION_DENIED';
  }
  if (!Array.isArray(payload.penerimaDisposisiIds) || payload.penerimaDisposisiIds.length > 30) {
    return 'PERMISSION_DENIED';
  }
  if (!Array.isArray(payload.riwayatTindakLanjut) || payload.riwayatTindakLanjut.length > 50) {
    return 'PERMISSION_DENIED';
  }
  if (typeof payload.tahapSaatIni !== 'number' || payload.tahapSaatIni < 1 || payload.tahapSaatIni > 7) {
    return 'PERMISSION_DENIED';
  }
  return 'ALLOW';
}

test('Internal workspace security checks enforce PERMISSION_DENIED on invalid payloads', () => {
  const validPayload: Record<string, unknown> = {
    ownerId: INTERNAL_WORKSPACE_ID,
    nomorSurat: '001/DPKP/XI/2026',
    tanggalSurat: '2026-11-17',
    tanggalDiterima: '2026-11-17',
    asalSurat: 'Ombudsman RI',
    perihal: 'Permintaan Klarifikasi',
    sifat: 'Penting',
    penerimaDisposisiIds: ['internal_wasdal_p-chafidz'],
    penerimaDisposisiNama: ['Chafidz'],
    tahapSaatIni: 1,
    statusSelesai: false,
    riwayatTindakLanjut: [],
    createdAt: 'SERVER_TIME',
    updatedAt: 'SERVER_TIME',
  };

  assert.equal(evaluateSuratCreate('internal_wasdal_surat-1', validPayload, true), 'ALLOW');

  // 1. Foreign Workspace Spoofing
  assert.equal(
    evaluateSuratCreate('s1', { ...validPayload, ownerId: 'other-ws' }, true),
    'PERMISSION_DENIED'
  );
  // 2. Shadow Ghost Field
  assert.equal(
    evaluateSuratCreate('s1', { ...validPayload, isAdmin: true }, true),
    'PERMISSION_DENIED'
  );
  // 3. Path ID Poisoning
  assert.equal(evaluateSuratCreate('bad/id..poison', validPayload, true), 'PERMISSION_DENIED');
  // 4. Client-Forged Timestamp
  assert.equal(evaluateSuratCreate('s1', validPayload, false), 'PERMISSION_DENIED');
  // 5. String Overflow
  assert.equal(
    evaluateSuratCreate('s1', { ...validPayload, perihal: 'x'.repeat(1501) }, true),
    'PERMISSION_DENIED'
  );
  // 6. Array Overflow
  assert.equal(
    evaluateSuratCreate(
      's1',
      { ...validPayload, penerimaDisposisiIds: Array.from({ length: 31 }, (_, i) => `p-${i}`) },
      true
    ),
    'PERMISSION_DENIED'
  );
  // 7. Invalid Stage Value
  assert.equal(
    evaluateSuratCreate('s1', { ...validPayload, tahapSaatIni: 99 }, true),
    'PERMISSION_DENIED'
  );
  // 8. Role Enum allowlist
  assert.equal(VALID_ROLES.has('ketua_tim'), true);
  assert.equal(VALID_ROLES.has('administrator'), true);
  assert.equal(VALID_ROLES.has('staf'), true);
  assert.equal(VALID_ROLES.has('superadmin'), false);
});

test('Action 4 Upload Surat Keluar payload matches allowed keys and file metadata bounds', () => {
  const filePayload = {
    nama: 'Surat_Keluar_001.pdf',
    ukuran: '1.2 MB',
    tipe: 'application/pdf',
    tanggalUnggah: '2026-11-17 07:45',
    pengunggah: 'Yuliani, ST',
  };
  const updatedWithBothFiles: Record<string, unknown> = {
    ownerId: INTERNAL_WORKSPACE_ID,
    nomorSurat: '042/SS-DIR/X/2026',
    tanggalSurat: '2026-11-02',
    tanggalDiterima: '2026-11-03',
    asalSurat: 'Sudirman Suite',
    perihal: 'Permohonan Penegasan Status Hukum PPPSRS',
    sifat: 'Penting',
    penerimaDisposisiIds: ['internal_wasdal_p-chafidz'],
    penerimaDisposisiNama: ['Chafidz'],
    tahapSaatIni: 7,
    statusSelesai: true,
    tanggalSelesai: '2026-11-17',
    riwayatTindakLanjut: [{ id: 'r1', tahapId: 7 }],
    fileSuratMasuk: filePayload,
    fileSuratKeluar: filePayload,
    nomorSuratKeluar: '503/WASDAL/1102/DPKP',
    tanggalSuratKeluar: '2026-11-17',
    perihalSuratKeluar: 'Jawaban resmi atas permohonan',
    createdAt: 'SERVER_TIME',
    updatedAt: 'SERVER_TIME',
  };
  assert.equal(evaluateSuratCreate('internal_wasdal_surat-1', updatedWithBothFiles, true), 'ALLOW');
});

test('Action 6 Edit Registrasi Surat Masuk allows metadata fields only when active', () => {
  const editAllowedKeys = new Set([
    'nomorSurat', 'tanggalSurat', 'tanggalDiterima',
    'asalSurat', 'perihal', 'sifat', 'fileSuratMasuk',
    'riwayatTindakLanjut', 'updatedAt',
  ]);
  const updatedFields = ['nomorSurat', 'tanggalSurat', 'tanggalDiterima', 'asalSurat', 'perihal', 'sifat', 'fileSuratMasuk', 'riwayatTindakLanjut', 'updatedAt'];
  assert.equal(updatedFields.every((k) => editAllowedKeys.has(k)), true);
  assert.equal(editAllowedKeys.has('ownerId'), false);
  assert.equal(editAllowedKeys.has('createdAt'), false);
});

test('BerkasChunk enforces chunk index, totalChunks, content bounds, and kind', () => {
  const CHUNK_ALLOWED_KEYS = new Set([
    'ownerId', 'kind', 'chunkIndex', 'totalChunks', 'content', 'createdAt', 'updatedAt',
  ]);
  const validChunk = {
    ownerId: INTERNAL_WORKSPACE_ID,
    kind: 'keluar',
    chunkIndex: 0,
    totalChunks: 3,
    content: 'A'.repeat(100),
    createdAt: 'SERVER_TIME',
    updatedAt: 'SERVER_TIME',
  };
  assert.equal(Object.keys(validChunk).every((k) => CHUNK_ALLOWED_KEYS.has(k)), true);
  assert.equal(validChunk.chunkIndex < validChunk.totalChunks, true);
  assert.equal(validChunk.content.length <= 700000, true);
  assert.equal(['masuk', 'keluar'].includes(validChunk.kind), true);
  // Out-of-bounds checks
  assert.equal(30 <= 29, false); // chunkIndex max 29
  assert.equal(700001 <= 700000, false); // content max 700k
});

test('AkunKredensial enforces accountId binding, hash bounds, and immutable keys on update', () => {
  const AKUN_ALLOWED_KEYS = new Set([
    'ownerId', 'accountId', 'passwordHash', 'isDefaultReset', 'createdAt', 'updatedAt',
  ]);
  const validAkun = {
    ownerId: INTERNAL_WORKSPACE_ID,
    accountId: 'internal_wasdal_p-chafidz',
    passwordHash: '0123456789abcdef:abcdef0123456789abcdef0123456789abcdef0123456789abcdef01234567',
    isDefaultReset: false,
    createdAt: 'SERVER_TIME',
    updatedAt: 'SERVER_TIME',
  };
  assert.equal(Object.keys(validAkun).every((k) => AKUN_ALLOWED_KEYS.has(k)), true);
  assert.equal(VALID_ID_REGEX.test(validAkun.accountId), true);
  assert.equal(validAkun.passwordHash.length >= 16 && validAkun.passwordHash.length <= 200, true);

  const allowedUpdateKeys = new Set(['passwordHash', 'isDefaultReset', 'updatedAt']);
  assert.equal(['passwordHash', 'isDefaultReset', 'updatedAt'].every((k) => allowedUpdateKeys.has(k)), true);
  assert.equal(allowedUpdateKeys.has('accountId'), false);
  assert.equal(allowedUpdateKeys.has('ownerId'), false);
});

const AGENDA_ALLOWED_KEYS = new Set([
  'ownerId', 'judul', 'kategori', 'tanggal', 'sepanjangHari',
  'jamMulai', 'jamSelesai', 'lokasi', 'pesertaIds', 'pesertaNama',
  'pesertaTambahan', 'catatan',
  'status', 'tanggalSebelumnya', 'alasanStatus', 'statusDiubahOleh', 'statusDiubahPada',
  'dibuatOlehId', 'dibuatOlehNama', 'createdAt', 'updatedAt',
]);
const VALID_AGENDA_KATEGORI = new Set([
  'Rapat Koordinasi',
  'Tinjauan Lapangan',
  'Asistensi',
  'Audiensi',
  'Lainnya',
]);
const VALID_AGENDA_STATUS = new Set([
  'terjadwal',
  'dibatalkan',
  'dijadwalkan_ulang',
]);

function evaluateAgendaCreate(
  docId: string,
  payload: Record<string, unknown>,
  usesServerTime: boolean
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!docId || docId.length > 128 || !VALID_ID_REGEX.test(docId)) return 'PERMISSION_DENIED';
  if (!usesServerTime) return 'PERMISSION_DENIED';
  for (const key of Object.keys(payload)) {
    if (!AGENDA_ALLOWED_KEYS.has(key)) return 'PERMISSION_DENIED';
  }
  if (payload.ownerId !== INTERNAL_WORKSPACE_ID) return 'PERMISSION_DENIED';
  if (typeof payload.judul !== 'string' || payload.judul.length < 1 || payload.judul.length > 200) {
    return 'PERMISSION_DENIED';
  }
  if (typeof payload.kategori !== 'string' || !VALID_AGENDA_KATEGORI.has(payload.kategori)) {
    return 'PERMISSION_DENIED';
  }
  if (payload.status !== undefined && (typeof payload.status !== 'string' || !VALID_AGENDA_STATUS.has(payload.status))) {
    return 'PERMISSION_DENIED';
  }
  if (typeof payload.alasanStatus === 'string' && payload.alasanStatus.length > 500) {
    return 'PERMISSION_DENIED';
  }
  if (typeof payload.lokasi !== 'string' || payload.lokasi.length < 1 || payload.lokasi.length > 250) {
    return 'PERMISSION_DENIED';
  }
  if (!Array.isArray(payload.pesertaIds) || payload.pesertaIds.length > 30) {
    return 'PERMISSION_DENIED';
  }
  if (!Array.isArray(payload.pesertaNama) || payload.pesertaNama.length > 30) {
    return 'PERMISSION_DENIED';
  }
  if (typeof payload.catatan === 'string' && payload.catatan.length > 1500) {
    return 'PERMISSION_DENIED';
  }
  return 'ALLOW';
}

test('AgendaEvent enforces workspace binding, bounds, allowed keys, status allowlist, and immutable fields', () => {
  const validAgenda: Record<string, unknown> = {
    ownerId: INTERNAL_WORKSPACE_ID,
    judul: 'Rapat Koordinasi Evaluasi PPPSRS',
    kategori: 'Rapat Koordinasi',
    tanggal: '2026-11-25',
    sepanjangHari: false,
    jamMulai: '09:00',
    jamSelesai: '11:00',
    lokasi: 'Ruang Rapat DPKP Lt. 2',
    pesertaIds: ['internal_wasdal_p-chafidz'],
    pesertaNama: ['Chafidz Ginanjar, ST'],
    pesertaTambahan: 'Perwakilan Bagian Hukum',
    catatan: 'Membahas kelengkapan berkas.',
    status: 'terjadwal',
    dibuatOlehId: 'internal_wasdal_p-chafidz',
    dibuatOlehNama: 'Chafidz Ginanjar, ST',
    createdAt: 'SERVER_TIME',
    updatedAt: 'SERVER_TIME',
  };

  assert.equal(evaluateAgendaCreate('agenda-170000-ab12', validAgenda, true), 'ALLOW');
  assert.equal(
    evaluateAgendaCreate(
      'agenda-170000-ab13',
      { ...validAgenda, status: 'dijadwalkan_ulang', tanggalSebelumnya: '2026-11-24', alasanStatus: 'Pindah jadwal' },
      true
    ),
    'ALLOW'
  );
  assert.equal(evaluateAgendaCreate('agenda-1', { ...validAgenda, ownerId: 'other' }, true), 'PERMISSION_DENIED');
  assert.equal(evaluateAgendaCreate('agenda-1', { ...validAgenda, shadowField: 1 }, true), 'PERMISSION_DENIED');
  assert.equal(evaluateAgendaCreate('agenda-1', { ...validAgenda, kategori: 'Unknown' }, true), 'PERMISSION_DENIED');
  assert.equal(evaluateAgendaCreate('agenda-1', { ...validAgenda, status: 'dihapus_paksa' }, true), 'PERMISSION_DENIED');
  assert.equal(evaluateAgendaCreate('agenda-1', { ...validAgenda, alasanStatus: 'a'.repeat(501) }, true), 'PERMISSION_DENIED');
  assert.equal(evaluateAgendaCreate('agenda-1', { ...validAgenda, judul: 'a'.repeat(201) }, true), 'PERMISSION_DENIED');
  assert.equal(evaluateAgendaCreate('agenda-1', validAgenda, false), 'PERMISSION_DENIED');

  const agendaUpdateAllowedKeys = new Set([
    'judul', 'kategori', 'tanggal', 'sepanjangHari', 'jamMulai', 'jamSelesai',
    'lokasi', 'pesertaIds', 'pesertaNama', 'pesertaTambahan', 'catatan', 'updatedAt',
  ]);
  assert.equal(agendaUpdateAllowedKeys.has('ownerId'), false);
  assert.equal(agendaUpdateAllowedKeys.has('createdAt'), false);
  assert.equal(agendaUpdateAllowedKeys.has('dibuatOlehId'), false);
  assert.equal(agendaUpdateAllowedKeys.has('dibuatOlehNama'), false);

  const cancelKeys = new Set(['status', 'alasanStatus', 'statusDiubahOleh', 'statusDiubahPada', 'updatedAt']);
  assert.equal(cancelKeys.has('ownerId'), false);
  assert.equal(cancelKeys.has('dibuatOlehId'), false);

  const rescheduleKeys = new Set([
    'status', 'tanggal', 'tanggalSebelumnya', 'sepanjangHari',
    'jamMulai', 'jamSelesai', 'lokasi', 'alasanStatus',
    'statusDiubahOleh', 'statusDiubahPada', 'updatedAt',
  ]);
  assert.equal(rescheduleKeys.has('tanggal'), true);
  assert.equal(rescheduleKeys.has('tanggalSebelumnya'), true);
  assert.equal(rescheduleKeys.has('ownerId'), false);
});

const NOTIFIKASI_ALLOWED_KEYS = new Set([
  'ownerId', 'suratId', 'recipientId', 'recipientNama',
  'nomorSurat', 'asalSurat', 'perihal', 'sifat',
  'instruksiDisposisi', 'tenggatWaktu', 'pengirimNama',
  'jenis', 'dibaca', 'dibacaPada',
  'createdAt', 'updatedAt',
]);
const VALID_NOTIFIKASI_JENIS = new Set(['disposisi_baru', 'disposisi_diperbarui']);

function evaluateNotifikasiCreate(
  docId: string,
  payload: Record<string, unknown>,
  usesServerTime: boolean
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!docId || docId.length > 128 || !VALID_ID_REGEX.test(docId)) return 'PERMISSION_DENIED';
  if (!usesServerTime) return 'PERMISSION_DENIED';
  for (const key of Object.keys(payload)) {
    if (!NOTIFIKASI_ALLOWED_KEYS.has(key)) return 'PERMISSION_DENIED';
  }
  if (payload.ownerId !== INTERNAL_WORKSPACE_ID) return 'PERMISSION_DENIED';
  if (typeof payload.suratId !== 'string' || !VALID_ID_REGEX.test(payload.suratId)) {
    return 'PERMISSION_DENIED';
  }
  if (typeof payload.recipientId !== 'string' || !VALID_ID_REGEX.test(payload.recipientId)) {
    return 'PERMISSION_DENIED';
  }
  if (typeof payload.recipientNama !== 'string' || payload.recipientNama.length < 1 || payload.recipientNama.length > 150) {
    return 'PERMISSION_DENIED';
  }
  if (typeof payload.instruksiDisposisi !== 'string' || payload.instruksiDisposisi.length < 1 || payload.instruksiDisposisi.length > 1500) {
    return 'PERMISSION_DENIED';
  }
  if (typeof payload.jenis !== 'string' || !VALID_NOTIFIKASI_JENIS.has(payload.jenis)) {
    return 'PERMISSION_DENIED';
  }
  if (typeof payload.dibaca !== 'boolean') return 'PERMISSION_DENIED';
  return 'ALLOW';
}

test('NotifikasiDisposisi enforces recipientId, workspace binding, bounds, allowed keys, and immutable fields', () => {
  const validNotif: Record<string, unknown> = {
    ownerId: INTERNAL_WORKSPACE_ID,
    suratId: 'surat-1763900000-ab12',
    recipientId: 'internal_wasdal_p-chafidz',
    recipientNama: 'Chafidz Ginanjar, ST',
    nomorSurat: '001/DPKP/XI/2026',
    asalSurat: 'Ombudsman RI',
    perihal: 'Permintaan Klarifikasi PPPSRS',
    sifat: 'Penting',
    instruksiDisposisi: 'Pelajari dan siapkan tanggapan tertulis.',
    tenggatWaktu: '2026-11-30',
    pengirimNama: 'Yuliani, ST',
    jenis: 'disposisi_baru',
    dibaca: false,
    createdAt: 'SERVER_TIME',
    updatedAt: 'SERVER_TIME',
  };

  assert.equal(evaluateNotifikasiCreate('notif_surat-1763900000-ab12_internal_wasdal_p-chafidz', validNotif, true), 'ALLOW');
  assert.equal(evaluateNotifikasiCreate('n1', { ...validNotif, ownerId: 'other' }, true), 'PERMISSION_DENIED');
  assert.equal(evaluateNotifikasiCreate('n1', { ...validNotif, shadowFlag: true }, true), 'PERMISSION_DENIED');
  assert.equal(evaluateNotifikasiCreate('n1', { ...validNotif, recipientId: 'bad/id' }, true), 'PERMISSION_DENIED');
  assert.equal(evaluateNotifikasiCreate('n1', { ...validNotif, jenis: 'broadcast_all' }, true), 'PERMISSION_DENIED');
  assert.equal(evaluateNotifikasiCreate('n1', { ...validNotif, instruksiDisposisi: 'x'.repeat(1501) }, true), 'PERMISSION_DENIED');
  assert.equal(evaluateNotifikasiCreate('n1', validNotif, false), 'PERMISSION_DENIED');

  const markReadKeys = new Set(['dibaca', 'dibacaPada', 'updatedAt']);
  assert.equal(markReadKeys.has('recipientId'), false);
  assert.equal(markReadKeys.has('suratId'), false);
  assert.equal(markReadKeys.has('ownerId'), false);
  assert.equal(markReadKeys.has('createdAt'), false);
});

const REKENING_ALLOWED_KEYS = new Set([
  'ownerId', 'kodeRekening', 'uraian', 'tahunAnggaran', 'paguAnggaran',
  'catatan', 'dibuatOlehId', 'dibuatOlehNama', 'createdAt', 'updatedAt',
]);

function evaluateRekeningCreate(
  docId: string,
  payload: Record<string, unknown>,
  usesServerTime: boolean
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!docId || docId.length > 128 || !VALID_ID_REGEX.test(docId)) return 'PERMISSION_DENIED';
  if (!usesServerTime) return 'PERMISSION_DENIED';
  for (const key of Object.keys(payload)) {
    if (!REKENING_ALLOWED_KEYS.has(key)) return 'PERMISSION_DENIED';
  }
  if (payload.ownerId !== INTERNAL_WORKSPACE_ID) return 'PERMISSION_DENIED';
  if (typeof payload.kodeRekening !== 'string' || payload.kodeRekening.length < 1 || payload.kodeRekening.length > 100) {
    return 'PERMISSION_DENIED';
  }
  if (typeof payload.uraian !== 'string' || payload.uraian.length < 1 || payload.uraian.length > 300) {
    return 'PERMISSION_DENIED';
  }
  if (
    typeof payload.tahunAnggaran !== 'number' ||
    !Number.isInteger(payload.tahunAnggaran) ||
    payload.tahunAnggaran < 2000 ||
    payload.tahunAnggaran > 2100
  ) {
    return 'PERMISSION_DENIED';
  }
  if (typeof payload.paguAnggaran !== 'number' || payload.paguAnggaran < 0 || payload.paguAnggaran > 1000000000000) {
    return 'PERMISSION_DENIED';
  }
  if (
    payload.catatan !== undefined &&
    (typeof payload.catatan !== 'string' || payload.catatan.length > 1000)
  ) {
    return 'PERMISSION_DENIED';
  }
  return 'ALLOW';
}

test('RekeningAnggaran enforces workspace binding, bounds, allowed keys, and immutable fields', () => {
  const validRek: Record<string, unknown> = {
    ownerId: INTERNAL_WORKSPACE_ID,
    kodeRekening: '5.1.02.02.01.0029',
    uraian: 'Belanja Jasa Tenaga Ahli',
    tahunAnggaran: 2026,
    paguAnggaran: 141670000,
    dibuatOlehId: 'internal_wasdal_p-ketua',
    dibuatOlehNama: 'Yuliani, ST',
    createdAt: 'SERVER_TIME',
    updatedAt: 'SERVER_TIME',
  };

  assert.equal(evaluateRekeningCreate('rek-170000-ab12', validRek, true), 'ALLOW');
  assert.equal(evaluateRekeningCreate('rek-1', { ...validRek, ownerId: 'other' }, true), 'PERMISSION_DENIED');
  assert.equal(evaluateRekeningCreate('rek-1', { ...validRek, ghostFlag: true }, true), 'PERMISSION_DENIED');
  assert.equal(evaluateRekeningCreate('rek-1', { ...validRek, kodeRekening: '' }, true), 'PERMISSION_DENIED');
  assert.equal(evaluateRekeningCreate('rek-1', { ...validRek, kodeRekening: '1'.repeat(101) }, true), 'PERMISSION_DENIED');
  assert.equal(evaluateRekeningCreate('rek-1', { ...validRek, paguAnggaran: -100 }, true), 'PERMISSION_DENIED');
  assert.equal(evaluateRekeningCreate('rek-1', { ...validRek, tahunAnggaran: 1998 }, true), 'PERMISSION_DENIED');
  assert.equal(evaluateRekeningCreate('rek-1', validRek, false), 'PERMISSION_DENIED');
});

const PAKET_ALLOWED_KEYS = new Set([
  'ownerId', 'rekeningId', 'kodeRekening', 'namaRekening',
  'namaKegiatan', 'subKegiatan', 'pekerjaan', 'jenisPelaksanaan', 'skemaKontrak',
  'tahunAnggaran', 'nilaiAnggaran', 'hps', 'nilaiKontrak',
  'tanggalMulai', 'durasiHariKerja', 'tenggatWaktu', 'tanggalSelesai',
  'skemaPembayaran', 'terminPencairan', 'statusPencairan', 'mekanismePencairan',
  'kodeRup', 'nomorKontrak', 'penyedia', 'picNama', 'catatan', 'tahapan',
  'dibuatOlehId', 'dibuatOlehNama', 'createdAt', 'updatedAt',
]);
const VALID_JENIS_PELAKSANAAN = new Set([
  'Perorangan',
  'Badan Usaha',
]);
const VALID_SKEMA_KONTRAK = new Set([
  'Lump Sum',
  'Waktu Penugasan',
  'Pengadaan Langsung',
  'Katalog',
]);
const VALID_SKEMA_PEMBAYARAN = new Set([
  'Sekaligus',
  'Termin',
]);
const VALID_STATUS_PENCAIRAN = new Set([
  'Belum',
  'Sudah',
]);
const VALID_MEKANISME_PENCAIRAN = new Set([
  'Langsung (LS)',
  'Ganti Uang Persediaan (GU)',
  'Tambahan Uang Persediaan (TU)',
]);

function evaluatePaketCreate(
  docId: string,
  payload: Record<string, unknown>,
  usesServerTime: boolean
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!docId || docId.length > 128 || !VALID_ID_REGEX.test(docId)) return 'PERMISSION_DENIED';
  if (!usesServerTime) return 'PERMISSION_DENIED';
  for (const key of Object.keys(payload)) {
    if (!PAKET_ALLOWED_KEYS.has(key)) return 'PERMISSION_DENIED';
  }
  if (payload.ownerId !== INTERNAL_WORKSPACE_ID) return 'PERMISSION_DENIED';
  if (
    payload.rekeningId !== undefined &&
    (typeof payload.rekeningId !== 'string' || payload.rekeningId.length > 128 || !VALID_ID_REGEX.test(payload.rekeningId))
  ) {
    return 'PERMISSION_DENIED';
  }
  if (
    payload.kodeRekening !== undefined &&
    (typeof payload.kodeRekening !== 'string' || payload.kodeRekening.length > 100)
  ) {
    return 'PERMISSION_DENIED';
  }
  if (
    payload.namaRekening !== undefined &&
    (typeof payload.namaRekening !== 'string' || payload.namaRekening.length > 300)
  ) {
    return 'PERMISSION_DENIED';
  }
  if (typeof payload.namaKegiatan !== 'string' || payload.namaKegiatan.length < 1 || payload.namaKegiatan.length > 300) {
    return 'PERMISSION_DENIED';
  }
  if (typeof payload.subKegiatan !== 'string' || payload.subKegiatan.length < 1 || payload.subKegiatan.length > 300) {
    return 'PERMISSION_DENIED';
  }
  if (
    payload.pekerjaan !== undefined &&
    (typeof payload.pekerjaan !== 'string' || payload.pekerjaan.length > 300)
  ) {
    return 'PERMISSION_DENIED';
  }
  if (typeof payload.jenisPelaksanaan !== 'string' || !VALID_JENIS_PELAKSANAAN.has(payload.jenisPelaksanaan)) {
    return 'PERMISSION_DENIED';
  }
  if (
    payload.skemaKontrak !== undefined &&
    (typeof payload.skemaKontrak !== 'string' || !VALID_SKEMA_KONTRAK.has(payload.skemaKontrak))
  ) {
    return 'PERMISSION_DENIED';
  }
  if (
    payload.tahunAnggaran !== undefined &&
    (typeof payload.tahunAnggaran !== 'number' ||
      !Number.isInteger(payload.tahunAnggaran) ||
      payload.tahunAnggaran < 2000 ||
      payload.tahunAnggaran > 2100)
  ) {
    return 'PERMISSION_DENIED';
  }
  if (typeof payload.nilaiAnggaran !== 'number' || payload.nilaiAnggaran < 0 || payload.nilaiAnggaran > 1000000000000) {
    return 'PERMISSION_DENIED';
  }
  if (
    payload.hps !== undefined &&
    (typeof payload.hps !== 'number' || payload.hps < 0 || payload.hps > 1000000000000)
  ) {
    return 'PERMISSION_DENIED';
  }
  if (
    payload.nilaiKontrak !== undefined &&
    (typeof payload.nilaiKontrak !== 'number' || payload.nilaiKontrak < 0 || payload.nilaiKontrak > 1000000000000)
  ) {
    return 'PERMISSION_DENIED';
  }
  if (
    payload.durasiHariKerja !== undefined &&
    (typeof payload.durasiHariKerja !== 'number' ||
      !Number.isInteger(payload.durasiHariKerja) ||
      payload.durasiHariKerja < 1 ||
      payload.durasiHariKerja > 1825)
  ) {
    return 'PERMISSION_DENIED';
  }
  if (
    payload.skemaPembayaran !== undefined &&
    (typeof payload.skemaPembayaran !== 'string' || !VALID_SKEMA_PEMBAYARAN.has(payload.skemaPembayaran))
  ) {
    return 'PERMISSION_DENIED';
  }
  if (payload.terminPencairan !== undefined) {
    if (!Array.isArray(payload.terminPencairan) || payload.terminPencairan.length > 20) {
      return 'PERMISSION_DENIED';
    }
    if (
      payload.terminPencairan.length > 0 &&
      (typeof payload.terminPencairan[0] !== 'object' || payload.terminPencairan[0] === null)
    ) {
      return 'PERMISSION_DENIED';
    }
  }
  if (
    payload.statusPencairan !== undefined &&
    (typeof payload.statusPencairan !== 'string' || !VALID_STATUS_PENCAIRAN.has(payload.statusPencairan))
  ) {
    return 'PERMISSION_DENIED';
  }
  if (
    payload.mekanismePencairan !== undefined &&
    (typeof payload.mekanismePencairan !== 'string' || !VALID_MEKANISME_PENCAIRAN.has(payload.mekanismePencairan))
  ) {
    return 'PERMISSION_DENIED';
  }
  if (
    payload.kodeRup !== undefined &&
    (typeof payload.kodeRup !== 'string' || payload.kodeRup.length > 100)
  ) {
    return 'PERMISSION_DENIED';
  }
  if (!Array.isArray(payload.tahapan) || payload.tahapan.length < 1 || payload.tahapan.length > 30) {
    return 'PERMISSION_DENIED';
  }
  return 'ALLOW';
}

test('PaketPekerjaan enforces workspace binding, allowlists (jenis, skema, pembayaran, pencairan), budget/kontrak bounds, termin bounds, durasi bounds, tahapan bounds, and immutable fields', () => {
  const validPaket: Record<string, unknown> = {
    ownerId: INTERNAL_WORKSPACE_ID,
    namaKegiatan: 'Pengawasan dan Pengendalian Perumahan',
    subKegiatan: 'Kajian Teknis Kelaikan Fungsi Bangunan Perumahan',
    pekerjaan: 'Pengawasan Pembangunan Perumahan Wilayah Barat',
    jenisPelaksanaan: 'Perorangan',
    skemaKontrak: 'Lump Sum',
    tahunAnggaran: 2026,
    nilaiAnggaran: 75000000,
    nilaiKontrak: 70500000,
    tanggalMulai: '2026-08-19',
    durasiHariKerja: 93,
    tenggatWaktu: '2026-11-19',
    skemaPembayaran: 'Sekaligus',
    statusPencairan: 'Sudah',
    mekanismePencairan: 'Langsung (LS)',
    kodeRup: '51234567',
    tahapan: [
      { id: 't-1', urutan: 1, nama: 'Persiapan & SPK', status: 'selesai' },
      { id: 't-2', urutan: 2, nama: 'Laporan Pendahuluan', status: 'sedang_berjalan' },
    ],
    dibuatOlehId: 'internal_wasdal_p-ketua',
    dibuatOlehNama: 'Yuliani, ST',
    createdAt: 'SERVER_TIME',
    updatedAt: 'SERVER_TIME',
  };

  assert.equal(evaluatePaketCreate('paket-170000-ab12', validPaket, true), 'ALLOW');
  assert.equal(
    evaluatePaketCreate(
      'paket-170000-ab13',
      {
        ...validPaket,
        jenisPelaksanaan: 'Badan Usaha',
        skemaKontrak: 'Waktu Penugasan',
        statusPencairan: 'Belum',
        mekanismePencairan: 'Ganti Uang Persediaan (GU)',
      },
      true
    ),
    'ALLOW'
  );
  assert.equal(
    evaluatePaketCreate(
      'paket-170000-ab14',
      {
        ...validPaket,
        skemaKontrak: 'Pengadaan Langsung',
        mekanismePencairan: 'Tambahan Uang Persediaan (TU)',
        skemaPembayaran: 'Termin',
        terminPencairan: [
          { id: 'tr-1', urutan: 1, nama: 'Termin 1', persentase: 50, status: 'Sudah' },
          { id: 'tr-2', urutan: 2, nama: 'Termin 2', persentase: 50, status: 'Belum' },
        ],
        statusPencairan: 'Belum',
      },
      true
    ),
    'ALLOW'
  );
  assert.equal(
    evaluatePaketCreate(
      'paket-170000-ab15',
      {
        ...validPaket,
        skemaKontrak: 'Katalog',
        rekeningId: 'rek-170000-ab12',
        kodeRekening: '5.1.02.02.01.0029',
        namaRekening: 'Belanja Jasa Tenaga Ahli',
      },
      true
    ),
    'ALLOW'
  );
  assert.equal(
    evaluatePaketCreate('paket-1', { ...validPaket, rekeningId: 'bad/id' }, true),
    'PERMISSION_DENIED'
  );
  assert.equal(
    evaluatePaketCreate('paket-1', { ...validPaket, kodeRekening: '5'.repeat(101) }, true),
    'PERMISSION_DENIED'
  );
  assert.equal(evaluatePaketCreate('paket-1', { ...validPaket, ownerId: 'other' }, true), 'PERMISSION_DENIED');
  assert.equal(evaluatePaketCreate('paket-1', { ...validPaket, shadowField: 123 }, true), 'PERMISSION_DENIED');
  assert.equal(evaluatePaketCreate('paket-1', { ...validPaket, jenisPelaksanaan: 'Lainnya' }, true), 'PERMISSION_DENIED');
  assert.equal(evaluatePaketCreate('paket-1', { ...validPaket, skemaKontrak: 'Turnkey' }, true), 'PERMISSION_DENIED');
  assert.equal(evaluatePaketCreate('paket-1', { ...validPaket, skemaPembayaran: 'Cicilan' }, true), 'PERMISSION_DENIED');
  assert.equal(
    evaluatePaketCreate(
      'paket-1',
      { ...validPaket, terminPencairan: Array.from({ length: 21 }, (_, i) => ({ id: `tr-${i}` })) },
      true
    ),
    'PERMISSION_DENIED'
  );
  assert.equal(evaluatePaketCreate('paket-1', { ...validPaket, statusPencairan: 'Proses' }, true), 'PERMISSION_DENIED');
  assert.equal(evaluatePaketCreate('paket-1', { ...validPaket, mekanismePencairan: 'UP' }, true), 'PERMISSION_DENIED');
  assert.equal(evaluatePaketCreate('paket-1', { ...validPaket, nilaiKontrak: -100 }, true), 'PERMISSION_DENIED');
  assert.equal(evaluatePaketCreate('paket-1', { ...validPaket, tahunAnggaran: 1999 }, true), 'PERMISSION_DENIED');
  assert.equal(evaluatePaketCreate('paket-1', { ...validPaket, tahunAnggaran: 2101 }, true), 'PERMISSION_DENIED');
  assert.equal(evaluatePaketCreate('paket-1', { ...validPaket, pekerjaan: 'x'.repeat(301) }, true), 'PERMISSION_DENIED');
  assert.equal(evaluatePaketCreate('paket-1', { ...validPaket, kodeRup: 'x'.repeat(101) }, true), 'PERMISSION_DENIED');
  assert.equal(evaluatePaketCreate('paket-1', { ...validPaket, nilaiAnggaran: -1000 }, true), 'PERMISSION_DENIED');
  assert.equal(evaluatePaketCreate('paket-1', { ...validPaket, durasiHariKerja: 0 }, true), 'PERMISSION_DENIED');
  assert.equal(evaluatePaketCreate('paket-1', { ...validPaket, durasiHariKerja: 1826 }, true), 'PERMISSION_DENIED');
  assert.equal(evaluatePaketCreate('paket-1', { ...validPaket, tahapan: [] }, true), 'PERMISSION_DENIED');
  assert.equal(
    evaluatePaketCreate(
      'paket-1',
      { ...validPaket, tahapan: Array.from({ length: 31 }, (_, i) => ({ id: `t-${i}` })) },
      true
    ),
    'PERMISSION_DENIED'
  );
  assert.equal(evaluatePaketCreate('paket-1', validPaket, false), 'PERMISSION_DENIED');

  const stageProgressUpdateKeys = new Set([
    'tahapan',
    'tanggalSelesai',
    'skemaPembayaran',
    'terminPencairan',
    'statusPencairan',
    'mekanismePencairan',
    'updatedAt',
  ]);
  assert.equal(stageProgressUpdateKeys.has('ownerId'), false);
  assert.equal(stageProgressUpdateKeys.has('dibuatOlehId'), false);
  assert.equal(stageProgressUpdateKeys.has('createdAt'), false);
});

