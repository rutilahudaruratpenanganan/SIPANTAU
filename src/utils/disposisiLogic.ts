import type { SuratMasuk, TahapConfig, TahapTindakLanjutId, Role, Personel } from '../types/index.ts';

export const TAHAP_TINDAK_LANJUT: Record<TahapTindakLanjutId, TahapConfig> = {
  1: {
    id: 1,
    nama: 'Disposisi Diterima Dari Kepala Bidang Perumahan',
    deskripsi: 'Surat masuk telah diteruskan dan didisposisikan oleh Kepala Bidang Perumahan ke Tim Pengawasan dan Pengendalian Perumahan.',
    aktorUtama: 'Kepala Bidang Perumahan',
    warna: 'blue',
  },
  2: {
    id: 2,
    nama: 'Diterima Ketua Tim Pengawasan dan Pengendalian Perumahan',
    deskripsi: 'Ketua Tim telah menerima surat dan menelaah materi serta urgensi persuratan.',
    aktorUtama: 'Ketua Tim Pengawasan dan Pengendalian Perumahan',
    warna: 'indigo',
  },
  3: {
    id: 3,
    nama: 'Disposisi Tim Pengawasan dan Pengendalian Perumahan',
    deskripsi: 'Ketua Tim memberikan instruksi disposisi dan menunjuk personel/staf pelaksana tindak lanjut.',
    aktorUtama: 'Ketua Tim Pengawasan dan Pengendalian Perumahan',
    warna: 'purple',
  },
  4: {
    id: 4,
    nama: 'Pembuatan Draft Tanggapan/Jawaban/Surat',
    deskripsi: 'Personel/staf pelaksana menyusun konsep naskah dinas, telaahan staf, atau surat balasan.',
    aktorUtama: 'Staf Wasdal',
    warna: 'amber',
  },
  5: {
    id: 5,
    nama: 'Asistensi Ketua Tim Pengawasan dan Pengendalian Perumahan',
    deskripsi: 'Ketua Tim memeriksa, mengoreksi, dan menyetujui draft surat atau konsep tindak lanjut sebelum ke Kabid.',
    aktorUtama: 'Ketua Tim Pengawasan dan Pengendalian Perumahan',
    warna: 'orange',
  },
  6: {
    id: 6,
    nama: 'Asistensi Kepala Bidang Perumahan',
    deskripsi: 'Penyampaian draft tanggapan untuk ditelaah dan diparaf oleh Kepala Bidang Perumahan.',
    aktorUtama: 'Kepala Bidang Perumahan',
    warna: 'sky',
  },
  7: {
    id: 7,
    nama: 'Proses PESONA',
    deskripsi: 'Pengajuan tanda tangan elektronik Kepala Dinas melalui sistem PESONA (Pemerintah Kota/Daerah).',
    aktorUtama: 'Kepala Dinas',
    warna: 'emerald',
  },
};

export const LIST_TAHAP = Object.values(TAHAP_TINDAK_LANJUT);

export function getNextStage(current: TahapTindakLanjutId): TahapTindakLanjutId | null {
  if (current >= 7) return null;
  return (current + 1) as TahapTindakLanjutId;
}

export function getPrevStage(current: TahapTindakLanjutId): TahapTindakLanjutId | null {
  if (current <= 1) return null;
  return (current - 1) as TahapTindakLanjutId;
}

export function canAdvanceStage(role: Role, currentStage: TahapTindakLanjutId): boolean {
  if (role === 'ketua_tim') return true;
  // Staf can advance stage 4 (Drafting) to stage 5 (Asistensi Ketua Tim)
  // and upload surat keluar when approved
  if (role === 'staf' && currentStage === 4) return true;
  return false;
}

export function canDeleteSurat(role: Role): boolean {
  return role === 'ketua_tim';
}

export function canManagePersonel(role: Role): boolean {
  return role === 'ketua_tim';
}

export function canCreateDisposisi(role: Role): boolean {
  return role === 'ketua_tim';
}

export function canAccessBackup(role: Role): boolean {
  return role === 'ketua_tim';
}

export function canUploadSuratKeluar(surat: SuratMasuk): boolean {
  // Can upload surat keluar if it is at stage 4 or later (or when finishing)
  return surat.tahapSaatIni >= 4;
}

export interface FilterOptions {
  searchQuery?: string;
  tahapId?: TahapTindakLanjutId | 'selesai' | 'perlu_disposisi' | 'aktif' | 'all';
  personelName?: string | 'all';
  status?: 'all' | 'aktif' | 'selesai';
  sifat?: string | 'all';
}

