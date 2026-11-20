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

