import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileCheck,
  FileText,
  FolderArchive,
  HardDriveDownload,
  History,
  Lock,
  Search,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { DokumenFile, PejabatConfig, Personel, Role, SuratMasuk } from '../types';
import { canAccessBackup } from '../utils/disposisiLogic';
import {
  BackupProgress,
  createBackupZipBlob,
  getSuratSelesaiForBackup,
} from '../utils/backupArchive';

interface BackupViewProps {
  suratList: SuratMasuk[];
  pejabatConfig: PejabatConfig;
  currentRole: Role;
  currentUser: Personel;
  resolvePdfDataUrl: (
    file: DokumenFile | undefined,
    suratId: string,
    kind: 'masuk' | 'keluar'
  ) => Promise<string | undefined>;
  onOpenDetail: (surat: SuratMasuk) => void;
  onNotify: (message: string) => void;
}

export const BackupView: React.FC<BackupViewProps> = ({
  suratList,
  pejabatConfig,
  currentRole,
  currentUser,
  resolvePdfDataUrl,
  onOpenDetail,
  onNotify,
}) => {
  const isAuthorized = canAccessBackup(currentRole);

  const suratSelesaiList = useMemo(() => getSuratSelesaiForBackup(suratList), [suratList]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(suratSelesaiList.map((s) => s.id)));
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const [lastResultMsg, setLastResultMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Keep selectedIds synchronized when finished list updates
  useEffect(() => {
    setSelectedIds((prev) => {
      const validIds = new Set(suratSelesaiList.map((s) => s.id));
      const kept = new Set(Array.from(prev).filter((id) => validIds.has(id)));
      if (kept.size === 0 && suratSelesaiList.length > 0 && prev.size === 0) {
        return validIds;
      }
      // Include newly finished records automatically if all previous were selected
      if (prev.size > 0 && kept.size === prev.size) {
        suratSelesaiList.forEach((s) => kept.add(s.id));
      }
      return kept;
    });
  }, [suratSelesaiList]);

  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return suratSelesaiList;
    return suratSelesaiList.filter((s) => {
      return (
        (s.nomorSurat || '').toLowerCase().includes(q) ||
        (s.asalSurat || '').toLowerCase().includes(q) ||
        (s.perihal || '').toLowerCase().includes(q) ||
        (s.nomorSuratKeluar || '').toLowerCase().includes(q) ||
        (s.penerimaDisposisiNama || []).some((n) => n.toLowerCase().includes(q))
      );
    });
  }, [suratSelesaiList, searchQuery]);

  const stats = useMemo(() => {
    const withMasukPdf = suratSelesaiList.filter((s) => Boolean(s.fileSuratMasuk)).length;
    const withKeluar = suratSelesaiList.filter((s) => Boolean(s.fileSuratKeluar || s.nomorSuratKeluar)).length;
    const totalLogProses = suratSelesaiList.reduce(
      (sum, s) => sum + (s.riwayatTindakLanjut?.length || 0),
      0
    );
    return {
      totalSelesai: suratSelesaiList.length,
      withMasukPdf,
      withKeluar,
      totalLogProses,
    };
  }, [suratSelesaiList]);

  if (!isAuthorized) {
    return (
      <div className="bg-white rounded-2xl border border-amber-200 p-8 text-center space-y-3 shadow-xs">
        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900">
          Menu Backup Khusus Akun Pendisposisi
        </h2>
        <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
          Fitur unduh cadangan (backup) seluruh surat berstatus selesai hanya tersedia pada akun Pendisposisi (Ketua Tim). Silakan alihkan profil pengguna aktif melalui menu di kanan atas.
        </p>
      </div>
    );
  }

  const allFilteredSelected =
    filteredList.length > 0 && filteredList.every((s) => selectedIds.has(s.id));

  const toggleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredList.forEach((s) => next.delete(s.id));
      } else {
        filteredList.forEach((s) => next.add(s.id));
      }
      return next;
    });
  };

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const triggerDownloadZip = async (targetIds?: Set<string>) => {
    setIsDownloading(true);
    setErrorMsg(null);
    setLastResultMsg(null);
    setProgress({
      processed: 0,
      total: targetIds ? targetIds.size : selectedIds.size || suratSelesaiList.length,
      currentLabel: 'Menyiapkan berkas & riwayat dari Cloud Firestore...',
    });

    try {
      const result = await createBackupZipBlob({
        suratList: suratSelesaiList,
        pejabatConfig,
        exportedBy: `${currentUser.nama} (${pejabatConfig.ketuaTim.jabatan})`,
        selectedIds: targetIds || selectedIds,
        resolvePdfDataUrl,
        onProgress: (p) => setProgress(p),
      });

      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 3000);

      const summary = `Backup "${result.filename}" berhasil diunduh (${result.stats.totalSurat} surat selesai, ${result.stats.pdfMasukCount} PDF Surat Masuk, ${result.stats.pdfKeluarCount} PDF Surat Keluar, lengkap dengan history disposisi & history proses).`;
      setLastResultMsg(summary);
      onNotify(`File backup ${result.filename} berhasil diunduh ke laptop.`);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal menyusun paket backup. Silakan coba kembali.'
      );
    } finally {
      setIsDownloading(false);
      setProgress(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 rounded-2xl p-6 text-white border border-slate-800 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
              <ShieldCheck className="w-4 h-4" />
              <span>Akun Pendisposisi · Pusat Cadangan Arsip Surat Selesai</span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
              Backup Data & Dokumen Surat Masuk Berstatus Selesai
            </h1>
            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Unduh paket arsip terstruktur (<span className="font-mono text-emerald-300">.zip</span>) ke laptop yang mencakup berkas PDF Surat Masuk, History Disposisi Pendisposisi, History Proses lengkap per tahap, serta Surat Keluar (jika ada).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isDownloading || selectedIds.size === 0}
              onClick={() => triggerDownloadZip(selectedIds)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-400 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              <HardDriveDownload className="w-4 h-4" />
              <span>
                {isDownloading
                  ? 'Menyusun Backup...'
                  : `Unduh Backup ke Laptop (${selectedIds.size} Surat)`}
              </span>
            </button>
          </div>
        </div>

        {/* Live Progress Indicator */}
        {isDownloading && progress && (
          <div className="mt-4 p-3.5 rounded-xl bg-slate-950/60 border border-emerald-500/30 space-y-2 text-xs">
            <div className="flex items-center justify-between text-emerald-200 font-medium">
              <span className="truncate pr-3">{progress.currentLabel}</span>
              <span className="font-mono shrink-0">
                {progress.processed}/{progress.total}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{
                  width: `${progress.total > 0 ? Math.min(100, Math.round((progress.processed / progress.total) * 100)) : 20}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Feedback Messages */}
      {lastResultMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-start gap-2.5 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="font-medium leading-relaxed">{lastResultMsg}</div>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-medium">
          {errorMsg}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-700 text-xs font-semibold mb-1.5">
            <span>Surat Status Selesai</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">{stats.totalSelesai}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Siap dicadangkan ke laptop</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-blue-700 text-xs font-semibold mb-1.5">
            <span>File PDF Surat Masuk</span>
            <FileText className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">{stats.withMasukPdf}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Lampiran naskah masuk</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-purple-700 text-xs font-semibold mb-1.5">
            <span>Catatan History Proses</span>
            <History className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">{stats.totalLogProses}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Total log tahapan & disposisi</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-teal-700 text-xs font-semibold mb-1.5">
            <span>Dokumen Surat Keluar</span>
            <FileCheck className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">{stats.withKeluar}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Surat jawaban / balasan terbit</div>
        </div>
      </div>

      {/* Finished Letters Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari surat selesai (nomor, asal, perihal, penerima disposisi)..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={toggleSelectAllFiltered}
              disabled={filteredList.length === 0}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg font-medium text-slate-700 transition-colors disabled:opacity-50"
            >
              {allFilteredSelected ? 'Batalkan Pilih Semua' : 'Pilih Semua Surat Selesai'}
            </button>
            <button
              type="button"
              disabled={isDownloading || suratSelesaiList.length === 0}
              onClick={() => {
                const allSet = new Set(suratSelesaiList.map((s) => s.id));
                setSelectedIds(allSet);
                triggerDownloadZip(allSet);
              }}
              className="px-3.5 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <FolderArchive className="w-3.5 h-3.5 text-emerald-600" />
              <span>Backup Semua Selesai ({suratSelesaiList.length})</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/80 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    aria-label="Pilih semua surat selesai"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAllFiltered}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                </th>
                <th className="py-3 px-3 w-36">Surat & Tgl Selesai</th>
                <th className="py-3 px-3 min-w-[200px]">Asal & Perihal Surat</th>
                <th className="py-3 px-3 w-52">History Disposisi</th>
                <th className="py-3 px-3 w-48">History Proses</th>
                <th className="py-3 px-3 w-44">Lampiran Berkas</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <FolderArchive className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="font-medium text-slate-700">
                      {suratSelesaiList.length === 0
                        ? 'Belum ada surat masuk yang berstatus Selesai Tindak Lanjut.'
                        : 'Tidak ada surat selesai yang cocok dengan pencarian.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredList.map((item) => {
                  const isChecked = selectedIds.has(item.id);
                  const riwayatCount = item.riwayatTindakLanjut?.length || 0;
                  const lastLog = riwayatCount > 0 ? item.riwayatTindakLanjut[riwayatCount - 1] : null;

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        isChecked ? 'bg-emerald-50/30 hover:bg-emerald-50/60' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3.5 px-3 text-center align-top">
                        <input
                          type="checkbox"
                          aria-label={`Pilih ${item.nomorSurat || item.id}`}
                          checked={isChecked}
                          onChange={() => toggleRow(item.id)}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 mt-0.5"
                        />
                      </td>

                      <td className="py-3.5 px-3 align-top">
                        <div className="font-mono font-bold text-slate-900">
                          {item.nomorSurat || '-'}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Surat: {item.tanggalSurat}
                        </div>
                        <div className="text-[11px] font-semibold text-emerald-700 mt-0.5">
                          Selesai: {item.tanggalSelesai || '-'}
                        </div>
                      </td>

                      <td className="py-3.5 px-3 align-top">
                        <div className="font-semibold text-slate-900">{item.asalSurat}</div>
                        <div className="text-slate-600 leading-snug mt-0.5 line-clamp-2">
                          {item.perihal}
                        </div>
                      </td>

                      <td className="py-3.5 px-3 align-top">
                        {item.penerimaDisposisiNama && item.penerimaDisposisiNama.length > 0 ? (
                          <div className="space-y-1">
                            <div className="flex flex-wrap gap-1">
                              {item.penerimaDisposisiNama.map((nama) => (
                                <span
                                  key={nama}
                                  className="px-1.5 py-0.5 bg-purple-50 text-purple-800 border border-purple-200 rounded text-[10px] font-semibold"
                                >
                                  {nama}
                                </span>
                              ))}
                            </div>
                            {item.instruksiDisposisi && (
                              <div className="text-[11px] text-slate-600 line-clamp-2">
                                {item.instruksiDisposisi}
                              </div>
                            )}
                            {item.tanggalDisposisi && (
                              <div className="text-[10px] font-mono text-slate-400">
                                Disposisi: {item.tanggalDisposisi}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Tanpa catatan disposisi</span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 align-top">
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                          <History className="w-3 h-3 text-blue-600" />
                          <span>{riwayatCount} catatan proses</span>
                        </div>
                        {lastLog && (
                          <div className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                            {lastLog.catatan}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-3 align-top">
                        <div className="space-y-1 text-[11px]">
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span className="truncate max-w-[140px]" title={item.fileSuratMasuk?.nama}>
                              {item.fileSuratMasuk ? item.fileSuratMasuk.nama : 'PDF Masuk: -'}
                            </span>
                          </div>
                          {item.fileSuratKeluar || item.nomorSuratKeluar ? (
                            <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                              <FileCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="truncate max-w-[140px]" title={item.fileSuratKeluar?.nama || item.nomorSuratKeluar}>
                                {item.fileSuratKeluar?.nama || item.nomorSuratKeluar}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-slate-400">
                              <Send className="w-3 h-3 shrink-0" />
                              <span>Tanpa Surat Keluar</span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-right align-top whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenDetail(item)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium text-xs transition-colors"
                          >
                            Lihat Detail
                          </button>
                          <button
                            type="button"
                            disabled={isDownloading}
                            onClick={() => triggerDownloadZip(new Set([item.id]))}
                            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md font-semibold text-xs transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                            title={`Unduh paket backup surat ${item.nomorSurat || item.id}`}
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Unduh (.zip)</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
