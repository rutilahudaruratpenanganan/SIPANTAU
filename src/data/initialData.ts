import {
  Personel,
  PejabatConfig,
  SuratMasuk,
} from '../types';

export const INITIAL_PEJABAT: PejabatConfig = {
  kepalaDinas: {
    nama: 'Luthfi Firdaus, ST., M.Si.',
    nip: '19781001 200312 1 005',
    jabatan: 'Kepala Dinas',
    instansi: 'Dinas Perumahan dan Kawasan Permukiman',
  },
  kepalaBidang: {
    nama: 'Rino Novian Subhan, ST',
    nip: '19771107 200902 1 001',
    jabatan: 'Kepala Bidang Perumahan',
  },
  ketuaTim: {
    nama: 'Yuliani, ST',
    nip: '19840226 201101 2 003',
    jabatan: 'Ketua Tim Pengawasan dan Pengendalian Perumahan',
  },
};

export const INITIAL_PERSONEL: Personel[] = [
  {
    id: 'p-ketua',
    nama: 'Yuliani, ST',
    nip: '19840226 201101 2 003',
    jabatan: 'Ketua Tim Pengawasan dan Pengendalian Perumahan',
    peran: 'ketua_tim',
    isKetuaTim: true,
  },
  {
    id: 'p-chafidz',
    nama: 'Chafidz Ginanjar, ST',
    jabatan: 'Penata Kelola Perumahan Ahli Pertama',
    peran: 'staf',
  },
  {
    id: 'p-eva',
    nama: 'Eva Faoziah Alli, ST',
    jabatan: 'Penata Layanan Operasional',
    peran: 'staf',
  },
  {
    id: 'p-eryanti',
    nama: 'Eryanti Septian, S.Pd',
    jabatan: 'Penata Layanan Operasional',
    peran: 'staf',
  },
];

export const INITIAL_SURAT_MASUK: SuratMasuk[] = [];

