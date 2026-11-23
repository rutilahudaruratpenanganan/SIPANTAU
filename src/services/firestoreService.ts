import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  AgendaEvent,
  AgendaKategori,
  AgendaStatus,
  AkunKredensial,
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
import { normalizeRiwayatCatatan } from '../utils/disposisiLogic';

export const INTERNAL_WORKSPACE_ID = 'internal_wasdal';

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
  PDF_CHUNK_CHARS: 600000,
  PDF_MAX_CHUNKS: 30,
  MAX_DISPOSISI_ARRAY: 30,
  MAX_RIWAYAT_ARRAY: 50,
  JUDUL_AGENDA: 200,
  LOKASI_AGENDA: 250,
  PESERTA_TAMBAHAN: 300,
  TIME_STR: 10,
  CATATAN_AGENDA: 1500,
  ALASAN_STATUS: 500,
};

const pdfMemoryCache = new Map<string, string>();

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

function cacheLargePdfLocally(cacheKey: string, dataUrl?: string) {
  if (!dataUrl) return;
  pdfMemoryCache.set(cacheKey, dataUrl);
  try {
    localStorage.setItem(cacheKey, dataUrl);
  } catch {
    // ignore localStorage quota overflow
  }
}

function getCachedPdfLocally(suratId: string, kind: 'masuk' | 'keluar'): string | undefined {
  const legacyKey = `sipantau_pdf_${kind}_${suratId}`;
  const inMem = pdfMemoryCache.get(legacyKey);
  if (inMem) return inMem;
  try {
    return localStorage.getItem(legacyKey) || undefined;
  } catch {
    return undefined;
  }
}

function buildChunkPointer(
  suratId: string,
  kind: 'masuk' | 'keluar',
  totalChunks: number,
  uploadToken: string
): string {
  return `chunked://${suratId}/${kind}/${totalChunks}/${uploadToken}`;
}

export function isChunkedPdfUrl(url?: string): boolean {
  return Boolean(url && url.startsWith('chunked://'));
}