export function filterSurat(list: SuratMasuk[], filters: FilterOptions): SuratMasuk[] {
  return list.filter((item) => {
    // Search query matches asal, perihal, nomor surat, nomor agenda
    if (filters.searchQuery && filters.searchQuery.trim() !== '') {
      const q = filters.searchQuery.toLowerCase().trim();
      const matchAsal = item.asalSurat.toLowerCase().includes(q);
      const matchPerihal = item.perihal.toLowerCase().includes(q);
      const matchNomor = item.nomorSurat.toLowerCase().includes(q);
      const matchAgenda = item.nomorAgenda ? item.nomorAgenda.toLowerCase().includes(q) : false;
      const matchPersonel = item.penerimaDisposisiNama.some((p) => p.toLowerCase().includes(q));
      if (!matchAsal && !matchPerihal && !matchNomor && !matchAgenda && !matchPersonel) {
        return false;
      }
    }

    // Filter by Tahap or Selesai or Perlu Disposisi or Aktif
    if (filters.tahapId && filters.tahapId !== 'all') {
      if (filters.tahapId === 'selesai') {
        if (!item.statusSelesai) return false;
      } else if (filters.tahapId === 'perlu_disposisi') {
        if (item.statusSelesai || (item.penerimaDisposisiIds && item.penerimaDisposisiIds.length > 0)) return false;
      } else if (filters.tahapId === 'aktif') {
        if (item.statusSelesai) return false;
      } else {
        if (item.tahapSaatIni !== filters.tahapId) return false;
      }
    }

    // Filter by Personel
    if (filters.personelName && filters.personelName !== 'all') {
      const hasPersonel = item.penerimaDisposisiNama.some(
        (p) => p.toLowerCase() === (filters.personelName as string).toLowerCase()
      );
      if (!hasPersonel) return false;
    }

    // Filter by Status
    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'selesai' && !item.statusSelesai) return false;
      if (filters.status === 'aktif' && item.statusSelesai) return false;
    }

    // Filter by Sifat
    if (filters.sifat && filters.sifat !== 'all') {
      if (item.sifat !== filters.sifat) return false;
    }

    return true;
  });
}

export interface DashboardStats {
  totalSurat: number;
  totalAktif: number;
  totalSelesai: number;
  totalPerluDisposisi: number;
  tahapCounts: Record<TahapTindakLanjutId, number>;
  totalDenganSuratKeluar: number;
  totalDalamPesona: number;
  totalDraftDanAsistensi: number;
  personelWorkload: { nama: string; count: number }[];
}

export function calculateDashboardStats(list: SuratMasuk[], personelList: Personel[]): DashboardStats {
  const stats: DashboardStats = {
    totalSurat: list.length,
    totalAktif: 0,
    totalSelesai: 0,
    totalPerluDisposisi: 0,
    tahapCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
    totalDenganSuratKeluar: 0,
    totalDalamPesona: 0,
    totalDraftDanAsistensi: 0,
    personelWorkload: [],
  };

  const workloadMap: Record<string, number> = {};
  personelList.forEach((p) => {
    workloadMap[p.nama] = 0;
  });

  list.forEach((item) => {
    if (item.statusSelesai) {
      stats.totalSelesai += 1;
    } else {
      stats.totalAktif += 1;
    }

    if (!item.statusSelesai && (!item.penerimaDisposisiIds || item.penerimaDisposisiIds.length === 0)) {
      stats.totalPerluDisposisi += 1;
    }

    if (item.tahapSaatIni in stats.tahapCounts) {
      stats.tahapCounts[item.tahapSaatIni] += 1;
    }

    if (item.fileSuratKeluar) {
      stats.totalDenganSuratKeluar += 1;
    }

    if (item.tahapSaatIni === 7) {
      stats.totalDalamPesona += 1;
    }

    if (item.tahapSaatIni === 4 || item.tahapSaatIni === 5 || item.tahapSaatIni === 6) {
      stats.totalDraftDanAsistensi += 1;
    }

    item.penerimaDisposisiNama.forEach((nama) => {
      workloadMap[nama] = (workloadMap[nama] || 0) + 1;
    });
  });

  stats.personelWorkload = Object.entries(workloadMap)
    .map(([nama, count]) => ({ nama, count }))
    .sort((a, b) => b.count - a.count);

  return stats;
}

export function normalizeRiwayatCatatan(catatan: string): string {
  if (!catatan) return '';
  return catatan.replace(
    /Disposisi naskah dinas masuk diterima dari Kepala Bidang Perumahan\.?/gi,
    'Disposisi surat masuk diterima dari Kepala Bidang Perumahan.'
  );
}
