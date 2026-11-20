export type Role = 'ketua_tim' | 'administrator' | 'staf';

export type AccountCategory = 'ketua_tim' | 'administrator' | 'staf';

export interface Personel {
  id: string;
  nama: string;
  nip?: string;
  jabatan: string;
  peran: Role;
  email?: string;
  isKetuaTim?: boolean;
}

export interface LoginAccount {
  id: string;
  nama: string;
  nip?: string;
  jabatan: string;
  kategori: AccountCategory;
  peran: Role;
  displayRole: string;
}

export interface AkunKredensial {
  accountId: string;
  passwordHash: string;
  isDefaultReset: boolean;
  updatedAt?: string;
}

export interface PejabatConfig {
  kepalaDinas: {
    nama: string;
    nip: string;
    jabatan: string;
    instansi: string;
  };
  kepalaBidang: {
    nama: string;
    nip: string;
    jabatan: string;
  };
  ketuaTim: {
    nama: string;
    nip: string;
    jabatan: string;
  };
}

export type TahapTindakLanjutId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface TahapConfig {
  id: TahapTindakLanjutId;
  nama: string;
  deskripsi: string;
  aktorUtama: string;
  warna: string;
}

export interface RiwayatTindakLanjut {
  id: string;
  tahapId: TahapTindakLanjutId;
  tahapNama: string;
  tanggal: string; // YYYY-MM-DD or formatted
  aktor: string;
  catatan: string;
  fileLampiran?: {
    nama: string;
    ukuran: string;
    url?: string;
  };
}

export interface DokumenFile {
  nama: string;
  ukuran: string;
  tipe: string;
  tanggalUnggah: string;
  pengunggah: string;
  dataUrl?: string; // base64 or preview blob
}

export interface SuratMasuk {
  id: string;
  nomorAgenda?: string;
  nomorSurat: string;
  tanggalSurat: string;
  tanggalDiterima: string;
  asalSurat: string;
  perihal: string;
  sifat: 'Biasa' | 'Penting' | 'Segera' | 'Sangat Segera' | 'Rahasia';
  
  // Disposisi
  tanggalDisposisi?: string;
  penerimaDisposisiIds: string[]; // Personel IDs
  penerimaDisposisiNama: string[]; // Personel Names for quick view
  instruksiDisposisi?: string;
  catatanDisposisiKetuaTim?: string;
  tenggatWaktu?: string;

  // Tindak Lanjut
  tahapSaatIni: TahapTindakLanjutId;
  statusSelesai: boolean;
  tanggalSelesai?: string;
  riwayatTindakLanjut: RiwayatTindakLanjut[];

  // File Berkas
  fileSuratMasuk?: DokumenFile;
  fileSuratKeluar?: DokumenFile;
  nomorSuratKeluar?: string;
  tanggalSuratKeluar?: string;
  perihalSuratKeluar?: string;

  createdAt: string;
  updatedAt: string;
}
