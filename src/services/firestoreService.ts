import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  DokumenFile,
  PejabatConfig,
  Personel,
  RiwayatTindakLanjut,
  Role,
  SuratMasuk,
  TahapTindakLanjutId,
} from '../types';
import {
  INITIAL_PEJABAT,
  INITIAL_PERSONEL,
  INITIAL_SURAT_MASUK,
} from '../data/initialData';

// Volumetric bounds synchronized verbatim with firebase-blueprint.json & firestore.rules
const LIMITS = {
  ID: 128,
  NAMA: 150,
  NIP: 60,
  JABATAN: 200,
  INSTANSI: 200,
  EMAIL: 150,
  NOMOR_AGENDA: 100,
  NOMOR_SURAT: 150,
  DATE_STR: 40,
  ASAL_SURAT: 250,
  PERIHAL: 1500,
  INSTRUKSI: 1500,
  PERIHAL_KELUAR: 1000,
  FILE_NAMA: 255,
  FILE_DATA_URL: 250000,
  MAX_DISPOSISI_ARRAY: 30,
  MAX_RIWAYAT_ARRAY: 50,
};

function clampStr(val: string | undefined, maxLen: number): string {
  if (!val) return '';
  return val.trim().slice(0, maxLen);
}

function formatTimestamp(ts: unknown): string {
  if (ts instanceof Timestamp) {
    return ts.toDate().toISOString().replace('T', ' ').substring(0, 16);
  }
  if (typeof ts === 'string') return ts;
  return new Date().toISOString().replace('T', ' ').substring(0, 16);
}

function cacheLargePdfLocally(suratId: string, kind: 'masuk' | 'keluar', dataUrl?: string) {
  if (!dataUrl) return;
  try {
    localStorage.setItem(`sipantau_pdf_${kind}_${suratId}`, dataUrl);
  } catch {
    // ignore localStorage quota overflow
  }
}

function getCachedPdfLocally(suratId: string, kind: 'masuk' | 'keluar'): string | undefined {
  try {
    return localStorage.getItem(`sipantau_pdf_${kind}_${suratId}`) || undefined;
  } catch {
    return undefined;
  }
}

function sanitizeDokumenFile(
  file: DokumenFile,
  suratId: string,
  kind: 'masuk' | 'keluar'
): Record<string, string> {
  const clean: Record<string, string> = {
    nama: clampStr(file.nama || 'Dokumen.pdf', LIMITS.FILE_NAMA) || 'Dokumen.pdf',
    ukuran: clampStr(file.ukuran || '1.0 MB', LIMITS.DATE_STR) || '1.0 MB',
    tipe: clampStr(file.tipe || 'application/pdf', 100) || 'application/pdf',
    tanggalUnggah:
      clampStr(file.tanggalUnggah, LIMITS.DATE_STR) ||
      new Date().toISOString().replace('T', ' ').substring(0, 16),
    pengunggah: clampStr(file.pengunggah || 'Staf', LIMITS.NAMA) || 'Staf',
  };

  if (file.dataUrl) {
    if (file.dataUrl.length <= LIMITS.FILE_DATA_URL) {
      clean.dataUrl = file.dataUrl;
    } else {
      cacheLargePdfLocally(suratId, kind, file.dataUrl);
    }
  }

  return clean;
}

