import React, { useMemo, useState } from 'react';
import {
  Printer,
  Download,
  FileSpreadsheet,
  Filter,
  RotateCcw,
  Calendar,
  History,
  FileText,
  FileCheck,
  AlertCircle,
} from 'lucide-react';
import { DokumenFile, PejabatConfig, SuratMasuk } from '../types';
import { TAHAP_TINDAK_LANJUT, normalizeRiwayatCatatan } from '../utils/disposisiLogic';
import {
  RekapDateBasis,
  RekapStatusFilter,
  filterRekapSurat,
  formatRekapPeriodeLabel,
  getRekapDateBasisLabel,
  getRekapStatusLabel,
} from '../utils/rekapLogic';

interface RekapViewProps {
  suratList: SuratMasuk[];
  pejabatConfig: PejabatConfig;
  onExportCsv: (filteredList?: SuratMasuk[], options?: { includeHistory?: boolean }) => void;
  onOpenPdfViewer: (file: DokumenFile) => void;
}

export const RekapView: React.FC<RekapViewProps> = ({
  suratList,
  pejabatConfig,
  onExportCsv,
  onOpenPdfViewer,
}) => {
  const [statusFilter, setStatusFilter] = useState<RekapStatusFilter>('all');
  const [dateBasis, setDateBasis] = useState<RekapDateBasis>('tanggalSurat');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [includeHistory, setIncludeHistory] = useState<boolean>(true);

  const hasDateRangeError = Boolean(dateFrom && dateTo && dateFrom > dateTo);
  const hasActiveFilter = statusFilter !== 'all' || Boolean(dateFrom) || Boolean(dateTo);

  const filteredList = useMemo(() => {
    if (hasDateRangeError) return [];
    return filterRekapSurat(suratList, {
      status: statusFilter,
      dateFrom,
      dateTo,
      dateBasis,
    });
  }, [suratList, statusFilter, dateFrom, dateTo, dateBasis, hasDateRangeError]);

  const totalAll = suratList.length;
  const totalSelesaiAll = suratList.filter((s) => s.statusSelesai).length;
  const totalAktifAll = suratList.filter((s) => !s.statusSelesai).length;

  const filteredAktifCount = filteredList.filter((s) => !s.statusSelesai).length;
  const filteredSelesaiCount = filteredList.filter((s) => s.statusSelesai).length;

  const handleResetFilters = () => {
    setStatusFilter('all');
    setDateBasis('tanggalSurat');
    setDateFrom('');
    setDateTo('');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-5">
      {/* Top Banner & Filter Controls (Hidden on print) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-purple-600" />
              Rekapitulasi Persuratan &amp; Disposisi Tim Wasdal
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pilih filter status dan rentang tanggal untuk mencetak laporan lengkap beserta riwayat proses tiap surat
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onExportCsv(filteredList, { includeHistory })}
              disabled={filteredList.length === 0}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors border border-slate-300 whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>Ekspor CSV ({filteredList.length})</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={filteredList.length === 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-sm whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Rekapitulasi ({filteredList.length})</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="pt-4 border-t border-slate-200 grid grid-cols-1 xl:grid-cols-12 gap-4 items-end text-xs">
          {/* Filter Status */}
          <div className="xl:col-span-5 space-y-1.5">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              Filter Status Tindak Lanjut
            </span>
            <div
              role="group"
              aria-label="Filter status cetak rekap"
              className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg"
            >
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-colors whitespace-nowrap ${
                  statusFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua ({totalAll})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('selesai')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-colors whitespace-nowrap ${
                  statusFilter === 'selesai'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Selesai Tindak Lanjut ({totalSelesaiAll})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('aktif')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-colors whitespace-nowrap ${
                  statusFilter === 'aktif'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Dalam Proses ({totalAktifAll})
              </button>
            </div>
          </div>

          {/* Filter Range Tanggal */}
          <div className="xl:col-span-5 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="space-y-1">
              <label htmlFor="rekap-date-basis" className="block font-semibold text-slate-700">
                Acuan Tanggal
              </label>
              <select
                id="rekap-date-basis"
                value={dateBasis}
                onChange={(e) => setDateBasis(e.target.value as RekapDateBasis)}
                className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="tanggalSurat">Tanggal Surat</option>
                <option value="tanggalDiterima">Tanggal Diterima</option>
                <option value="tanggalDisposisi">Tanggal Disposisi</option>
              </select>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="rekap-date-from"
                className="font-semibold text-slate-700 flex items-center gap-1"
              >
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Dari Tanggal</span>
              </label>
              <input
                id="rekap-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="rekap-date-to"
                className="font-semibold text-slate-700 flex items-center gap-1"
              >
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Sampai Tanggal</span>
              </label>
              <input
                id="rekap-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          {/* Toggle History & Reset */}
          <div className="xl:col-span-2 flex flex-wrap xl:flex-col xl:items-end justify-between gap-2">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none font-medium text-slate-700 py-1">
              <input
                id="rekap-include-history"
                type="checkbox"
                checked={includeHistory}
                onChange={(e) => setIncludeHistory(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
              <History className="w-3.5 h-3.5 text-blue-600" />
              <span>Cetak History Lengkap</span>
            </label>

            {hasActiveFilter && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold inline-flex items-center gap-1.5 border border-slate-300 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filter</span>
              </button>
            )}
          </div>
        </div>

        {hasDateRangeError && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 font-medium"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              Rentang tanggal tidak valid: &ldquo;Dari Tanggal&rdquo; tidak boleh lebih akhir daripada &ldquo;Sampai Tanggal&rdquo;.
            </span>
          </div>
        )}
      </div>

      {/* Printable Sheet View */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-8 shadow-xs print:border-none print:shadow-none print:p-0">
        {/* Kop Resmi Surat Laporan */}
        <div className="text-center border-b-2 border-slate-900 pb-4 mb-6">
          <h3 className="text-xs uppercase font-bold tracking-widest text-slate-600 font-sans">
            Pemerintah Kota Bandung
          </h3>
          <h1 className="text-base font-extrabold uppercase tracking-wide text-slate-900 mt-0.5">
            {pejabatConfig.kepalaDinas.instansi}
          </h1>
          <h2 className="text-xs font-bold uppercase text-slate-800">
            Bidang Perumahan · Tim Pengawasan dan Pengendalian Perumahan
          </h2>
          <div className="text-xs font-bold underline uppercase tracking-wide mt-3">
            DAFTAR SURAT MASUK, DISPOSISI, DAN PEMANTAUAN TINDAK LANJUT
          </div>
          <div className="text-[11px] text-slate-700 mt-1.5 space-y-0.5">
            <div>
              Status: <span className="font-semibold">{getRekapStatusLabel(statusFilter)}</span>
              <span aria-hidden="true"> · </span>
              Periode ({getRekapDateBasisLabel(dateBasis)}):{' '}
              <span className="font-semibold">{formatRekapPeriodeLabel(dateFrom, dateTo)}</span>
            </div>
            <div className="text-slate-600 tabular-nums">
              Dicetak Per:{' '}
              {new Date().toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}{' '}
              · Menampilkan: <span className="font-bold text-slate-900">{filteredList.length} Surat</span> ({filteredAktifCount} Dalam Proses, {filteredSelesaiCount} Selesai Tindak Lanjut)
            </div>
          </div>
        </div>

        {/* High-Density Report Table or Empty Filter State */}
        {filteredList.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-slate-300 rounded-xl bg-slate-50 space-y-2">
            <p className="text-xs font-semibold text-slate-700">
              Tidak ada data surat yang sesuai dengan filter status atau rentang tanggal yang dipilih.
            </p>
            <p className="text-[11px] text-slate-500">
              Ubah pilihan status atau kosongkan filter tanggal untuk menampilkan seluruh arsip persuratan.
            </p>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-2 px-3.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5 print:hidden"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Tampilkan Semua Surat</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse border border-slate-800 text-[11px]">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-800 font-bold text-slate-900 uppercase">
                  <th className="border border-slate-800 p-2 text-center w-9">No.</th>
                  <th className="border border-slate-800 p-2 w-24">Tanggal</th>
                  <th className="border border-slate-800 p-2 w-40">Asal &amp; Nomor Surat</th>
                  <th className="border border-slate-800 p-2 w-48">Perihal</th>
                  <th className="border border-slate-800 p-2 w-36">Disposisi</th>
                  <th className="border border-slate-800 p-2 min-w-[260px]">
                    {includeHistory
                      ? 'Status & Riwayat Tindak Lanjut Lengkap'
                      : 'Status Tindak Lanjut'}
                  </th>
                  <th className="border border-slate-800 p-2 w-28 text-center">Berkas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredList.map((item, idx) => {
                  const tahap = TAHAP_TINDAK_LANJUT[item.tahapSaatIni];
                  const riwayat = item.riwayatTindakLanjut || [];
                  const lastHistory = riwayat.length > 0 ? riwayat[riwayat.length - 1] : null;

                  return (
                    <tr key={item.id} className="align-top print:break-inside-avoid">
                      <td className="border border-slate-800 p-2 text-center font-mono font-medium tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="border border-slate-800 p-2 font-mono tabular-nums space-y-0.5">
                        <div className="font-semibold text-slate-900">{item.tanggalSurat}</div>
                        {item.tanggalDiterima && item.tanggalDiterima !== item.tanggalSurat && (
                          <div className="text-[10px] text-slate-500">
                            Diterima: {item.tanggalDiterima}
                          </div>
                        )}
                      </td>
                      <td className="border border-slate-800 p-2">
                        <div className="font-semibold text-slate-900">{item.asalSurat}</div>
                        <div className="text-[10px] text-slate-600 font-mono mt-0.5 break-all">
                          {item.nomorSurat}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Sifat: {item.sifat}</div>
                      </td>
                      <td className="border border-slate-800 p-2 leading-relaxed text-slate-900">
                        {item.perihal}
                      </td>
                      <td className="border border-slate-800 p-2">
                        <div className="font-mono text-[10px] text-slate-500 tabular-nums">
                          {item.tanggalDisposisi || '-'}
                        </div>
                        {item.tenggatWaktu && (
                          <div className="font-mono text-[10px] font-semibold text-amber-800 tabular-nums">
                            Tenggat: {item.tenggatWaktu}
                          </div>
                        )}
                        <div className="font-semibold text-purple-900 mt-0.5">
                          {item.penerimaDisposisiNama.join(', ') || 'Belum didisposisikan'}
                        </div>
                        {item.instruksiDisposisi && (
                          <div className="text-[10px] text-slate-600 mt-0.5 italic">
                            &ldquo;{item.instruksiDisposisi}&rdquo;
                          </div>
                        )}
                      </td>
                      <td className="border border-slate-800 p-2 space-y-1.5">
                        {item.statusSelesai ? (
                          <div className="font-bold text-emerald-800">
                            ✓ Selesai Tindak Lanjut
                            {item.tanggalSelesai ? ` (${item.tanggalSelesai})` : ''}
                          </div>
                        ) : (
                          <div className="font-bold text-slate-900">
                            Tahap {item.tahapSaatIni}: {tahap?.nama}
                          </div>
                        )}

                        {includeHistory ? (
                          riwayat.length > 0 ? (
                            <ol className="space-y-1 pt-1 border-t border-slate-200 list-none">
                              {riwayat.map((h, hIdx) => (
                                <li
                                  key={h.id || hIdx}
                                  className="text-[10px] leading-snug text-slate-700 pl-2 border-l border-slate-300"
                                >
                                  <div className="font-semibold text-slate-900">
                                    {hIdx + 1}. Tahap {h.tahapId}: {h.tahapNama}
                                  </div>
                                  <div className="text-[9px] text-slate-500 font-mono tabular-nums">
                                    {h.tanggal || '-'} · {h.aktor}
                                  </div>
                                  <div className="text-slate-700">
                                    {normalizeRiwayatCatatan(h.catatan)}
                                  </div>
                                  {h.fileLampiran?.nama && (
                                    <div className="text-[9px] text-blue-700">
                                      Lampiran: {h.fileLampiran.nama}
                                    </div>
                                  )}
                                </li>
                              ))}
                            </ol>
                          ) : (
                            <div className="text-[10px] text-slate-400 italic">
                              Belum ada catatan riwayat proses.
                            </div>
                          )
                        ) : (
                          lastHistory && (
                            <div className="text-[10px] text-slate-600">
                              • {normalizeRiwayatCatatan(lastHistory.catatan)}
                            </div>
                          )
                        )}
                      </td>
                      <td className="border border-slate-800 p-2 text-center space-y-1">
                        {item.statusSelesai ? (
                          <div className="font-bold text-emerald-800">
                            {item.fileSuratKeluar ? 'Selesai (Surat Keluar Terbit)' : 'Selesai'}
                          </div>
                        ) : (
                          <div className="font-medium text-slate-700">Dalam Proses</div>
                        )}

                        {item.nomorSuratKeluar && (
                          <div className="text-[9px] font-mono text-slate-600 break-all">
                            No. Keluar: {item.nomorSuratKeluar}
                          </div>
                        )}

                        {/* Interactive PDF buttons on screen, plain indicator on print */}
                        <div className="flex flex-col gap-1 pt-1 print:hidden">
                          {item.fileSuratMasuk && (
                            <button
                              type="button"
                              onClick={() => onOpenPdfViewer(item.fileSuratMasuk!)}
                              className="inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-medium border border-blue-200"
                            >
                              <FileText className="w-3 h-3" />
                              <span>PDF Masuk</span>
                            </button>
                          )}
                          {item.fileSuratKeluar && (
                            <button
                              type="button"
                              onClick={() => onOpenPdfViewer(item.fileSuratKeluar!)}
                              className="inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-medium border border-emerald-200"
                            >
                              <FileCheck className="w-3 h-3" />
                              <span>PDF Keluar</span>
                            </button>
                          )}
                        </div>
                        <div className="hidden print:block text-[9px] text-slate-500">
                          {item.fileSuratMasuk ? 'PDF Masuk: Ada' : 'PDF Masuk: -'}
                          {item.fileSuratKeluar ? ' · PDF Keluar: Ada' : ''}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Tanda Tangan Pengesahan Laporan */}
        <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-6 sm:gap-4 mt-8 text-xs font-sans print:break-inside-avoid">
          <div className="text-center">
            <div className="text-slate-500">Mengetahui,</div>
            <div className="font-bold text-slate-900">Kepala Bidang Perumahan</div>
            <div className="h-16"></div>
            <div className="font-bold underline">{pejabatConfig.kepalaBidang.nama}</div>
            <div className="text-[11px] font-mono text-slate-600">
              NIP. {pejabatConfig.kepalaBidang.nip}
            </div>
          </div>

          <div className="text-center">
            <div className="text-slate-500">
              Bandung,{' '}
              {new Date().toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </div>
            <div className="font-bold text-slate-900">
              Ketua Tim Pengawasan dan Pengendalian Perumahan
            </div>
            <div className="h-16"></div>
            <div className="font-bold underline">{pejabatConfig.ketuaTim.nama}</div>
            <div className="text-[11px] font-mono text-slate-600">
              NIP. {pejabatConfig.ketuaTim.nip}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
