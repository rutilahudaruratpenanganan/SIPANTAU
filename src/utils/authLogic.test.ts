import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_INITIAL_PASSWORD,
  IDLE_TIMEOUT_MINUTES,
  IDLE_TIMEOUT_MS,
  PEJABAT_KEPALA_BIDANG_ID,
  PEJABAT_KEPALA_DINAS_ID,
  buildLoginAccounts,
  getIdleRemainingMs,
  hashPassword,
  isSessionIdleExpired,
  isUsingDefaultPassword,
  parseStoredTimestamp,
  validatePasswordChange,
  verifyAccountPassword,
} from './authLogic.ts';
import type { PejabatConfig, Personel } from '../types/index.ts';

const samplePejabat: PejabatConfig = {
  kepalaDinas: {
    nama: 'Rizki Bhagja',
    nip: '19680512 199403 1 007',
    jabatan: 'Kepala Dinas Perumahan dan Kawasan Permukiman',
    instansi: 'DPKP Kota Bandung',
  },
  kepalaBidang: {
    nama: 'Rino Novian Subhan, ST',
    nip: '19710815 199803 1 004',
    jabatan: 'Kepala Bidang Perumahan',
  },
  ketuaTim: {
    nama: 'Yuliani, ST',
    nip: '19780420 200501 2 009',
    jabatan: 'Ketua Tim Pengawasan dan Pengendalian Perumahan',
  },
};

const samplePersonel: Personel[] = [
  {
    id: 'internal_wasdal_p-ketua',
    nama: 'Yuliani, ST',
    nip: '19780420 200501 2 009',
    jabatan: 'Ketua Tim Pengawasan dan Pengendalian Perumahan',
    peran: 'ketua_tim',
    isKetuaTim: true,
  },
  {
    id: 'internal_wasdal_p-admin',
    nama: 'Admin Operasional',
    jabatan: 'Administrator Wasdal',
    peran: 'administrator',
  },
  {
    id: 'internal_wasdal_p-chafidz',
    nama: 'Chafidz Ginanjar, ST',
    jabatan: 'Staf Wasdal',
    peran: 'staf',
  },
  {
    id: 'internal_wasdal_p-eva',
    nama: 'Eva Faoziah Alli, ST',
    jabatan: 'Staf Wasdal',
    peran: 'staf',
  },
];

test('buildLoginAccounts includes Ketua Tim, Administrator, and Staf Wasdal without Kepala Dinas or Kepala Bidang', () => {
  const accounts = buildLoginAccounts(samplePejabat, samplePersonel);

  assert.equal(accounts.length, 4);
  assert.equal(accounts[0].id, 'internal_wasdal_p-ketua');
  assert.equal(accounts[0].kategori, 'ketua_tim');
  assert.equal(accounts[0].peran, 'ketua_tim');
  assert.equal(accounts[0].displayRole, 'Ketua Tim');
  assert.equal(accounts[1].id, 'internal_wasdal_p-admin');
  assert.equal(accounts[1].kategori, 'administrator');
  assert.equal(accounts[1].peran, 'administrator');
  assert.equal(accounts[1].displayRole, 'Administrator');
  assert.equal(accounts[2].nama, 'Chafidz Ginanjar, ST');
  assert.equal(accounts[2].kategori, 'staf');
  assert.equal(accounts[2].displayRole, 'Staf Wasdal');
  assert.equal(accounts[3].nama, 'Eva Faoziah Alli, ST');
  assert.equal(
    accounts.some(
      (a) =>
        a.id === PEJABAT_KEPALA_DINAS_ID ||
        a.id === PEJABAT_KEPALA_BIDANG_ID ||
        a.displayRole === 'Kepala Dinas' ||
        a.displayRole === 'Kepala Bidang'
    ),
    false
  );
});

