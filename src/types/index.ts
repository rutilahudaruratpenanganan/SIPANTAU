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

export type AgendaKategori =
  | 'Rapat Koordinasi'
  | 'Tinjauan Lapangan'
  | 'Asistensi'
  | 'Audiensi'
  | 'Lainnya';

export type AgendaStatus = 'terjadwal' | 'dibatalkan' | 'dijadwalkan_ulang';

export interface AgendaEvent {
  id: string;
  judul: string;
  kategori: AgendaKategori;
  tanggal: string; // YYYY-MM-DD
  sepanjangHari: boolean;
  jamMulai: string; // HH:mm
  jamSelesai: string; // HH:mm
  lokasi: string;
  pesertaIds: string[];
  pesertaNama: string[];
  pesertaTambahan?: string;
  catatan?: string;
  status?: AgendaStatus;
  tanggalSebelumnya?: string; // YYYY-MM-DD saat dijadwalkan ulang
  alasanStatus?: string; // Alasan pembatalan atau keterangan jadwal ulang
  statusDiubahOleh?: string;
  statusDiubahPada?: string;
  dibuatOlehId: string;
  dibuatOlehNama: string;
  createdAt: string;
  updatedAt: string;
}

export type NotifikasiJenis = 'disposisi_baru' | 'disposisi_diperbarui';

export interface NotifikasiDisposisi {
  id: string;
  suratId: string;
  recipientId: string;
  recipientNama: string;
  nomorSurat: string;
  asalSurat: string;
  perihal: string;
  sifat: SuratMasuk['sifat'];
  instruksiDisposisi: string;
  tenggatWaktu?: string;
  pengirimNama: string;
  jenis: NotifikasiJenis;
  dibaca: boolean;
  dibacaPada?: string;
  createdAt: string;
  updatedAt: string;
}

export type JenisPelaksanaan = 'Perorangan' | 'Badan Usaha';

export type StatusTahapPekerjaan = 'belum_mulai' | 'sedang_berjalan' | 'selesai';

export type StatusPencairan = 'Belum' | 'Sudah';

export type MekanismePencairan =
  | 'Langsung (LS)'
  | 'Ganti Uang Persediaan (GU)'
  | 'Tambahan Uang Persediaan (TU)';

export type SkemaKontrak =
  | 'Lump Sum'
  | 'Waktu Penugasan'
  | 'Pengadaan Langsung'
  | 'Katalog';

export type SkemaPembayaran = 'Sekaligus' | 'Termin';

export interface TerminPekerjaan {
  id: string;
  urutan: number;
  nama: string;
  persentase?: number;
  nilaiRupiah?: number;
  status: StatusPencairan;
  tanggalTarget?: string; // YYYY-MM-DD
  tanggalCair?: string; // YYYY-MM-DD
  catatan?: string;
}

export interface TahapPekerjaan {
  id: string;
  urutan: number;
  nama: string;
  status: StatusTahapPekerjaan;
  tanggalTarget?: string; // YYYY-MM-DD
  tanggalSelesai?: string; // YYYY-MM-DD
  catatan?: string;
  diperbaruiOleh?: string;
  diperbaruiPada?: string;
}

export interface RekeningAnggaran {
  id: string;
  kodeRekening: string;
  uraian: string;
  tahunAnggaran: number;
  paguAnggaran: number;
  catatan?: string;
  dibuatOlehId: string;
  dibuatOlehNama: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaketPekerjaan {
  id: string;
  rekeningId?: string;
  kodeRekening?: string;
  namaRekening?: string;
  namaKegiatan: string;
  subKegiatan: string;
  pekerjaan?: string;
  jenisPelaksanaan: JenisPelaksanaan;
  skemaKontrak?: SkemaKontrak;
  tahunAnggaran?: number; // Tahun anggaran kegiatan (mis. 2026)
  nilaiAnggaran: number; // Pagu Anggaran Rekening (Rp)
  hps?: number; // Legacy optional field for backward compatibility
  nilaiKontrak?: number; // Nilai Kontrak / Realisasi (Rp)
  tanggalMulai: string; // YYYY-MM-DD
  durasiHariKerja?: number; // Jumlah hari kalender (Senin-Minggu)
  tenggatWaktu: string; // YYYY-MM-DD (Tanggal selesai rencana otomatis)
  tanggalSelesai?: string; // YYYY-MM-DD (Tanggal tuntas aktual)
  skemaPembayaran?: SkemaPembayaran;
  terminPencairan?: TerminPekerjaan[];
  statusPencairan?: StatusPencairan;
  mekanismePencairan?: MekanismePencairan;
  kodeRup?: string;
  nomorKontrak?: string;
  penyedia?: string;
  picNama?: string;
  catatan?: string;
  tahapan: TahapPekerjaan[];
  dibuatOlehId: string;
  dibuatOlehNama: string;
  createdAt: string;
  updatedAt: string;
}