async function persistLargePdfChunks(
  suratId: string,
  kind: 'masuk' | 'keluar',
  dataUrl: string,
  uploadToken: string
): Promise<string> {
  const totalChunks = Math.ceil(dataUrl.length / LIMITS.PDF_CHUNK_CHARS);
  if (totalChunks > LIMITS.PDF_MAX_CHUNKS) {
    throw new Error(
      'Ukuran berkas PDF terlalu besar untuk disimpan ke Cloud Firestore (maksimal 12 MB).'
    );
  }

  const pointer = buildChunkPointer(suratId, kind, totalChunks, uploadToken);
  const chunksCol = collection(db, 'suratMasuk', suratId, 'berkasChunks');
  const existingSnap = await getDocs(
    query(chunksCol, where('ownerId', '==', INTERNAL_WORKSPACE_ID))
  );

  const batch = writeBatch(db);
  for (const oldDoc of existingSnap.docs) {
    if (oldDoc.data().kind === kind) {
      batch.delete(oldDoc.ref);
    }
  }

  for (let idx = 0; idx < totalChunks; idx++) {
    const start = idx * LIMITS.PDF_CHUNK_CHARS;
    const content = dataUrl.slice(start, start + LIMITS.PDF_CHUNK_CHARS);
    const chunkId = `${kind}_${uploadToken}_${idx}`;
    batch.set(doc(db, 'suratMasuk', suratId, 'berkasChunks', chunkId), {
      ownerId: INTERNAL_WORKSPACE_ID,
      kind,
      chunkIndex: idx,
      totalChunks,
      content,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
  cacheLargePdfLocally(pointer, dataUrl);
  cacheLargePdfLocally(`sipantau_pdf_${kind}_${suratId}`, dataUrl);
  return pointer;
}

export async function loadPdfDataUrlFromFirestore(chunkPointer: string): Promise<string> {
  const memHit = pdfMemoryCache.get(chunkPointer);
  if (memHit) return memHit;

  try {
    const localHit = localStorage.getItem(chunkPointer);
    if (localHit && localHit.startsWith('data:')) {
      pdfMemoryCache.set(chunkPointer, localHit);
      return localHit;
    }
  } catch {
    // ignore storage access issues
  }

  // Parse chunked://<suratId>/<kind>/<totalChunks>/<token>
  const stripped = chunkPointer.replace('chunked://', '');
  const parts = stripped.split('/');
  const suratId = parts[0];
  const kind = parts[1] as 'masuk' | 'keluar';
  const expectedTotal = Number(parts[2] || '0');
  const token = parts[3] || '';

  if (!suratId || !kind) {
    throw new Error('Referensi dokumen PDF tidak valid.');
  }

  const chunksCol = collection(db, 'suratMasuk', suratId, 'berkasChunks');
  const snap = await getDocs(
    query(chunksCol, where('ownerId', '==', INTERNAL_WORKSPACE_ID))
  );

  const matchingDocs = snap.docs
    .filter((d) => {
      const data = d.data();
      if (data.kind !== kind) return false;
      if (token && snap.docs.some((x) => x.id.startsWith(`${kind}_${token}_`))) {
        return d.id.startsWith(`${kind}_${token}_`);
      }
      return true;
    })
    .sort((a, b) => Number(a.data().chunkIndex) - Number(b.data().chunkIndex));

  if (matchingDocs.length === 0 || (expectedTotal > 0 && matchingDocs.length < expectedTotal)) {
    throw new Error('Sebagian atau seluruh potongan berkas PDF tidak ditemukan di Cloud Firestore.');
  }

  const assembled = matchingDocs.map((d) => String(d.data().content || '')).join('');
  if (!assembled) {
    throw new Error('Isi berkas PDF kosong.');
  }

  cacheLargePdfLocally(chunkPointer, assembled);
  return assembled;
}

function sanitizeDokumenFile(
  file: DokumenFile,
  suratId: string,
  kind: 'masuk' | 'keluar',
  overrideDataUrl?: string
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

  const finalUrl = overrideDataUrl !== undefined ? overrideDataUrl : file.dataUrl;
  if (finalUrl) {
    if (finalUrl.length <= LIMITS.FILE_DATA_URL) {
      clean.dataUrl = finalUrl;
    } else {
      cacheLargePdfLocally(`sipantau_pdf_${kind}_${suratId}`, finalUrl);
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
      catatan: normalizeRiwayatCatatan(clampStr(r.catatan, LIMITS.INSTRUKSI)),
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
      ? (data.riwayatTindakLanjut as RiwayatTindakLanjut[]).map((r) => ({
          ...r,
          catatan: normalizeRiwayatCatatan(r.catatan || ''),
        }))
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

export async function ensureWorkspaceInitialized(): Promise<void> {
  const uid = INTERNAL_WORKSPACE_ID;
  const workspacePath = `workspaces/${uid}`;
  const workspaceRef = doc(db, 'workspaces', uid);

  try {
    const wsSnap = await getDoc(workspaceRef);
    if (!wsSnap.exists() || wsSnap.data()?.seeded !== true) {
      const batch = writeBatch(db);
      const idPrefix = uid;
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
  onData: (config: PejabatConfig) => void,
  onError: (err: Error) => void
) {
  const path = `workspaces/${INTERNAL_WORKSPACE_ID}`;
  return onSnapshot(
    doc(db, 'workspaces', INTERNAL_WORKSPACE_ID),
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
  onData: (list: Personel[]) => void,
  onError: (err: Error) => void
) {
  const path = 'personel';
  const q = query(collection(db, path), where('ownerId', '==', INTERNAL_WORKSPACE_ID));
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
      const roleOrder = (peran: Role): number => {
        if (peran === 'ketua_tim') return 0;
        if (peran === 'administrator') return 1;
        return 2;
      };
      list.sort((a, b) => {
        const cmpRole = roleOrder(a.peran) - roleOrder(b.peran);
        if (cmpRole !== 0) return cmpRole;
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
  onData: (list: SuratMasuk[]) => void,
  onError: (err: Error) => void
) {
  const path = 'suratMasuk';
  const q = query(collection(db, path), where('ownerId', '==', INTERNAL_WORKSPACE_ID));
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
  suratData: Partial<SuratMasuk>,
  pejabatConfig: PejabatConfig
): Promise<string> {
  const id = `surat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const path = `suratMasuk/${id}`;
  const tanggalSurat =
    clampStr(suratData.tanggalSurat, LIMITS.DATE_STR) ||
    new Date().toISOString().split('T')[0];

  const payload: Record<string, unknown> = {
    ownerId: INTERNAL_WORKSPACE_ID,
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
        catatan: 'Disposisi surat masuk diterima dari Kepala Bidang Perumahan.',
      },
    ]),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const rawMasukDataUrl = suratData.fileSuratMasuk?.dataUrl;
  const needsMasukChunking = Boolean(
    rawMasukDataUrl &&
      rawMasukDataUrl.startsWith('data:') &&
      rawMasukDataUrl.length > LIMITS.FILE_DATA_URL
  );
  const uploadToken = Date.now().toString(36);
  const totalMasukChunks = needsMasukChunking && rawMasukDataUrl
    ? Math.ceil(rawMasukDataUrl.length / LIMITS.PDF_CHUNK_CHARS)
    : 0;

  if (needsMasukChunking && totalMasukChunks > LIMITS.PDF_MAX_CHUNKS) {
    throw new Error('Ukuran berkas PDF melebihi batas maksimal 12 MB.');
  }

  if (suratData.fileSuratMasuk) {
    const pointer = needsMasukChunking
      ? buildChunkPointer(id, 'masuk', totalMasukChunks, uploadToken)
      : undefined;
    payload.fileSuratMasuk = sanitizeDokumenFile(
      suratData.fileSuratMasuk,
      id,
      'masuk',
      pointer
    );
  }

  try {
    await setDoc(doc(db, 'suratMasuk', id), payload);
    if (needsMasukChunking && rawMasukDataUrl) {
      try {
        await persistLargePdfChunks(id, 'masuk', rawMasukDataUrl, uploadToken);
      } catch (chunkErr) {
        await deleteDoc(doc(db, 'suratMasuk', id)).catch(() => {});
        throw chunkErr;
      }
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateSuratMasukDb(
  suratId: string,
  suratData: Partial<SuratMasuk>,
  riwayatTindakLanjut: RiwayatTindakLanjut[]
): Promise<void> {
  const path = `suratMasuk/${suratId}`;
  const tanggalSurat =
    clampStr(suratData.tanggalSurat, LIMITS.DATE_STR) ||
    new Date().toISOString().split('T')[0];

  const updatePayload: Record<string, unknown> = {
    nomorSurat: clampStr(suratData.nomorSurat, LIMITS.NOMOR_SURAT) || 'SM/DPKP',
    tanggalSurat,
    tanggalDiterima: clampStr(suratData.tanggalDiterima, LIMITS.DATE_STR) || tanggalSurat,
    asalSurat: clampStr(suratData.asalSurat, LIMITS.ASAL_SURAT) || '-',
    perihal: clampStr(suratData.perihal, LIMITS.PERIHAL) || '-',
    sifat: suratData.sifat || 'Biasa',
    riwayatTindakLanjut: sanitizeRiwayat(riwayatTindakLanjut),
    updatedAt: serverTimestamp(),
  };

  try {
    if (suratData.fileSuratMasuk) {
      const rawUrl = suratData.fileSuratMasuk.dataUrl;
      let overrideUrl: string | undefined;
      if (rawUrl && rawUrl.startsWith('data:') && rawUrl.length > LIMITS.FILE_DATA_URL) {
        overrideUrl = await persistLargePdfChunks(
          suratId,
          'masuk',
          rawUrl,
          Date.now().toString(36)
        );
      }
      updatePayload.fileSuratMasuk = sanitizeDokumenFile(
        suratData.fileSuratMasuk,
        suratId,
        'masuk',
        overrideUrl
      );
    }

    await updateDoc(doc(db, 'suratMasuk', suratId), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
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
    let overrideUrl: string | undefined;
    if (
      fileData.dataUrl &&
      fileData.dataUrl.startsWith('data:') &&
      fileData.dataUrl.length > LIMITS.FILE_DATA_URL
    ) {
      overrideUrl = await persistLargePdfChunks(
        suratId,
        'keluar',
        fileData.dataUrl,
        Date.now().toString(36)
      );
    }

    const updatePayload: Record<string, unknown> = {
      fileSuratKeluar: sanitizeDokumenFile(fileData, suratId, 'keluar', overrideUrl),
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
    const chunksCol = collection(db, 'suratMasuk', suratId, 'berkasChunks');
    const chunksSnap = await getDocs(
      query(chunksCol, where('ownerId', '==', INTERNAL_WORKSPACE_ID))
    );
    if (!chunksSnap.empty) {
      const batch = writeBatch(db);
      for (const c of chunksSnap.docs) {
        batch.delete(c.ref);
      }
      await batch.commit();
    }
    await deleteDoc(doc(db, 'suratMasuk', suratId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function updateWorkspacePejabatDb(
  newPejabat: PejabatConfig
): Promise<void> {
  const path = `workspaces/${INTERNAL_WORKSPACE_ID}`;
  try {
    await updateDoc(doc(db, 'workspaces', INTERNAL_WORKSPACE_ID), {
      ...sanitizePejabatConfig(newPejabat),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createPersonelDb(
  pData: Omit<Personel, 'id'>
): Promise<Personel> {
  const id = `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const path = `personel/${id}`;
  const payload: Record<string, unknown> = {
    ownerId: INTERNAL_WORKSPACE_ID,
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
    await deleteDoc(doc(db, 'akunKredensial', id)).catch(() => {});
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeAkunKredensial(
  onData: (map: Record<string, AkunKredensial>) => void,
  onError: (err: Error) => void
) {
  const path = 'akunKredensial';
  const q = query(collection(db, path), where('ownerId', '==', INTERNAL_WORKSPACE_ID));
  return onSnapshot(
    q,
    (snapshot) => {
      const map: Record<string, AkunKredensial> = {};
      for (const docSnap of snapshot.docs) {
        const d = docSnap.data();
        const accountId = (d.accountId as string) || docSnap.id;
        map[accountId] = {
          accountId,
          passwordHash: (d.passwordHash as string) || '',
          isDefaultReset: Boolean(d.isDefaultReset),
          updatedAt: d.updatedAt ? formatTimestamp(d.updatedAt) : undefined,
        };
      }
      onData(map);
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

export async function saveAkunPasswordDb(
  accountId: string,
  passwordHash: string,
  isDefaultReset = false
): Promise<void> {
  const path = `akunKredensial/${accountId}`;
  const ref = doc(db, 'akunKredensial', accountId);
  const safeHash = clampStr(passwordHash, 200);
  if (safeHash.length < 16) {
    throw new Error('Hash password tidak valid.');
  }

  try {
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) {
      await updateDoc(ref, {
        passwordHash: safeHash,
        isDefaultReset,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        ownerId: INTERNAL_WORKSPACE_ID,
        accountId: clampStr(accountId, LIMITS.ID),
        passwordHash: safeHash,
        isDefaultReset,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

function docToAgendaEvent(id: string, data: Record<string, unknown>): AgendaEvent {
  const rawStatus = data.status as AgendaStatus | undefined;
  const status: AgendaStatus =
    rawStatus === 'dibatalkan' || rawStatus === 'dijadwalkan_ulang' ? rawStatus : 'terjadwal';

  return {
    id,
    judul: (data.judul as string) || '',
    kategori: (data.kategori as AgendaKategori) || 'Rapat Koordinasi',
    tanggal: (data.tanggal as string) || '',
    sepanjangHari: Boolean(data.sepanjangHari),
    jamMulai: (data.jamMulai as string) || '09:00',
    jamSelesai: (data.jamSelesai as string) || '10:00',
    lokasi: (data.lokasi as string) || '',
    pesertaIds: Array.isArray(data.pesertaIds) ? (data.pesertaIds as string[]) : [],
    pesertaNama: Array.isArray(data.pesertaNama) ? (data.pesertaNama as string[]) : [],
    pesertaTambahan: (data.pesertaTambahan as string | undefined) || undefined,
    catatan: (data.catatan as string | undefined) || undefined,
    status,
    tanggalSebelumnya: (data.tanggalSebelumnya as string | undefined) || undefined,
    alasanStatus: (data.alasanStatus as string | undefined) || undefined,
    statusDiubahOleh: (data.statusDiubahOleh as string | undefined) || undefined,
    statusDiubahPada: (data.statusDiubahPada as string | undefined) || undefined,
    dibuatOlehId: (data.dibuatOlehId as string) || '',
    dibuatOlehNama: (data.dibuatOlehNama as string) || '',
    createdAt: formatTimestamp(data.createdAt),
    updatedAt: formatTimestamp(data.updatedAt),
  };
}

export function subscribeAgendaEvents(
  onData: (list: AgendaEvent[]) => void,
  onError: (err: Error) => void
) {
  const path = 'agenda';
  const q = query(collection(db, path), where('ownerId', '==', INTERNAL_WORKSPACE_ID));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((docSnap) =>
        docToAgendaEvent(docSnap.id, docSnap.data() as Record<string, unknown>)
      );
      list.sort((a, b) => {
        const cmpDate = (a.tanggal || '').localeCompare(b.tanggal || '');
        if (cmpDate !== 0) return cmpDate;
        if (a.sepanjangHari !== b.sepanjangHari) return a.sepanjangHari ? -1 : 1;
        return (a.jamMulai || '').localeCompare(b.jamMulai || '');
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

export interface AgendaMutationPayload {
  judul: string;
  kategori: AgendaKategori;
  tanggal: string;
  sepanjangHari: boolean;
  jamMulai: string;
  jamSelesai: string;
  lokasi: string;
  pesertaIds: string[];
  pesertaNama: string[];
  pesertaTambahan?: string;
  catatan?: string;
}

export async function createAgendaEventDb(
  input: AgendaMutationPayload,
  creator: { id: string; nama: string }
): Promise<string> {
  const id = `agenda-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const path = `agenda/${id}`;

  const payload: Record<string, unknown> = {
    ownerId: INTERNAL_WORKSPACE_ID,
    judul: clampStr(input.judul, LIMITS.JUDUL_AGENDA) || 'Agenda Kegiatan',
    kategori: input.kategori,
    tanggal: clampStr(input.tanggal, LIMITS.DATE_STR),
    sepanjangHari: Boolean(input.sepanjangHari),
    jamMulai: input.sepanjangHari
      ? '00:00'
      : clampStr(input.jamMulai, LIMITS.TIME_STR) || '09:00',
    jamSelesai: input.sepanjangHari
      ? '23:59'
      : clampStr(input.jamSelesai, LIMITS.TIME_STR) || '10:00',
    lokasi: clampStr(input.lokasi, LIMITS.LOKASI_AGENDA) || '-',
    pesertaIds: input.pesertaIds
      .slice(0, LIMITS.MAX_DISPOSISI_ARRAY)
      .map((p) => clampStr(p, LIMITS.ID))
      .filter(Boolean),
    pesertaNama: input.pesertaNama
      .slice(0, LIMITS.MAX_DISPOSISI_ARRAY)
      .map((n) => clampStr(n, LIMITS.NAMA))
      .filter(Boolean),
    status: 'terjadwal',
    dibuatOlehId: clampStr(creator.id, LIMITS.ID) || 'system',
    dibuatOlehNama: clampStr(creator.nama, LIMITS.NAMA) || 'Tim Wasdal',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (input.pesertaTambahan?.trim()) {
    payload.pesertaTambahan = clampStr(input.pesertaTambahan, LIMITS.PESERTA_TAMBAHAN);
  }
  if (input.catatan?.trim()) {
    payload.catatan = clampStr(input.catatan, LIMITS.CATATAN_AGENDA);
  }

  try {
    await setDoc(doc(db, 'agenda', id), payload);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateAgendaEventDb(
  agendaId: string,
  input: AgendaMutationPayload
): Promise<void> {
  const path = `agenda/${agendaId}`;
  const updatePayload: Record<string, unknown> = {
    judul: clampStr(input.judul, LIMITS.JUDUL_AGENDA) || 'Agenda Kegiatan',
    kategori: input.kategori,
    tanggal: clampStr(input.tanggal, LIMITS.DATE_STR),
    sepanjangHari: Boolean(input.sepanjangHari),
    jamMulai: input.sepanjangHari
      ? '00:00'
      : clampStr(input.jamMulai, LIMITS.TIME_STR) || '09:00',
    jamSelesai: input.sepanjangHari
      ? '23:59'
      : clampStr(input.jamSelesai, LIMITS.TIME_STR) || '10:00',
    lokasi: clampStr(input.lokasi, LIMITS.LOKASI_AGENDA) || '-',
    pesertaIds: input.pesertaIds
      .slice(0, LIMITS.MAX_DISPOSISI_ARRAY)
      .map((p) => clampStr(p, LIMITS.ID))
      .filter(Boolean),
    pesertaNama: input.pesertaNama
      .slice(0, LIMITS.MAX_DISPOSISI_ARRAY)
      .map((n) => clampStr(n, LIMITS.NAMA))
      .filter(Boolean),
    pesertaTambahan: input.pesertaTambahan?.trim()
      ? clampStr(input.pesertaTambahan, LIMITS.PESERTA_TAMBAHAN)
      : deleteField(),
    catatan: input.catatan?.trim()
      ? clampStr(input.catatan, LIMITS.CATATAN_AGENDA)
      : deleteField(),
    updatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(doc(db, 'agenda', agendaId), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function cancelAgendaEventDb(
  agendaId: string,
  actorNama: string,
  alasan?: string
): Promise<void> {
  const path = `agenda/${agendaId}`;
  const nowStamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
  const updatePayload: Record<string, unknown> = {
    status: 'dibatalkan',
    alasanStatus: alasan?.trim()
      ? clampStr(alasan, LIMITS.ALASAN_STATUS)
      : deleteField(),
    statusDiubahOleh: clampStr(actorNama, LIMITS.NAMA) || 'Tim Wasdal',
    statusDiubahPada: clampStr(nowStamp, LIMITS.DATE_STR),
    updatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(doc(db, 'agenda', agendaId), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export interface AgendaReschedulePayload {
  previousTanggal: string;
  tanggal: string;
  sepanjangHari: boolean;
  jamMulai: string;
  jamSelesai: string;
  lokasi: string;
  alasan?: string;
  actorNama: string;
}

export async function rescheduleAgendaEventDb(
  agendaId: string,
  input: AgendaReschedulePayload
): Promise<void> {
  const path = `agenda/${agendaId}`;
  const nowStamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
  const updatePayload: Record<string, unknown> = {
    status: 'dijadwalkan_ulang',
    tanggal: clampStr(input.tanggal, LIMITS.DATE_STR),
    tanggalSebelumnya: clampStr(input.previousTanggal, LIMITS.DATE_STR),
    sepanjangHari: Boolean(input.sepanjangHari),
    jamMulai: input.sepanjangHari
      ? '00:00'
      : clampStr(input.jamMulai, LIMITS.TIME_STR) || '09:00',
    jamSelesai: input.sepanjangHari
      ? '23:59'
      : clampStr(input.jamSelesai, LIMITS.TIME_STR) || '10:00',
    lokasi: clampStr(input.lokasi, LIMITS.LOKASI_AGENDA) || '-',
    alasanStatus: input.alasan?.trim()
      ? clampStr(input.alasan, LIMITS.ALASAN_STATUS)
      : deleteField(),
    statusDiubahOleh: clampStr(input.actorNama, LIMITS.NAMA) || 'Tim Wasdal',
    statusDiubahPada: clampStr(nowStamp, LIMITS.DATE_STR),
    updatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(doc(db, 'agenda', agendaId), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function reactivateAgendaEventDb(
  agendaId: string,
  actorNama: string
): Promise<void> {
  const path = `agenda/${agendaId}`;
  const nowStamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
  const updatePayload: Record<string, unknown> = {
    status: 'terjadwal',
    alasanStatus: deleteField(),
    statusDiubahOleh: clampStr(actorNama, LIMITS.NAMA) || 'Tim Wasdal',
    statusDiubahPada: clampStr(nowStamp, LIMITS.DATE_STR),
    updatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(doc(db, 'agenda', agendaId), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteAgendaEventDb(agendaId: string): Promise<void> {
  const path = `agenda/${agendaId}`;
  try {
    await deleteDoc(doc(db, 'agenda', agendaId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}