test('verifyAccountPassword defaults to "wasdal" when no custom hash exists or when reset', async () => {
  assert.equal(DEFAULT_INITIAL_PASSWORD, 'wasdal');
  assert.equal(isUsingDefaultPassword(null), true);
  assert.equal(await verifyAccountPassword('wasdal', null), true);
  assert.equal(await verifyAccountPassword('salah', null), false);

  const resetCred = {
    accountId: 'internal_wasdal_p-chafidz',
    passwordHash: 'abcdef0123456789:0000',
    isDefaultReset: true,
  };
  assert.equal(isUsingDefaultPassword(resetCred), true);
  assert.equal(await verifyAccountPassword('wasdal', resetCred), true);
  assert.equal(await verifyAccountPassword('custom123', resetCred), false);
});

test('hashPassword and verifyAccountPassword validate custom updated password', async () => {
  const hashed = await hashPassword('Rahasia2026!');
  assert.equal(hashed.includes(':'), true);
  assert.equal(hashed.length > 64, true);

  const cred = {
    accountId: 'internal_wasdal_p-chafidz',
    passwordHash: hashed,
    isDefaultReset: false,
  };
  assert.equal(isUsingDefaultPassword(cred), false);
  assert.equal(await verifyAccountPassword('Rahasia2026!', cred), true);
  assert.equal(await verifyAccountPassword('wasdal', cred), false);
});

test('validatePasswordChange enforces current password check, length, confirmation, and difference', async () => {
  const wrongCurrent = await validatePasswordChange({
    currentPasswordInput: 'bukanwasdal',
    newPassword: 'baru1234',
    confirmPassword: 'baru1234',
    storedCredential: null,
  });
  assert.equal(wrongCurrent.valid, false);

  const shortNew = await validatePasswordChange({
    currentPasswordInput: 'wasdal',
    newPassword: '123',
    confirmPassword: '123',
    storedCredential: null,
  });
  assert.equal(shortNew.valid, false);

  const mismatch = await validatePasswordChange({
    currentPasswordInput: 'wasdal',
    newPassword: 'baru1234',
    confirmPassword: 'beda1234',
    storedCredential: null,
  });
  assert.equal(mismatch.valid, false);

  const sameAsOld = await validatePasswordChange({
    currentPasswordInput: 'wasdal',
    newPassword: 'wasdal',
    confirmPassword: 'wasdal',
    storedCredential: null,
  });
  assert.equal(sameAsOld.valid, false);

  const valid = await validatePasswordChange({
    currentPasswordInput: 'wasdal',
    newPassword: 'PasswordBaru2026',
    confirmPassword: 'PasswordBaru2026',
    storedCredential: null,
  });
  assert.equal(valid.valid, true);
});

test('idle timeout enforces 30-minute threshold accurately across timestamps', () => {
  assert.equal(IDLE_TIMEOUT_MINUTES, 30);
  assert.equal(IDLE_TIMEOUT_MS, 1800000);

  assert.equal(parseStoredTimestamp(null), null);
  assert.equal(parseStoredTimestamp('abc'), null);
  assert.equal(parseStoredTimestamp('-5'), null);
  assert.equal(parseStoredTimestamp('1700000000000'), 1700000000000);

  const base = 1700000000000;
  // 29 minutes 59 seconds elapsed -> NOT expired
  assert.equal(isSessionIdleExpired(base, base + IDLE_TIMEOUT_MS - 1000), false);
  assert.equal(getIdleRemainingMs(base, base + IDLE_TIMEOUT_MS - 1000), 1000);

  // Exact 30 minutes elapsed -> expired
  assert.equal(isSessionIdleExpired(base, base + IDLE_TIMEOUT_MS), true);
  assert.equal(getIdleRemainingMs(base, base + IDLE_TIMEOUT_MS), 0);

  // Missing timestamp does not falsely mark fresh session expired
  assert.equal(isSessionIdleExpired(null, base + IDLE_TIMEOUT_MS), false);
});

