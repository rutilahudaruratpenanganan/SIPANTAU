import React, { useEffect } from 'react';
import { 
  Search, 
  Filter, 
  FileText, 
  FileCheck, 
  Trash2, 
  Printer, 
  UserPlus, 
  CheckCircle2, 
  Clock, 
  Download, 
  Upload,
  AlertCircle,
  FileEdit,
  ArrowRight,
  Calendar,
  Pencil
} from 'lucide-react';
import { SuratMasuk, Role, Personel, TahapTindakLanjutId } from '../types';
import {
  TAHAP_TINDAK_LANJUT,
  canCreateDisposisi,
  canDeleteSurat,
} from '../utils/disposisiLogic';

interface SuratTableProps {
  suratList: SuratMasuk[];
  personelList: Personel[];
  currentRole: Role;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedTahap: TahapTindakLanjutId | 'selesai' | 'perlu_disposisi' | 'aktif' | 'all';
  onTahapChange: (t: TahapTindakLanjutId | 'selesai' | 'perlu_disposisi' | 'aktif' | 'all') => void;
  selectedPersonel: string | 'all';
  onPersonelChange: (p: string | 'all') => void;
  selectedStatus: 'all' | 'aktif' | 'selesai';
  onStatusChange: (s: 'all' | 'aktif' | 'selesai') => void;
  onOpenDetail: (surat: SuratMasuk) => void;
  onOpenEditSurat: (surat: SuratMasuk) => void;
  onOpenDisposisi: (surat: SuratMasuk) => void;
  onOpenUploadSuratKeluar: (surat: SuratMasuk) => void;
  onOpenPdfViewer: (file: { nama: string; ukuran: string; tipe: string; tanggalUnggah: string; pengunggah: string; dataUrl?: string }) => void;
  onOpenLembarDisposisi: (surat: SuratMasuk) => void;
  onDeleteSurat: (surat: SuratMasuk) => void;
  onExportCsv: () => void;
  highlightedSuratId?: string | null;
}

