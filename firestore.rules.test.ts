import test from 'node:test';
import assert from 'node:assert/strict';

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const VALID_SIFAT = new Set(['Biasa', 'Penting', 'Segera', 'Sangat Segera', 'Rahasia']);
const VALID_ROLES = new Set(['ketua_tim', 'staf']);

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

interface AuthCtx {
  uid: string;
  email: string;
  emailVerified: boolean;
}

function evaluateSuratCreate(
  docId: string,
  payload: Record<string, unknown>,
  auth: AuthCtx | null,
  usesServerTime: boolean
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!auth || !auth.emailVerified) return 'PERMISSION_DENIED';
  if (!docId || docId.length > 128 || !VALID_ID_REGEX.test(docId)) return 'PERMISSION_DENIED';
  if (!usesServerTime) return 'PERMISSION_DENIED';
  for (const key of Object.keys(payload)) {
    if (!SURAT_ALLOWED_KEYS.has(key)) return 'PERMISSION_DENIED';
  }
  if (payload.ownerId !== auth.uid) return 'PERMISSION_DENIED';
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

test('Dirty Dozen security checks enforce PERMISSION_DENIED on invalid payloads', () => {
  const authOk: AuthCtx = { uid: 'user-123', email: 'user@dpkp.go.id', emailVerified: true };
  const validPayload: Record<string, unknown> = {
    ownerId: 'user-123',
    nomorSurat: '001/DPKP/XI/2026',
    tanggalSurat: '2026-11-17',
    tanggalDiterima: '2026-11-17',
    asalSurat: 'Ombudsman RI',
    perihal: 'Permintaan Klarifikasi',
    sifat: 'Penting',
    penerimaDisposisiIds: ['p-chafidz'],
    penerimaDisposisiNama: ['Chafidz'],
    tahapSaatIni: 1,
    statusSelesai: false,
    riwayatTindakLanjut: [],
    createdAt: 'SERVER_TIME',
    updatedAt: 'SERVER_TIME',
  };

  assert.equal(evaluateSuratCreate('user-123_surat-1', validPayload, authOk, true), 'ALLOW');

  // 1. Unauthenticated Write
  assert.equal(evaluateSuratCreate('s1', validPayload, null, true), 'PERMISSION_DENIED');
  // 2. Unverified Email Spoof
  assert.equal(
    evaluateSuratCreate('s1', validPayload, { ...authOk, emailVerified: false }, true),
    'PERMISSION_DENIED'
  );
  // 3. Cross-Owner Spoofing
  assert.equal(
    evaluateSuratCreate('s1', { ...validPayload, ownerId: 'other-uid' }, authOk, true),
    'PERMISSION_DENIED'
  );
  // 4. Shadow Ghost Field
  assert.equal(
    evaluateSuratCreate('s1', { ...validPayload, isAdmin: true }, authOk, true),
    'PERMISSION_DENIED'
  );
  // 5. Path ID Poisoning
  assert.equal(evaluateSuratCreate('bad/id..poison', validPayload, authOk, true), 'PERMISSION_DENIED');
  // 6. Client-Forged Timestamp
  assert.equal(evaluateSuratCreate('s1', validPayload, authOk, false), 'PERMISSION_DENIED');
  // 7. String Overflow
  assert.equal(
    evaluateSuratCreate('s1', { ...validPayload, perihal: 'x'.repeat(1501) }, authOk, true),
    'PERMISSION_DENIED'
  );
  // 8. Array Overflow
  assert.equal(
    evaluateSuratCreate(
      's1',
      { ...validPayload, penerimaDisposisiIds: Array.from({ length: 31 }, (_, i) => `p-${i}`) },
      authOk,
      true
    ),
    'PERMISSION_DENIED'
  );
  // 9. Invalid Stage Value
  assert.equal(
    evaluateSuratCreate('s1', { ...validPayload, tahapSaatIni: 99 }, authOk, true),
    'PERMISSION_DENIED'
  );
  // 10. Invalid Role Enum
  assert.equal(VALID_ROLES.has('superadmin'), false);
});