function sanitizePejabatConfig(cfg: PejabatConfig) {
  return {
    kepalaDinas: {
      nama: clampStr(cfg.kepalaDinas.nama, LIMITS.NAMA) || '-',
      nip: clampStr(cfg.kepalaDinas.nip, LIMITS.NIP),
      jabatan: clampStr(cfg.kepalaDinas.jabatan, LIMITS.JABATAN) || 'Kepala Dinas',
      instansi: clampStr(cfg.kepalaDinas.instansi, LIMITS.INSTANSI) || 'DPKP',
    },
    kepalaBidang: {
      nama: clampStr(cfg.kepalaBidang.nama, LIMITS.NAMA) || '-',
      nip: clampStr(cfg.kepalaBidang.nip, LIMITS.NIP),
      jabatan: clampStr(cfg.kepalaBidang.jabatan, LIMITS.JABATAN) || 'Kepala Bidang',
    },
    ketuaTim: {
      nama: clampStr(cfg.ketuaTim.nama, LIMITS.NAMA) || '-',
      nip: clampStr(cfg.ketuaTim.nip, LIMITS.NIP),
      jabatan: clampStr(cfg.ketuaTim.jabatan, LIMITS.JABATAN) || 'Ketua Tim',
    },
  };
}

function sanitizeRiwayat(riwayat: RiwayatTindakLanjut[]): RiwayatTindakLanjut[] {
  return riwayat.slice(-LIMITS.MAX_RIWAYAT_ARRAY).map((r) => {
    const entry: RiwayatTindakLanjut = {
      id: clampStr(r.id, LIMITS.ID) || `r-${Date.now()}`,
      tahapId: r.tahapId,
      tahapNama: clampStr(r.tahapNama, 200),
      tanggal: clampStr(r.tanggal, LIMITS.DATE_STR),
      aktor: clampStr(r.aktor, LIMITS.NAMA),
      catatan: clampStr(r.catatan, LIMITS.INSTRUKSI),
    };
    if (r.fileLampiran) {
      entry.fileLampiran = {
        nama: clampStr(r.fileLampiran.nama, LIMITS.FILE_NAMA),
        ukuran: clampStr(r.fileLampiran.ukuran, LIMITS.DATE_STR),
      };
    }
    return entry;
  });
}

function docToSuratMasuk(id: string, data: Record<string, unknown>): SuratMasuk {
  const fileMasuk = data.fileSuratMasuk as DokumenFile | undefined;
  const fileKeluar = data.fileSuratKeluar as DokumenFile | undefined;

  return {
    id,
    nomorAgenda: (data.nomorAgenda as string) || '',
    nomorSurat: (data.nomorSurat as string) || '',
    tanggalSurat: (data.tanggalSurat as string) || '',
    tanggalDiterima: (data.tanggalDiterima as string) || (data.tanggalSurat as string) || '',
    asalSurat: (data.asalSurat as string) || '',
    perihal: (data.perihal as string) || '',
    sifat: (data.sifat as SuratMasuk['sifat']) || 'Biasa',
    tanggalDisposisi: data.tanggalDisposisi as string | undefined,
    penerimaDisposisiIds: Array.isArray(data.penerimaDisposisiIds)
      ? (data.penerimaDisposisiIds as string[])
      : [],
    penerimaDisposisiNama: Array.isArray(data.penerimaDisposisiNama)
      ? (data.penerimaDisposisiNama as string[])
      : [],
    instruksiDisposisi: data.instruksiDisposisi as string | undefined,
    catatanDisposisiKetuaTim: data.catatanDisposisiKetuaTim as string | undefined,
    tenggatWaktu: data.tenggatWaktu as string | undefined,
    tahapSaatIni: (data.tahapSaatIni as TahapTindakLanjutId) || 1,
    statusSelesai: Boolean(data.statusSelesai),
    tanggalSelesai: data.tanggalSelesai as string | undefined,
    riwayatTindakLanjut: Array.isArray(data.riwayatTindakLanjut)
      ? (data.riwayatTindakLanjut as RiwayatTindakLanjut[])
      : [],
    fileSuratMasuk: fileMasuk
      ? {
          ...fileMasuk,
          dataUrl: fileMasuk.dataUrl || getCachedPdfLocally(id, 'masuk'),
        }
      : undefined,
    fileSuratKeluar: fileKeluar
      ? {
          ...fileKeluar,
          dataUrl: fileKeluar.dataUrl || getCachedPdfLocally(id, 'keluar'),
        }
      : undefined,
    nomorSuratKeluar: data.nomorSuratKeluar as string | undefined,
    tanggalSuratKeluar: data.tanggalSuratKeluar as string | undefined,
    perihalSuratKeluar: data.perihalSuratKeluar as string | undefined,
    createdAt: formatTimestamp(data.createdAt),
    updatedAt: formatTimestamp(data.updatedAt),
  };
}

