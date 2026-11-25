import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BriefcaseBusiness,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Layers,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wallet,
} from 'lucide-react';
import { JenisPelaksanaan, PaketPekerjaan, Personel, Role } from '../types';
import { isFullAccessRole } from '../utils/disposisiLogic';
import {
  JENIS_PELAKSANAAN_LIST,
  PaketOverallStatus,
  buildPekerjaanCsvContent,
  calculatePekerjaanStats,
  computePaketProgress,
  filterPaketPekerjaan,
  formatRupiah,
  getAvailableTahunAnggaran,
  getPaketTahunAnggaran,
  getTodayLocalIso,
} from '../utils/pekerjaanLogic';

interface PekerjaanViewProps {
  paketList: PaketPekerjaan[];
  personelList: Personel[];
  currentUser: Personel;
  currentRole: Role;
  onOpenCreate: () => void;
  onOpenEdit: (paket: PaketPekerjaan) => void;
  onOpenWorkflow: (paket: PaketPekerjaan) => void;
  onDeletePaket: (paketId: string) => Promise<void>;
  onNotify: (msg: string) => void;
}

export const PekerjaanView: React.FC<PekerjaanViewProps> = ({
  paketList,
  currentUser,
  currentRole,
  onOpenCreate,
  onOpenEdit,
  onOpenWorkflow,
  onDeletePaket,
  onNotify,
}) => {
  const todayIso = useMemo(() => getTodayLocalIso(), []);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTahun, setSelectedTahun] = useState<number | 'all'>('all');
  const [selectedJenis, setSelectedJenis] = useState<JenisPelaksanaan | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<PaketOverallStatus | 'all'>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const availableYears = useMemo(
    () => getAvailableTahunAnggaran(paketList),
    [paketList]
  );

  const stats = useMemo(
    () => calculatePekerjaanStats(paketList, todayIso),
    [paketList, todayIso]
  );

  const filteredList = useMemo(
    () =>
      filterPaketPekerjaan(
        paketList,
        {
          searchQuery,
          tahunAnggaran: selectedTahun,
          jenisPelaksanaan: selectedJenis,
          status: selectedStatus,
        },
        todayIso
      ),
    [paketList, searchQuery, selectedTahun, selectedJenis, selectedStatus, todayIso]
  );

  const canDeleteItem = (item: PaketPekerjaan) =>
    isFullAccessRole(currentRole) || item.dibuatOlehId === currentUser.id;

  const handleExportCsv = () => {
    const csv = buildPekerjaanCsvContent(filteredList, todayIso);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `Pemantauan_Kegiatan_Pekerjaan_${todayIso}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onNotify(`Rekap CSV (${filteredList.length} paket pekerjaan) berhasil diunduh.`);
  };

  const handleConfirmDelete = async (paket: PaketPekerjaan) => {
    setIsDeletingId(paket.id);
    try {
      await onDeletePaket(paket.id);
      setConfirmDeleteId(null);
    } finally {
      setIsDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-900">
            Kegiatan &amp; Pekerjaan
          </h1>
          <p className="text-xs text-slate-500">
            Pantau paket kegiatan, nilai anggaran, durasi hari kalender, dan progres alur tahapan pelaksanaan
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredList.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Ekspor CSV</span>
          </button>
          <button
            type="button"
            onClick={onOpenCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Paket Pekerjaan</span>
          </button>
        </div>
      </div>

      {/* 4 Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-medium">Nilai Anggaran</span>
            <Wallet className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono tabular-nums">
            {formatRupiah(stats.totalAnggaran)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 tabular-nums">
            {stats.totalPaket} paket terdaftar · Rata-rata progres {stats.rataRataProgres}%
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between text-blue-600 mb-1.5">
            <span className="text-xs font-medium">Sedang Berjalan</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-blue-900 font-mono tabular-nums">
            {stats.sedangBerjalan}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 tabular-nums">
            {stats.belumMulai} belum mulai · Dalam proses tahapan
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between text-amber-600 mb-1.5">
            <span className="text-xs font-medium">Perhatian Jadwal Selesai</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-900 font-mono tabular-nums">
            {stats.terlambat + stats.mendekatiTenggat}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 tabular-nums">
            {stats.terlambat} lewat jadwal · {stats.mendekatiTenggat} mendekati (≤ 7 hari)
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between text-emerald-600 mb-1.5">
            <span className="text-xs font-medium">Pekerjaan Selesai</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-900 font-mono tabular-nums">
            {stats.selesai}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono tabular-nums">
            Realisasi: {formatRupiah(stats.anggaranSelesai)}
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
          <div className="relative flex-1 min-w-0 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kegiatan, sub kegiatan, Kode RUP, penyedia, PIC..."
              aria-label="Cari paket pekerjaan"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <select
            aria-label="Filter tahun anggaran"
            value={selectedTahun === 'all' ? 'all' : String(selectedTahun)}
            onChange={(e) =>
              setSelectedTahun(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
            className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">Semua Tahun Anggaran</option>
            {availableYears.map((yr) => (
              <option key={yr} value={String(yr)}>
                TA {yr}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter jenis pelaksanaan"
            value={selectedJenis}
            onChange={(e) => setSelectedJenis(e.target.value as JenisPelaksanaan | 'all')}
            className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">Semua Jenis Pelaksanaan</option>
            {JENIS_PELAKSANAAN_LIST.map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </select>
        </div>

        {/* Status Segmented Filter */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto text-xs">
          {(
            [
              { id: 'all', label: 'Semua' },
              { id: 'belum_mulai', label: 'Belum Mulai' },
              { id: 'sedang_berjalan', label: 'Berjalan' },
              { id: 'terlambat', label: 'Terlambat' },
              { id: 'selesai', label: 'Selesai' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedStatus(tab.id)}
              className={`px-2.5 py-1.5 rounded-md font-semibold transition-colors whitespace-nowrap shrink-0 ${
                selectedStatus === tab.id
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Empty State */}
      {paketList.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
            <BriefcaseBusiness className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h2 className="text-sm font-bold text-slate-900">
              Belum Ada Paket Kegiatan &amp; Pekerjaan
            </h2>
            <p className="text-xs text-slate-500">
              Tambahkan paket pekerjaan baru (Perorangan atau Badan Usaha) untuk memuat template
              alur tahapan otomatis dan memantau progresnya.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Paket Pertama</span>
          </button>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-2">
          <p className="text-xs font-semibold text-slate-700">
            Tidak ada paket pekerjaan yang sesuai dengan filter saat ini.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedTahun('all');
              setSelectedJenis('all');
              setSelectedStatus('all');
            }}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline"
          >
            Reset Filter Pencarian
          </button>
        </div>
      ) : (
        /* Populated List: Desktop Table + Mobile Cards */
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-3 px-4">Kegiatan &amp; Sub Kegiatan</th>
                    <th className="py-3 px-3">Pelaksanaan</th>
                    <th className="py-3 px-3 text-right">Nilai Anggaran/Kontrak</th>
                    <th className="py-3 px-3">Jadwal &amp; Durasi</th>
                    <th className="py-3 px-3 w-[320px]">Progres &amp; Alur Tahapan</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredList.map((paket) => {
                    const progress = computePaketProgress(paket, todayIso);
                    const statusColor =
                      progress.overallStatus === 'selesai'
                        ? 'text-emerald-700'
                        : progress.overallStatus === 'terlambat'
                        ? 'text-rose-700'
                        : progress.overallStatus === 'sedang_berjalan'
                        ? 'text-blue-700'
                        : 'text-slate-600';

                    return (
                      <tr
                        key={paket.id}
                        data-testid={`paket-row-${paket.id}`}
                        className="hover:bg-slate-50/80 transition-colors align-top"
                      >
                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="font-bold text-slate-900 leading-snug">
                            {paket.namaKegiatan}
                          </div>
                          <div className="text-slate-600 mt-0.5 leading-snug">
                            {paket.subKegiatan}
                          </div>
                          {(paket.kodeRup || paket.nomorKontrak || paket.penyedia || paket.picNama) && (
                            <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                              {paket.kodeRup && (
                                <span className="font-mono text-slate-700 font-medium">
                                  RUP: {paket.kodeRup}
                                </span>
                              )}
                              {paket.kodeRup && (paket.nomorKontrak || paket.penyedia || paket.picNama) && (
                                <span aria-hidden="true">·</span>
                              )}
                              {paket.nomorKontrak && (
                                <span className="font-mono">No. {paket.nomorKontrak}</span>
                              )}
                              {paket.nomorKontrak && (paket.penyedia || paket.picNama) && (
                                <span aria-hidden="true">·</span>
                              )}
                              {paket.penyedia && <span>{paket.penyedia}</span>}
                              {paket.penyedia && paket.picNama && (
                                <span aria-hidden="true">·</span>
                              )}
                              {paket.picNama && <span>PIC: {paket.picNama}</span>}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <div className="font-semibold text-slate-800">
                            {paket.jenisPelaksanaan}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 tabular-nums mt-0.5">
                            TA {getPaketTahunAnggaran(paket)}
                          </div>
                          <div className={`text-[11px] font-semibold mt-0.5 ${statusColor}`}>
                            {progress.overallStatusLabel}
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                          {formatRupiah(paket.nilaiAnggaran)}
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap font-mono tabular-nums text-[11px]">
                          <div className="text-slate-700">Mulai: {paket.tanggalMulai}</div>
                          <div className="text-slate-700">
                            Durasi: {progress.durasiHariKerja} hari kalender
                          </div>
                          <div className="text-slate-900 font-semibold">
                            Selesai: {paket.tenggatWaktu}
                          </div>
                          {paket.tanggalSelesai && (
                            <div className="text-emerald-700 font-semibold">
                              Tuntas Aktual: {paket.tanggalSelesai}
                            </div>
                          )}
                          <div
                            className={`mt-0.5 font-sans font-semibold ${
                              progress.isOverdue
                                ? 'text-rose-700'
                                : progress.isNearDeadline
                                ? 'text-amber-700'
                                : progress.overallStatus === 'selesai'
                                ? 'text-emerald-700'
                                : 'text-slate-500'
                            }`}
                          >
                            {progress.deadlineLabel}
                          </div>
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="font-medium text-slate-700 truncate">
                                {progress.activeStage
                                  ? `Tahap ${progress.activeStage.urutan}: ${progress.activeStage.nama}`
                                  : '-'}
                              </span>
                              <span className="font-mono font-bold text-slate-900 tabular-nums shrink-0">
                                {progress.persentase}% ({progress.selesaiCount}/
                                {progress.totalTahapan})
                              </span>
                            </div>

                            <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                              <div
                                className={`h-full transition-all ${
                                  progress.overallStatus === 'selesai'
                                    ? 'bg-emerald-600'
                                    : progress.overallStatus === 'terlambat'
                                    ? 'bg-rose-600'
                                    : 'bg-blue-600'
                                }`}
                                style={{ width: `${progress.persentase}%` }}
                              />
                            </div>

                            {/* Compact stage trail */}
                            <div className="flex items-center gap-1 pt-0.5">
                              {paket.tahapan.map((t) => (
                                <span
                                  key={t.id}
                                  title={`${t.urutan}. ${t.nama} (${
                                    t.status === 'selesai'
                                      ? 'Selesai'
                                      : t.status === 'sedang_berjalan'
                                      ? 'Sedang Berjalan'
                                      : 'Belum Mulai'
                                  })`}
                                  className={`h-1.5 flex-1 rounded-sm ${
                                    t.status === 'selesai'
                                      ? 'bg-emerald-500'
                                      : t.status === 'sedang_berjalan'
                                      ? 'bg-blue-500'
                                      : 'bg-slate-200'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {confirmDeleteId === paket.id ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleConfirmDelete(paket)}
                                disabled={isDeletingId === paket.id}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold"
                              >
                                {isDeletingId === paket.id ? 'Menghapus...' : 'Ya, Hapus'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-[11px] font-semibold"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onOpenWorkflow(paket)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold transition-colors"
                              >
                                <Layers className="w-3.5 h-3.5" />
                                <span>Kelola Tahapan</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onOpenEdit(paket)}
                                aria-label={`Edit paket ${paket.subKegiatan}`}
                                title="Edit Paket & Template Tahapan"
                                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              {canDeleteItem(paket) && (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(paket.id)}
                                  aria-label={`Hapus paket ${paket.subKegiatan}`}
                                  title="Hapus Paket"
                                  className="p-1.5 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {filteredList.map((paket) => {
              const progress = computePaketProgress(paket, todayIso);
              return (
                <div
                  key={paket.id}
                  className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900">{paket.namaKegiatan}</div>
                      <div className="text-slate-600 mt-0.5">{paket.subKegiatan}</div>
                    </div>
                    <span
                      className={`text-[11px] font-bold shrink-0 ${
                        progress.overallStatus === 'selesai'
                          ? 'text-emerald-700'
                          : progress.overallStatus === 'terlambat'
                          ? 'text-rose-700'
                          : 'text-blue-700'
                      }`}
                    >
                      {progress.overallStatusLabel}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-600">
                    <span className="font-semibold text-slate-800">{paket.jenisPelaksanaan}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono font-semibold text-slate-700 tabular-nums">
                      TA {getPaketTahunAnggaran(paket)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      {formatRupiah(paket.nilaiAnggaran)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {progress.durasiHariKerja} hari kalender · Selesai {paket.tenggatWaktu}
                    </span>
                    {paket.kodeRup && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-slate-700">RUP: {paket.kodeRup}</span>
                      </>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-700 truncate">
                        {progress.activeStage
                          ? `Tahap ${progress.activeStage.urutan}: ${progress.activeStage.nama}`
                          : '-'}
                      </span>
                      <span className="font-mono font-bold text-slate-900 tabular-nums shrink-0">
                        {progress.persentase}% ({progress.selesaiCount}/{progress.totalTahapan})
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className={`h-full ${
                          progress.overallStatus === 'selesai'
                            ? 'bg-emerald-600'
                            : progress.overallStatus === 'terlambat'
                            ? 'bg-rose-600'
                            : 'bg-blue-600'
                        }`}
                        style={{ width: `${progress.persentase}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2">
                    {confirmDeleteId === paket.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleConfirmDelete(paket)}
                          disabled={isDeletingId === paket.id}
                          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                        >
                          {isDeletingId === paket.id ? 'Menghapus...' : 'Ya, Hapus'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold"
                        >
                          Batal
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onOpenWorkflow(paket)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 text-white font-semibold"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>Kelola Tahapan</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenEdit(paket)}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold"
                        >
                          Edit
                        </button>
                        {canDeleteItem(paket) && (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(paket.id)}
                            aria-label={`Hapus paket ${paket.subKegiatan}`}
                            className="px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 font-semibold"
                          >
                            Hapus
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
