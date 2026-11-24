import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNotifikasiDocId,
  computeDispositionNotificationDiff,
  countUnreadNotifications,
  filterNotificationsForAccount,
  getNotificationDeadlineInfo,
} from './notifikasiLogic.ts';
import type { NotifikasiDisposisi, SuratMasuk } from '../types/index.ts';

function makeNotif(overrides: Partial<NotifikasiDisposisi> = {}): NotifikasiDisposisi {
  return {
    id: 'notif-1',
    suratId: 'surat-1',
    recipientId: 'staf-chafidz',
    recipientNama: 'Chafidz Ginanjar, ST',
    nomorSurat: '001/DPKP/XI/2026',
    asalSurat: 'Ombudsman RI',
    perihal: 'Klarifikasi Pengaduan',
    sifat: 'Penting',
    instruksiDisposisi: 'Pelajari dan siapkan tanggapan.',
    tenggatWaktu: '2026-11-30',
    pengirimNama: 'Yuliani, ST',
    jenis: 'disposisi_baru',
    dibaca: false,
    createdAt: '2026-11-23 09:00',
    updatedAt: '2026-11-23 09:00',
    ...overrides,
  };
}

function makeSurat(overrides: Partial<SuratMasuk> = {}): SuratMasuk {
  return {
    id: 'surat-1',
    nomorSurat: '001/DPKP/XI/2026',
    tanggalSurat: '2026-11-20',
    tanggalDiterima: '2026-11-21',
    asalSurat: 'Ombudsman RI',
    perihal: 'Klarifikasi Pengaduan',
    sifat: 'Penting',
    penerimaDisposisiIds: ['staf-chafidz'],
    penerimaDisposisiNama: ['Chafidz Ginanjar, ST'],
    tahapSaatIni: 3,
    statusSelesai: false,
    riwayatTindakLanjut: [],
    createdAt: '2026-11-21 08:00',
    updatedAt: '2026-11-23 09:00',
    ...overrides,
  };
}

test('buildNotifikasiDocId creates valid deterministic Firestore document IDs <= 128 chars', () => {
  const shortId = buildNotifikasiDocId('surat-17639-abcd', 'internal_wasdal_p-chafidz');
  assert.equal(shortId, 'notif_surat-17639-abcd_internal_wasdal_p-chafidz');
  assert.ok(shortId.length <= 128);
  assert.match(shortId, /^[a-zA-Z0-9_-]+$/);

  const longId = buildNotifikasiDocId('surat/' + 'a'.repeat(90), 'user/' + 'b'.repeat(90));
  assert.ok(longId.length <= 128);
  assert.match(longId, /^[a-zA-Z0-9_-]+$/);
});

test('computeDispositionNotificationDiff identifies created, updated, and removed recipients', () => {
  const diff = computeDispositionNotificationDiff(
    ['staf-a', 'staf-b'],
    ['staf-b', 'staf-c', 'staf-b']
  );
  assert.deepEqual(diff.toCreate, ['staf-c']);
  assert.deepEqual(diff.toUpdate, ['staf-b']);
  assert.deepEqual(diff.toDelete, ['staf-a']);
});

test('filterNotificationsForAccount strictly scopes notifications to assigned recipients only', () => {
  const list = [
    makeNotif({ id: 'n1', suratId: 'surat-1', recipientId: 'staf-chafidz', dibaca: true, updatedAt: '2026-11-23 10:00' }),
    makeNotif({ id: 'n2', suratId: 'surat-2', recipientId: 'staf-chafidz', dibaca: false, updatedAt: '2026-11-23 08:00' }),
    makeNotif({ id: 'n3', suratId: 'surat-1', recipientId: 'staf-eva', dibaca: false }),
    makeNotif({ id: 'n4', suratId: 'surat-3', recipientId: 'staf-chafidz', dibaca: false }),
  ];

  const suratList = [
    makeSurat({ id: 'surat-1', penerimaDisposisiIds: ['staf-chafidz', 'staf-eva'] }),
    makeSurat({ id: 'surat-2', penerimaDisposisiIds: ['staf-chafidz'] }),
    // surat-3 no longer lists staf-chafidz -> stale notification filtered out
    makeSurat({ id: 'surat-3', penerimaDisposisiIds: ['staf-eva'] }),
  ];

  // Ketua Tim who did not receive disposition sees 0 notifications
  assert.deepEqual(
    filterNotificationsForAccount(list, { id: 'ketua-yuliani' }, suratList),
    []
  );

  // Chafidz sees only n2 (unread first) then n1 (read), excluding Eva's n3 and unassigned n4
  const chafidzVisible = filterNotificationsForAccount(list, { id: 'staf-chafidz' }, suratList);
  assert.deepEqual(
    chafidzVisible.map((n) => n.id),
    ['n2', 'n1']
  );
  assert.equal(countUnreadNotifications(chafidzVisible), 1);

  // Null account returns empty
  assert.deepEqual(filterNotificationsForAccount(list, null, suratList), []);
});

test('getNotificationDeadlineInfo classifies overdue, today, approaching, normal, and completed states', () => {
  assert.deepEqual(getNotificationDeadlineInfo('2026-11-20', true, '2026-11-23'), {
    label: 'Surat Selesai',
    tone: 'emerald',
  });
  assert.deepEqual(getNotificationDeadlineInfo('2026-11-21', false, '2026-11-23'), {
    label: 'Lewat 2 hari',
    tone: 'rose',
  });
  assert.deepEqual(getNotificationDeadlineInfo('2026-11-23', false, '2026-11-23'), {
    label: 'Tenggat Hari Ini',
    tone: 'amber',
  });
  assert.deepEqual(getNotificationDeadlineInfo('2026-11-25', false, '2026-11-23'), {
    label: 'Tenggat H-2',
    tone: 'amber',
  });
  assert.deepEqual(getNotificationDeadlineInfo('2026-11-30', false, '2026-11-23'), {
    label: 'Tenggat 2026-11-30',
    tone: 'slate',
  });
  assert.equal(getNotificationDeadlineInfo(undefined, false, '2026-11-23'), null);
});
