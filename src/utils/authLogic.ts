import type { AkunKredensial, LoginAccount, PejabatConfig, Personel } from '../types/index.ts';

export const DEFAULT_INITIAL_PASSWORD = 'wasdal';

export const PEJABAT_KEPALA_DINAS_ID = 'pejabat_kepala_dinas';
export const PEJABAT_KEPALA_BIDANG_ID = 'pejabat_kepala_bidang';
export const PEJABAT_KETUA_TIM_ID = 'pejabat_ketua_tim';

/**
 * Membangun daftar akun login dropdown berdasarkan daftar Ketua Tim dan Staf Wasdal
 * yang terdaftar pada aplikasi (Kepala Dinas dan Kepala Bidang tidak disertakan).
 */
export function buildLoginAccounts(
  pejabatConfig: PejabatConfig,
  personelList: Personel[]
): LoginAccount[] {
  const accounts: LoginAccount[] = [];
  const seenIds = new Set<string>();

  const pushUnique = (acc: LoginAccount) => {
    if (!acc.nama.trim() || seenIds.has(acc.id)) return;
    seenIds.add(acc.id);
    accounts.push(acc);
  };

  // Ketua Tim dari personelList diprioritaskan agar ID akun konsisten dengan ID personel
  const ketuaPersonel = personelList.filter(
    (p) => p.peran === 'ketua_tim' || Boolean(p.isKetuaTim)
  );
  if (ketuaPersonel.length > 0) {
    for (const kp of ketuaPersonel) {
      pushUnique({
        id: kp.id,
        nama: kp.nama.trim(),
        nip: kp.nip?.trim() || undefined,
        jabatan: kp.jabatan?.trim() || 'Ketua Tim Pengawasan dan Pengendalian Perumahan',
        kategori: 'ketua_tim',
        peran: 'ketua_tim',
        displayRole: 'Ketua Tim',
      });
    }
  } else if (pejabatConfig.ketuaTim?.nama?.trim()) {
    pushUnique({
      id: PEJABAT_KETUA_TIM_ID,
      nama: pejabatConfig.ketuaTim.nama.trim(),
      nip: pejabatConfig.ketuaTim.nip?.trim() || undefined,
      jabatan: pejabatConfig.ketuaTim.jabatan?.trim() || 'Ketua Tim Pengawasan dan Pengendalian Perumahan',
      kategori: 'ketua_tim',
      peran: 'ketua_tim',
      displayRole: 'Ketua Tim',
    });
  }

  // Staf Wasdal
  const stafList = personelList.filter(
    (p) => p.peran !== 'ketua_tim' && !p.isKetuaTim
  );
  for (const staf of stafList) {
    pushUnique({
      id: staf.id,
      nama: staf.nama.trim(),
      nip: staf.nip?.trim() || undefined,
      jabatan: staf.jabatan?.trim() || 'Staf Wasdal',
      kategori: 'staf',
      peran: 'staf',
      displayRole: 'Staf Wasdal',
    });
  }

  return accounts;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateSaltHex(byteLength = 16): string {
  const bytes = new Uint8Array(byteLength);
  if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteLength; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytesToHex(bytes);
}

/**
 * Menghasilkan hash SHA-256 tersalt dalam format "<saltHex>:<digestHex>"
 */
export async function hashPassword(password: string, existingSalt?: string): Promise<string> {
  const salt = existingSalt || generateSaltHex(16);
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${password}`);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
  const digestHex = bytesToHex(new Uint8Array(hashBuffer));
  return `${salt}:${digestHex}`;
}

export function isUsingDefaultPassword(storedCredential?: AkunKredensial | null): boolean {
  return !storedCredential || !storedCredential.passwordHash || Boolean(storedCredential.isDefaultReset);
}

/**
 * Memverifikasi password input terhadap kredensial tersimpan.
 * Bila akun belum pernah mengganti password (atau di-reset ke default), password awal adalah "wasdal".
 */
export async function verifyAccountPassword(
  passwordInput: string,
  storedCredential?: AkunKredensial | null
): Promise<boolean> {
  if (!passwordInput) return false;

  if (isUsingDefaultPassword(storedCredential)) {
    return passwordInput === DEFAULT_INITIAL_PASSWORD;
  }

  const stored = storedCredential!.passwordHash;
  const separatorIdx = stored.indexOf(':');
  if (separatorIdx <= 0) return false;

  const salt = stored.slice(0, separatorIdx);
  const recomputed = await hashPassword(passwordInput, salt);
  return recomputed === stored;
}

export async function validatePasswordChange(params: {
  currentPasswordInput: string;
  newPassword: string;
  confirmPassword: string;
  storedCredential?: AkunKredensial | null;
}): Promise<{ valid: boolean; error?: string }> {
  const { currentPasswordInput, newPassword, confirmPassword, storedCredential } = params;

  if (!currentPasswordInput) {
    return { valid: false, error: 'Masukkan password saat ini terlebih dahulu.' };
  }

  const matchesCurrent = await verifyAccountPassword(currentPasswordInput, storedCredential);
  if (!matchesCurrent) {
    return { valid: false, error: 'Password saat ini tidak sesuai.' };
  }

  if (newPassword.trim().length < 4) {
    return { valid: false, error: 'Password baru minimal 4 karakter.' };
  }

  if (newPassword.length > 100) {
    return { valid: false, error: 'Password baru maksimal 100 karakter.' };
  }

  if (newPassword !== confirmPassword) {
    return { valid: false, error: 'Konfirmasi password baru tidak cocok.' };
  }

  if (newPassword === currentPasswordInput) {
    return { valid: false, error: 'Password baru harus berbeda dari password saat ini.' };
  }

  return { valid: true };
}
