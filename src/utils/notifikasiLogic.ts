import type { LoginAccount, NotifikasiDisposisi, SuratMasuk } from '../types/index.ts';

function sanitizeIdPart(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Membangun ID dokumen deterministik untuk 1 pasangan (suratId, recipientId)
 * yang dijamin valid terhadap aturan Firestore (<= 128 karakter, [a-zA-Z0-9_-]+).
 */
export function buildNotifikasiDocId(suratId: string, recipientId: string): string {
  const sPart = sanitizeIdPart(suratId.trim()) || 'surat';
  const rPart = sanitizeIdPart(recipientId.trim()) || 'penerima';
  const raw = `notif_${sPart}_${rPart}`;
  if (raw.length <= 128) return raw;
  const suffix = `_${fnv1aHex(`${suratId}:${recipientId}`)}`;
  return raw.slice(0, 128 - suffix.length) + suffix;
}

/**
 * Menghitung diff penerima disposisi agar hanya penerima yang sah yang memiliki notifikasi:
 * - toCreate: penerima baru
 * - toUpdate: penerima tetap (diperbarui isi instruksi & status belum dibaca)
 * - toDelete: penerima yang dicabut dari disposisi
 */
export function computeDispositionNotificationDiff(
  previousRecipientIds: string[],
  nextRecipientIds: string[]
): {
  toCreate: string[];
  toUpdate: string[];
  toDelete: string[];
} {
  const prevUnique: string[] = [];
  const prevSet = new Set<string>();
  for (const id of previousRecipientIds) {
    const clean = id.trim();
    if (clean && !prevSet.has(clean)) {
      prevSet.add(clean);
      prevUnique.push(clean);
    }
  }

  const nextUnique: string[] = [];
  const nextSet = new Set<string>();
  for (const id of nextRecipientIds) {
    const clean = id.trim();
    if (clean && !nextSet.has(clean)) {
      nextSet.add(clean);
      nextUnique.push(clean);
    }
  }

  const toCreate: string[] = [];
  const toUpdate: string[] = [];
  const toDelete: string[] = [];

  for (const id of nextUnique) {
    if (prevSet.has(id)) {
      toUpdate.push(id);
    } else {
      toCreate.push(id);
    }
  }

  for (const id of prevUnique) {
    if (!nextSet.has(id)) {
      toDelete.push(id);
    }
  }

  return { toCreate, toUpdate, toDelete };
}

/**
 * Menyaring notifikasi secara ketat agar HANYA diterima oleh akun penerima disposisi yang dituju.
 * Bila data surat tersedia, memverifikasi pula bahwa akun masih tercantum di penerimaDisposisiIds.
 * Mengurutkan: belum dibaca di atas, lalu terbaru di atas.
 */
export function filterNotificationsForAccount(
  notifikasiList: NotifikasiDisposisi[],
  account: Pick<LoginAccount, 'id'> | null,
  suratList?: SuratMasuk[]
): NotifikasiDisposisi[] {
  if (!account || !account.id) return [];

  const suratMap = suratList
    ? new Map<string, SuratMasuk>(suratList.map((s) => [s.id, s]))
    : null;

  return notifikasiList
    .filter((n) => {
      if (n.recipientId !== account.id) return false;
      if (suratMap) {
        const linkedSurat = suratMap.get(n.suratId);
        if (linkedSurat && !linkedSurat.penerimaDisposisiIds.includes(account.id)) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      if (a.dibaca !== b.dibaca) return a.dibaca ? 1 : -1;
      const timeB = b.updatedAt || b.createdAt || '';
      const timeA = a.updatedAt || a.createdAt || '';
      const cmp = timeB.localeCompare(timeA);
      if (cmp !== 0) return cmp;
      return b.id.localeCompare(a.id);
    });
}

export function countUnreadNotifications(list: NotifikasiDisposisi[]): number {
  let count = 0;
  for (const item of list) {
    if (!item.dibaca) count++;
  }
  return count;
}

export interface DeadlineBadgeInfo {
  label: string;
  tone: 'rose' | 'amber' | 'emerald' | 'slate';
}

export function getNotificationDeadlineInfo(
  tenggatWaktu?: string,
  statusSelesai?: boolean,
  todayStr?: string
): DeadlineBadgeInfo | null {
  if (statusSelesai) {
    return { label: 'Surat Selesai', tone: 'emerald' };
  }
  if (!tenggatWaktu || !/^\d{4}-\d{2}-\d{2}$/.test(tenggatWaktu)) {
    return null;
  }

  const todayIso = todayStr || new Date().toISOString().split('T')[0];
  const [tY, tM, tD] = tenggatWaktu.split('-').map(Number);
  const [nY, nM, nD] = todayIso.split('-').map(Number);
  const targetMs = Date.UTC(tY, tM - 1, tD);
  const todayMs = Date.UTC(nY, nM - 1, nD);
  const diffDays = Math.round((targetMs - todayMs) / (24 * 60 * 60 * 1000));

  if (diffDays < 0) {
    return { label: `Lewat ${Math.abs(diffDays)} hari`, tone: 'rose' };
  }
  if (diffDays === 0) {
    return { label: 'Tenggat Hari Ini', tone: 'amber' };
  }
  if (diffDays <= 2) {
    return { label: `Tenggat H-${diffDays}`, tone: 'amber' };
  }
  return { label: `Tenggat ${tenggatWaktu}`, tone: 'slate' };
}