export const SuratTable: React.FC<SuratTableProps> = ({
  suratList,
  personelList,
  currentRole,
  searchQuery,
  onSearchChange,
  selectedTahap,
  onTahapChange,
  selectedPersonel,
  onPersonelChange,
  selectedStatus,
  onStatusChange,
  onOpenDetail,
  onOpenEditSurat,
  onOpenDisposisi,
  onOpenUploadSuratKeluar,
  onOpenPdfViewer,
  onOpenLembarDisposisi,
  onDeleteSurat,
  onExportCsv,
  highlightedSuratId,
}) => {
  useEffect(() => {
    if (!highlightedSuratId) return;
    const row = document.querySelector<HTMLElement>(
      `tr[data-surat-id="${CSS.escape(highlightedSuratId)}"]`
    );
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedSuratId]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      
      {/* Filtering Toolbar */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/50 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md xl:max-w-xl">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Cari nomor surat, asal surat, perihal, atau personel..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>

          {/* Filters & Export */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Filter Status & Disposisi */}
            <select
              value={selectedTahap}
              onChange={(e) => onTahapChange(e.target.value as any)}
              className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
            >
              <option value="all">Semua Status Persuratan</option>
              <option value="perlu_disposisi">Perlu Disposisi Ketua Tim</option>
              <option value="aktif">Sedang Diproses / Berjalan</option>
              <option value="selesai">Selesai Tindak Lanjut</option>
            </select>

            {/* Filter Personel Disposisi */}
            <select
              value={selectedPersonel}
              onChange={(e) => onPersonelChange(e.target.value)}
              className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="all">Semua Personel Penerima</option>
              {personelList.map((p) => (
                <option key={p.id} value={p.nama}>
                  {p.nama}
                </option>
              ))}
            </select>

            {/* Export CSV */}
            <button
              onClick={onExportCsv}
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5"
              title="Unduh rekapitulasi data persuratan ke CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor Data</span>
            </button>

          </div>

        </div>

        {/* Filter Summary Tags if active */}
        {(selectedTahap !== 'all' || selectedPersonel !== 'all' || selectedStatus !== 'all' || searchQuery !== '') && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 pt-1">
            <span className="font-medium text-slate-500">Filter Aktif:</span>
            {selectedTahap !== 'all' && (
              <span className={`px-2 py-0.5 rounded font-medium ${
                selectedTahap === 'selesai' 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : selectedTahap === 'perlu_disposisi'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {selectedTahap === 'selesai' 
                  ? 'Status: Selesai Tindak Lanjut' 
                  : selectedTahap === 'perlu_disposisi'
                  ? 'Status: Perlu Disposisi'
                  : selectedTahap === 'aktif'
                  ? 'Status: Sedang Diproses'
                  : `Tahap ${selectedTahap}`}
              </span>
            )}
            {selectedPersonel !== 'all' && (
              <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded font-medium">
                Personel: {selectedPersonel}
              </span>
            )}
            {selectedStatus !== 'all' && (
              <span className={`px-2 py-0.5 rounded font-medium capitalize ${selectedStatus === 'selesai' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-800'}`}>
                Status: {selectedStatus === 'selesai' ? 'Selesai Tindak Lanjut' : 'Sedang Berjalan'}
              </span>
            )}
            {searchQuery !== '' && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-medium">
                Pencarian: "{searchQuery}"
              </span>
            )}
            <button
              onClick={() => {
                onSearchChange('');
                onTahapChange('all');
                onPersonelChange('all');
                onStatusChange('all');
              }}
              className="text-blue-600 hover:underline text-xs ml-2 font-medium"
            >
              Reset Semua Filter
            </button>
          </div>
        )}
      </div>

      {/* Table Data */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100/75 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              <th className="py-3 px-2.5 w-10 text-center">No.</th>
              <th className="py-3 px-3 w-28 xl:w-32">Tanggal Surat</th>
              <th className="py-3 px-3 w-44 xl:w-56 2xl:w-64">Asal Surat</th>
              <th className="py-3 px-3 min-w-[220px]">Perihal & Arahan</th>
              <th className="py-3 px-3 w-40 xl:w-52 2xl:w-60">Disposisi Personel</th>
              <th className="py-3 px-3 w-40 xl:w-52 2xl:w-60">Status Tindak Lanjut</th>
              <th className="py-3 px-2.5 w-28 xl:w-36 text-center">Berkas PDF</th>
              <th className="py-3 px-3 text-right whitespace-nowrap">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs">
            {suratList.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-500">
                  <div className="max-w-sm mx-auto space-y-2">
                    <FileText className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="font-medium text-slate-700">Tidak ada surat yang sesuai kriteria pencarian.</p>
                    <p className="text-xs text-slate-500">
                      Silakan sesuaikan kata kunci pencarian atau reset filter yang sedang aktif.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              suratList.map((item, index) => {
                const hasDisposisi = item.penerimaDisposisiNama && item.penerimaDisposisiNama.length > 0;

                const isHighlighted = highlightedSuratId === item.id;

                return (
                  <tr 
                    key={item.id}
                    data-surat-id={item.id}
                    className={`transition-colors group ${
                      isHighlighted
                        ? 'bg-blue-50/90 ring-2 ring-inset ring-blue-500'
                        : 'hover:bg-blue-50/40'
                    }`}
                  >
                    
                    {/* Index */}
                    <td className="py-3.5 px-2.5 text-center font-mono font-medium text-slate-600">
                      {index + 1}
                    </td>

                    {/* Tanggal Surat */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-900 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>{item.tanggalSurat}</span>
                      </div>
                    </td>

                    {/* Asal Surat */}
                    <td className="py-3.5 px-3">
                      <div className="font-semibold text-slate-900 line-clamp-2">
                        {item.asalSurat}
                      </div>
                      {item.nomorSurat && (
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5 truncate max-w-[165px] xl:max-w-[220px] 2xl:max-w-[260px]" title={item.nomorSurat}>
                          {item.nomorSurat}
                        </div>
                      )}
                    </td>

                    {/* Perihal & Instruksi Disposisi */}
                    <td className="py-3.5 px-3">
                      <div className="text-slate-900 font-medium leading-relaxed">
                        {item.perihal}
                      </div>
                      {item.instruksiDisposisi && (
                        <div className="mt-1.5 p-2 rounded-lg bg-purple-50/90 border border-purple-200 text-[11px] text-purple-950 flex items-start justify-between gap-2">
                          <div className="leading-snug">
                            <span className="font-bold text-purple-900">Instruksi Disposisi:</span> {item.instruksiDisposisi}
                          </div>
                          {!item.statusSelesai && canCreateDisposisi(currentRole) && (
                            <button
                              type="button"
                              onClick={() => onOpenDisposisi(item)}
                              className="shrink-0 text-purple-700 hover:text-purple-950 font-bold underline text-[10px] flex items-center gap-0.5 bg-white px-1.5 py-0.5 rounded border border-purple-200"
                              title="Edit Instruksi Disposisi"
                            >
                              <FileEdit className="w-2.5 h-2.5" />
                              <span>Edit</span>
                            </button>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Disposisi (NEVER using 'dispo') */}
                    <td className="py-3.5 px-3">
                      {hasDisposisi ? (
                        <div className="space-y-1">
                          <div className="flex flex-wrap gap-1">
                            {item.penerimaDisposisiNama.map((nama) => (
                              <span
                                key={nama}
                                className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded font-medium text-[11px]"
                              >
                                {nama}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-start justify-between gap-2 text-[10px] text-slate-500 font-mono pt-0.5">
                            <div className="space-y-0.5 min-w-0">
                              <div className="whitespace-nowrap">Disposisi: {item.tanggalDisposisi || '-'}</div>
                              {item.tenggatWaktu && (
                                <div className="text-amber-700 font-semibold flex items-center gap-1 whitespace-nowrap">
                                  <Clock className="w-2.5 h-2.5 shrink-0" />
                                  <span>Tenggat: {item.tenggatWaktu}</span>
                                </div>
                              )}
                            </div>
                            {!item.statusSelesai && canCreateDisposisi(currentRole) && (
                              <button
                                type="button"
                                onClick={() => onOpenDisposisi(item)}
                                className="text-purple-700 hover:text-purple-900 font-bold hover:underline inline-flex items-center gap-0.5 shrink-0"
                                title="Edit Disposisi & Instruksi"
                              >
                                <FileEdit className="w-2.5 h-2.5" />
                                <span>Edit</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="text-amber-600 font-medium text-[11px] flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            <span>Perlu Disposisi</span>
                          </div>
                          {canCreateDisposisi(currentRole) ? (
                            <button
                              type="button"
                              onClick={() => onOpenDisposisi(item)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 hover:text-purple-900 hover:underline"
                            >
                              <UserPlus className="w-3 h-3" />
                              <span>+ Disposisi Surat</span>
                            </button>
                          ) : (
                            <div className="text-[10px] text-slate-400 italic">
                              Menunggu Disposisi Ketua Tim
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Tindak Lanjut - Clean without stage clutters */}
                    <td className="py-3.5 px-3">
                      {item.statusSelesai ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300 shadow-2xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Selesai Tindak Lanjut
                          </span>
                          {item.tanggalSelesai && (
                            <div className="text-[10px] text-slate-500 font-mono">
                              Tuntas: {item.tanggalSelesai}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-800 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                            Sedang Diproses
                          </span>
                          <div className="text-[11px] text-slate-500 line-clamp-2">
                            {item.riwayatTindakLanjut && item.riwayatTindakLanjut.length > 0
                              ? item.riwayatTindakLanjut[item.riwayatTindakLanjut.length - 1].catatan
                              : 'Dalam proses koordinasi dan tindak lanjut'}
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Berkas PDF (Surat Masuk & Surat Keluar) */}
                    <td className="py-3.5 px-2.5 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        
                        {/* PDF Surat Masuk */}
                        {item.fileSuratMasuk ? (
                          <button
                            onClick={() => onOpenPdfViewer(item.fileSuratMasuk!)}
                            className="w-full flex items-center justify-center gap-1 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium border border-slate-200 transition-colors"
                            title="Buka / Preview PDF Surat Masuk"
                          >
                            <FileText className="w-3.5 h-3.5 text-blue-600" />
                            <span>Surat Masuk</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400">PDF Masuk: -</span>
                        )}

                        {/* PDF Surat Keluar */}
                        {item.fileSuratKeluar ? (
                          <button
                            onClick={() => onOpenPdfViewer(item.fileSuratKeluar!)}
                            className="w-full flex items-center justify-center gap-1 px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-medium border border-emerald-200 transition-colors"
                            title="Buka / Preview PDF Surat Keluar"
                          >
                            <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Surat Keluar</span>
                          </button>
                        ) : !item.statusSelesai ? (
                          <button
                            onClick={() => onOpenUploadSuratKeluar(item)}
                            className="w-full flex items-center justify-center gap-1 px-2 py-1 rounded bg-slate-50 hover:bg-slate-100 text-slate-500 text-[10px] border border-dashed border-slate-300 hover:border-blue-400 hover:text-blue-600 transition-colors"
                            title="Unggah berkas PDF Surat Keluar"
                          >
                            <Upload className="w-3 h-3" />
                            <span>+ Surat Keluar</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400">PDF Keluar: -</span>
                        )}

                      </div>
                    </td>

                    {/* Aksi */}
                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1">
                        
                        {/* Detail & Tindak Lanjut */}
                        <button
                          onClick={() => onOpenDetail(item)}
                          className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md font-medium text-xs transition-colors inline-flex items-center gap-1 whitespace-nowrap"
                          title="Lihat alur tindak lanjut dan perbarui status"
                        >
                          <span>Tindak Lanjut</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>

                        {/* Edit Registrasi Surat Masuk */}
                        {!item.statusSelesai && (
                          <button
                            type="button"
                            onClick={() => onOpenEditSurat(item)}
                            className="p-1.5 text-amber-700 hover:bg-amber-50 rounded-md transition-colors"
                            title="Edit Registrasi Surat Masuk"
                            aria-label="Edit Registrasi Surat Masuk"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}

                        {/* Disposisi button (Edit / Atur - Ketua Tim only) */}
                        {!item.statusSelesai && canCreateDisposisi(currentRole) && (
                          <button
                            onClick={() => onOpenDisposisi(item)}
                            className="p-1.5 text-purple-700 hover:bg-purple-50 rounded-md transition-colors"
                            title={hasDisposisi ? "Edit Disposisi & Instruksi" : "Berikan Disposisi & Instruksi"}
                          >
                            {hasDisposisi ? (
                              <FileEdit className="w-4 h-4 text-purple-700" />
                            ) : (
                              <UserPlus className="w-4 h-4 text-purple-700" />
                            )}
                          </button>
                        )}

                        {/* Cetak Lembar Disposisi */}
                        <button
                          onClick={() => onOpenLembarDisposisi(item)}
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                          title="Cetak Lembar Disposisi Resmi"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        {/* Delete Surat (Active for Ketua Tim only) */}
                        {canDeleteSurat(currentRole) && (
                          <button
                            onClick={() => onDeleteSurat(item)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                            title="Hapus surat ini"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}

                      </div>
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer info */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
        <div>
          Menampilkan <span className="font-semibold text-slate-700">{suratList.length}</span> surat terdata
        </div>
        <div className="text-[11px] text-slate-400">
          SIPANTAU-WASDAL · Format Disposisi & Pemantauan Tindak Lanjut
        </div>
      </div>

    </div>
  );
};