export async function ensureWorkspaceInitialized(user: User): Promise<void> {
  const uid = user.uid;
  const userInfoPath = `users/${uid}/private/info`;
  const userInfoRef = doc(db, 'users', uid, 'private', 'info');

  try {
    const existingInfo = await getDoc(userInfoRef);
    if (!existingInfo.exists()) {
      await setDoc(userInfoRef, {
        uid,
        email: clampStr(user.email || 'user@dpkp.go.id', 200),
        displayName: clampStr(user.displayName || 'Pengguna', LIMITS.NAMA),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userInfoRef, {
        email: clampStr(user.email || 'user@dpkp.go.id', 200),
        displayName: clampStr(user.displayName || 'Pengguna', LIMITS.NAMA),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userInfoPath);
  }

  const workspacePath = `workspaces/${uid}`;
  const workspaceRef = doc(db, 'workspaces', uid);

  try {
    const wsSnap = await getDoc(workspaceRef);
    if (!wsSnap.exists() || wsSnap.data()?.seeded !== true) {
      const batch = writeBatch(db);
      const idPrefix = uid.slice(0, 20);
      const cleanPejabat = sanitizePejabatConfig(INITIAL_PEJABAT);

      batch.set(workspaceRef, {
        ownerId: uid,
        seeded: true,
        ...cleanPejabat,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const idMap = new Map<string, string>();
      for (const p of INITIAL_PERSONEL) {
        const docId = `${idPrefix}_${p.id}`;
        idMap.set(p.id, docId);
        const pPayload: Record<string, unknown> = {
          ownerId: uid,
          nama: clampStr(p.nama, LIMITS.NAMA),
          jabatan: clampStr(p.jabatan, LIMITS.JABATAN),
          peran: p.peran,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (p.nip) pPayload.nip = clampStr(p.nip, LIMITS.NIP);
        if (p.email) pPayload.email = clampStr(p.email, LIMITS.EMAIL);
        if (typeof p.isKetuaTim === 'boolean') pPayload.isKetuaTim = p.isKetuaTim;
        batch.set(doc(db, 'personel', docId), pPayload);
      }

      for (const s of INITIAL_SURAT_MASUK) {
        const docId = `${idPrefix}_${s.id}`;
        const mappedIds = s.penerimaDisposisiIds
          .map((pid) => idMap.get(pid) || pid)
          .slice(0, LIMITS.MAX_DISPOSISI_ARRAY);

        const sPayload: Record<string, unknown> = {
          ownerId: uid,
          nomorSurat: clampStr(s.nomorSurat, LIMITS.NOMOR_SURAT) || 'SM/DPKP',
          tanggalSurat: clampStr(s.tanggalSurat, LIMITS.DATE_STR),
          tanggalDiterima: clampStr(s.tanggalDiterima || s.tanggalSurat, LIMITS.DATE_STR),
          asalSurat: clampStr(s.asalSurat, LIMITS.ASAL_SURAT),
          perihal: clampStr(s.perihal, LIMITS.PERIHAL),
          sifat: s.sifat,
          penerimaDisposisiIds: mappedIds,
          penerimaDisposisiNama: s.penerimaDisposisiNama.slice(0, LIMITS.MAX_DISPOSISI_ARRAY),
          tahapSaatIni: s.tahapSaatIni,
          statusSelesai: Boolean(s.statusSelesai),
          riwayatTindakLanjut: sanitizeRiwayat(s.riwayatTindakLanjut),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (s.nomorAgenda) sPayload.nomorAgenda = clampStr(s.nomorAgenda, LIMITS.NOMOR_AGENDA);
        if (s.tanggalDisposisi) sPayload.tanggalDisposisi = clampStr(s.tanggalDisposisi, LIMITS.DATE_STR);
        if (s.instruksiDisposisi) sPayload.instruksiDisposisi = clampStr(s.instruksiDisposisi, LIMITS.INSTRUKSI);
        if (s.catatanDisposisiKetuaTim) {
          sPayload.catatanDisposisiKetuaTim = clampStr(s.catatanDisposisiKetuaTim, LIMITS.INSTRUKSI);
        }
        if (s.tenggatWaktu) sPayload.tenggatWaktu = clampStr(s.tenggatWaktu, LIMITS.DATE_STR);
        if (s.tanggalSelesai) sPayload.tanggalSelesai = clampStr(s.tanggalSelesai, LIMITS.DATE_STR);
        if (s.fileSuratMasuk) {
          sPayload.fileSuratMasuk = sanitizeDokumenFile(s.fileSuratMasuk, docId, 'masuk');
        }
        if (s.fileSuratKeluar) {
          sPayload.fileSuratKeluar = sanitizeDokumenFile(s.fileSuratKeluar, docId, 'keluar');
        }

        batch.set(doc(db, 'suratMasuk', docId), sPayload);
      }

      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, workspacePath);
  }
}

export function subscribeWorkspace(
  uid: string,
  onData: (config: PejabatConfig) => void,
  onError: (err: Error) => void
) {
  const path = `workspaces/${uid}`;
  return onSnapshot(
    doc(db, 'workspaces', uid),
    (snapshot) => {
      if (snapshot.exists()) {
        const d = snapshot.data();
        if (d.kepalaDinas && d.kepalaBidang && d.ketuaTim) {
          onData({
            kepalaDinas: d.kepalaDinas,
            kepalaBidang: d.kepalaBidang,
            ketuaTim: d.ketuaTim,
          });
        }
      }
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export function subscribePersonel(
  uid: string,
  onData: (list: Personel[]) => void,
  onError: (err: Error) => void
) {
  const path = 'personel';
  const q = query(collection(db, path), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: Personel[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          nama: (d.nama as string) || '',
          nip: d.nip as string | undefined,
          jabatan: (d.jabatan as string) || '',
          peran: (d.peran as Role) || 'staf',
          email: d.email as string | undefined,
          isKetuaTim: typeof d.isKetuaTim === 'boolean' ? d.isKetuaTim : d.peran === 'ketua_tim',
        };
      });
      list.sort((a, b) => {
        if (a.peran === 'ketua_tim' && b.peran !== 'ketua_tim') return -1;
        if (b.peran === 'ketua_tim' && a.peran !== 'ketua_tim') return 1;
        return a.nama.localeCompare(b.nama);
      });
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export function subscribeSuratMasuk(
  uid: string,
  onData: (list: SuratMasuk[]) => void,
  onError: (err: Error) => void
) {
  const path = 'suratMasuk';
  const q = query(collection(db, path), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((docSnap) =>
        docToSuratMasuk(docSnap.id, docSnap.data() as Record<string, unknown>)
      );
      list.sort((a, b) => {
        const cmpDate = (b.tanggalSurat || '').localeCompare(a.tanggalSurat || '');
        if (cmpDate !== 0) return cmpDate;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function createSuratMasukDb(
  uid: string,
  suratData: Partial<SuratMasuk>,
  pejabatConfig: PejabatConfig
): Promise<string> {
  const id = `surat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const path = `suratMasuk/${id}`;
  const tanggalSurat =
    clampStr(suratData.tanggalSurat, LIMITS.DATE_STR) ||
    new Date().toISOString().split('T')[0];

  const payload: Record<string, unknown> = {
    ownerId: uid,
    nomorSurat: clampStr(suratData.nomorSurat, LIMITS.NOMOR_SURAT) || 'SM/DPKP',
    tanggalSurat,
    tanggalDiterima: clampStr(suratData.tanggalDiterima, LIMITS.DATE_STR) || tanggalSurat,
    asalSurat: clampStr(suratData.asalSurat, LIMITS.ASAL_SURAT) || '-',
    perihal: clampStr(suratData.perihal, LIMITS.PERIHAL) || '-',
    sifat: suratData.sifat || 'Biasa',
    penerimaDisposisiIds: [],
    penerimaDisposisiNama: [],
    tahapSaatIni: 1,
    statusSelesai: false,
    riwayatTindakLanjut: sanitizeRiwayat([
      {
        id: `r-${Date.now()}-1`,
        tahapId: 1,
        tahapNama: 'Disposisi Diterima Dari Kepala Bidang Perumahan',
        tanggal: new Date().toISOString().replace('T', ' ').substring(0, 16),
        aktor: pejabatConfig.kepalaBidang.nama,
        catatan: 'Disposisi naskah dinas masuk diterima dari Kepala Bidang Perumahan.',
      },
    ]),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (suratData.fileSuratMasuk) {
    payload.fileSuratMasuk = sanitizeDokumenFile(suratData.fileSuratMasuk, id, 'masuk');
  }

  try {
    await setDoc(doc(db, 'suratMasuk', id), payload);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateDisposisiDb(
  suratId: string,
  penerimaIds: string[],
  penerimaNama: string[],
  instruksi: string,
  catatan: string,
  tanggalDisposisi: string,
  tenggatWaktu: string,
  tahapSaatIni: TahapTindakLanjutId,
  riwayatTindakLanjut: RiwayatTindakLanjut[]
): Promise<void> {
  const path = `suratMasuk/${suratId}`;
  try {
    await updateDoc(doc(db, 'suratMasuk', suratId), {
      penerimaDisposisiIds: penerimaIds.slice(0, LIMITS.MAX_DISPOSISI_ARRAY),
      penerimaDisposisiNama: penerimaNama
        .slice(0, LIMITS.MAX_DISPOSISI_ARRAY)
        .map((n) => clampStr(n, LIMITS.NAMA)),
      instruksiDisposisi: clampStr(instruksi, LIMITS.INSTRUKSI),
      catatanDisposisiKetuaTim: clampStr(catatan, LIMITS.INSTRUKSI),
      tanggalDisposisi: clampStr(tanggalDisposisi, LIMITS.DATE_STR),
      tenggatWaktu: clampStr(tenggatWaktu, LIMITS.DATE_STR),
      tahapSaatIni,
      riwayatTindakLanjut: sanitizeRiwayat(riwayatTindakLanjut),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateStageOrCatatanDb(
  suratId: string,
  tahapSaatIni: TahapTindakLanjutId,
  riwayatTindakLanjut: RiwayatTindakLanjut[]
): Promise<void> {
  const path = `suratMasuk/${suratId}`;
  try {
    await updateDoc(doc(db, 'suratMasuk', suratId), {
      tahapSaatIni,
      riwayatTindakLanjut: sanitizeRiwayat(riwayatTindakLanjut),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateStatusSelesaiDb(
  suratId: string,
  statusSelesai: boolean,
  tanggalSelesai: string | undefined,
  riwayatTindakLanjut: RiwayatTindakLanjut[]
): Promise<void> {
  const path = `suratMasuk/${suratId}`;
  try {
    await updateDoc(doc(db, 'suratMasuk', suratId), {
      statusSelesai,
      tanggalSelesai: statusSelesai
        ? clampStr(tanggalSelesai || new Date().toISOString().split('T')[0], LIMITS.DATE_STR)
        : deleteField(),
      riwayatTindakLanjut: sanitizeRiwayat(riwayatTindakLanjut),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function uploadSuratKeluarDb(
  suratId: string,
  fileData: DokumenFile,
  nomorSuratKeluar: string,
  tanggalSuratKeluar: string,
  perihalSuratKeluar: string,
  statusSelesai: boolean,
  tanggalSelesai: string | undefined,
  riwayatTindakLanjut: RiwayatTindakLanjut[]
): Promise<void> {
  const path = `suratMasuk/${suratId}`;
  try {
    const updatePayload: Record<string, unknown> = {
      fileSuratKeluar: sanitizeDokumenFile(fileData, suratId, 'keluar'),
      nomorSuratKeluar: clampStr(nomorSuratKeluar, LIMITS.NOMOR_SURAT),
      tanggalSuratKeluar: clampStr(tanggalSuratKeluar, LIMITS.DATE_STR),
      perihalSuratKeluar: clampStr(perihalSuratKeluar, LIMITS.PERIHAL_KELUAR),
      statusSelesai,
      riwayatTindakLanjut: sanitizeRiwayat(riwayatTindakLanjut),
      updatedAt: serverTimestamp(),
    };
    if (statusSelesai && tanggalSelesai) {
      updatePayload.tanggalSelesai = clampStr(tanggalSelesai, LIMITS.DATE_STR);
    }
    await updateDoc(doc(db, 'suratMasuk', suratId), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteSuratDb(suratId: string): Promise<void> {
  const path = `suratMasuk/${suratId}`;
  try {
    await deleteDoc(doc(db, 'suratMasuk', suratId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function updateWorkspacePejabatDb(
  uid: string,
  newPejabat: PejabatConfig
): Promise<void> {
  const path = `workspaces/${uid}`;
  try {
    await updateDoc(doc(db, 'workspaces', uid), {
      ...sanitizePejabatConfig(newPejabat),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createPersonelDb(
  uid: string,
  pData: Omit<Personel, 'id'>
): Promise<Personel> {
  const id = `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const path = `personel/${id}`;
  const payload: Record<string, unknown> = {
    ownerId: uid,
    nama: clampStr(pData.nama, LIMITS.NAMA) || '-',
    jabatan: clampStr(pData.jabatan, LIMITS.JABATAN) || 'Staf Tim',
    peran: pData.peran,
    isKetuaTim: pData.peran === 'ketua_tim' || Boolean(pData.isKetuaTim),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (pData.nip?.trim()) payload.nip = clampStr(pData.nip, LIMITS.NIP);
  if (pData.email?.trim()) payload.email = clampStr(pData.email, LIMITS.EMAIL);

  try {
    await setDoc(doc(db, 'personel', id), payload);
    return {
      ...pData,
      id,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updatePersonelDb(
  id: string,
  updated: Partial<Personel>
): Promise<void> {
  const path = `personel/${id}`;
  const updatePayload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (updated.nama !== undefined) updatePayload.nama = clampStr(updated.nama, LIMITS.NAMA) || '-';
  if (updated.nip !== undefined) {
    updatePayload.nip = updated.nip.trim() ? clampStr(updated.nip, LIMITS.NIP) : deleteField();
  }
  if (updated.jabatan !== undefined) {
    updatePayload.jabatan = clampStr(updated.jabatan, LIMITS.JABATAN) || 'Staf Tim';
  }
  if (updated.peran !== undefined) {
    updatePayload.peran = updated.peran;
    updatePayload.isKetuaTim = updated.peran === 'ketua_tim';
  }
  if (updated.email !== undefined) {
    updatePayload.email = updated.email.trim()
      ? clampStr(updated.email, LIMITS.EMAIL)
      : deleteField();
  }
  if (updated.isKetuaTim !== undefined) {
    updatePayload.isKetuaTim = Boolean(updated.isKetuaTim);
  }

  try {
    await updateDoc(doc(db, 'personel', id), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deletePersonelDb(id: string): Promise<void> {
  const path = `personel/${id}`;
  try {
    await deleteDoc(doc(db, 'personel', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
