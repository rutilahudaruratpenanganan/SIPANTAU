import React from 'react';
import { Printer, Download, FileSpreadsheet, Building2, CheckCircle2 } from 'lucide-react';
import { SuratMasuk, PejabatConfig, Personel } from '../types';
import { TAHAP_TINDAK_LANJUT } from '../utils/disposisiLogic';

interface RekapViewProps {
  suratList: SuratMasuk[];
  pejabatConfig: PejabatConfig;
  onExportCsv: () => void;
  onOpenPdfViewer: (file: any) => void;
}

export const RekapView: React.FC<RekapViewProps> = ({
  suratList,
  pejabatConfig,
  onExportCsv,
  onOpenPdfViewer,
}) => {
  const handlePrint = () => {
    window.print();
  };

  const aktifCount = suratList.filter((s) => !s.statusSelesai).length;
  const selesaiCount = suratList.filter((s) => s.statusSelesai).length;

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Print Controls (Hidden on print) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-purple-600" />
            Rekapitulasi Persuratan & Disposisi Tim Wasdal
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Format laporan monitoring berkala tindak lanjut naskah dinas siap cetak atau ekspor ke format spreadsheet
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onExportCsv}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors border border-slate-300"
          >
            <Download className="w-4 h-4" />
            <span>Ekspor CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Rekapitulasi</span>
          </button>
        </div>
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
          <p className="text-[11px] text-slate-600 mt-1">
            Data Per: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} · Total: {suratList.length} Surat ({aktifCount} Aktif, {selesaiCount} Selesai)
          </p>
        </div>

        {/* High-Density Report Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse border border-slate-800 text-[11px]">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-800 font-bold text-slate-900 uppercase">
                <th className="border border-slate-800 p-2 text-center w-10">No.</th>
                <th className="border border-slate-800 p-2 w-28">Tanggal Surat</th>
                <th className="border border-slate-800 p-2 w-44">Asal Surat</th>
                <th className="border border-slate-800 p-2">Perihal</th>
                <th className="border border-slate-800 p-2 w-40">Disposisi</th>
                <th className="border border-slate-800 p-2 w-48">Tindak Lanjut</th>
                <th className="border border-slate-800 p-2 w-28 text-center">Status Berkas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {suratList.map((item, idx) => {
                const tahap = TAHAP_TINDAK_LANJUT[item.tahapSaatIni];
                const lastHistory = item.riwayatTindakLanjut && item.riwayatTindakLanjut.length > 0
                  ? item.riwayatTindakLanjut[item.riwayatTindakLanjut.length - 1]
                  : null;

                return (
                  <tr key={item.id} className="align-top">
                    <td className="border border-slate-800 p-2 text-center font-mono font-medium">
                      {idx + 1}
                    </td>
                    <td className="border border-slate-800 p-2 font-mono">
                      <div className="font-semibold">{item.tanggalSurat}</div>
                    </td>
                    <td className="border border-slate-800 p-2">
                      <div className="font-semibold text-slate-900">{item.asalSurat}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{item.nomorSurat}</div>
                    </td>
                    <td className="border border-slate-800 p-2 leading-relaxed">
                      {item.perihal}
                    </td>
                    <td className="border border-slate-800 p-2">
                      <div className="font-mono text-[10px] text-slate-500">
                        {item.tanggalDisposisi || '-'}
                      </div>
                      <div className="font-semibold text-purple-900">
                        {item.penerimaDisposisiNama.join(', ') || 'Belum didisposisikan'}
                      </div>
                      {item.instruksiDisposisi && (
                        <div className="text-[10px] text-slate-600 mt-0.5 line-clamp-2 italic">
                          "{item.instruksiDisposisi}"
                        </div>
                      )}
                    </td>
                    <td className="border border-slate-800 p-2">
                      {item.statusSelesai ? (
                        <div className="font-bold text-emerald-800">
                          ✓ Selesai Tindak Lanjut
                        </div>
                      ) : (
                        <div className="font-bold text-slate-900">
                          Tahap {item.tahapSaatIni}: {tahap?.nama}
                        </div>
                      )}
                      {lastHistory && (
                        <div className="text-[10px] text-slate-600 mt-0.5">
                          • {lastHistory.catatan}
                        </div>
                      )}
                    </td>
                    <td className="border border-slate-800 p-2 text-center">
                      {item.statusSelesai ? (
                        <span className="font-bold text-emerald-800">
                          Selesai (Surat Keluar Terbit)
                        </span>
                      ) : (
                        <span className="text-slate-600">
                          Proses ({item.fileSuratMasuk ? 'PDF Ada' : '-'})
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Tanda Tangan Pengesahan Laporan */}
        <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-6 sm:gap-4 mt-8 text-xs font-sans">
          <div className="text-center">
            <div className="text-slate-500">Mengetahui,</div>
            <div className="font-bold text-slate-900">Kepala Bidang Perumahan</div>
            <div className="h-16"></div>
            <div className="font-bold underline">{pejabatConfig.kepalaBidang.nama}</div>
            <div className="text-[11px] font-mono text-slate-600">NIP. {pejabatConfig.kepalaBidang.nip}</div>
          </div>

          <div className="text-center">
            <div className="text-slate-500">
              Bandung, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <div className="font-bold text-slate-900">Ketua Tim Pengawasan dan Pengendalian Perumahan</div>
            <div className="h-16"></div>
            <div className="font-bold underline">{pejabatConfig.ketuaTim.nama}</div>
            <div className="text-[11px] font-mono text-slate-600">NIP. {pejabatConfig.ketuaTim.nip}</div>
          </div>
        </div>

      </div>

    </div>
  );
};
