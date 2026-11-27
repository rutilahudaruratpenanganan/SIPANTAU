import React from 'react';
import { X, Printer, Download } from 'lucide-react';
import { SuratMasuk, PejabatConfig, Personel } from '../types';
import { TAHAP_TINDAK_LANJUT } from '../utils/disposisiLogic';

interface ModalLembarDisposisiProps {
  isOpen: boolean;
  onClose: () => void;
  surat: SuratMasuk | null;
  pejabatConfig: PejabatConfig;
  personelList: Personel[];
}

export const ModalLembarDisposisi: React.FC<ModalLembarDisposisiProps> = ({
  isOpen,
  onClose,
  surat,
  pejabatConfig,
  personelList,
}) => {
  if (!isOpen || !surat) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-300 overflow-hidden my-6 max-h-[95vh] flex flex-col print:shadow-none print:border-none print:max-h-none print:m-0 print:w-full">
        
        {/* Top Action Bar (hidden on print) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 sm:px-6 py-3.5 bg-slate-900 text-white border-b border-slate-800 shrink-0 print:hidden">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Printer className="w-4 h-4 text-purple-400" />
              Lembar Disposisi Resmi Kedinasan
            </h2>
            <p className="text-[11px] text-slate-400">
              Format baku lembar disposisi persuratan Dinas Perumahan dan Kawasan Permukiman
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Lembar Disposisi</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Official Sheet */}
        <div className="p-4 sm:p-10 print:p-6 overflow-y-auto flex-1 font-sans text-slate-900 text-xs">
          
          {/* KOP RESMI */}
          <div className="text-center border-b-4 border-double border-slate-900 pb-4 mb-4">
            <h3 className="text-xs uppercase font-bold tracking-widest text-slate-700">
              Pemerintah Kota Bandung
            </h3>
            <h1 className="text-base font-extrabold uppercase tracking-wide text-slate-900 mt-0.5">
              {pejabatConfig.kepalaDinas.instansi}
            </h1>
            <h2 className="text-xs font-bold uppercase text-slate-800">
              Bidang Perumahan · Tim Pengawasan dan Pengendalian Perumahan
            </h2>
            <p className="text-[10px] text-slate-600 font-sans mt-1">
              Jalan Caringin Nomor 103 Telp. (022) 5410403, Fax 5410403 · Email: dpkpkotabandung@gmail.com
            </p>
          </div>

          <div className="text-center font-bold text-sm underline tracking-wider mb-4 uppercase">
            LEMBAR DISPOSISI
          </div>

          {/* Table Header: Surat Masuk Information */}
          <table className="w-full border-collapse border border-slate-900 text-xs mb-4 font-sans">
            <tbody>
              <tr>
                <td className="border border-slate-900 p-2 font-bold w-1/4 bg-slate-100">
                  Tanggal Surat
                </td>
                <td className="border border-slate-900 p-2 font-bold w-1/4">
                  {surat.tanggalSurat}
                </td>
                <td className="border border-slate-900 p-2 font-bold w-1/4 bg-slate-100">
                  Tingkat Urgensi / Sifat
                </td>
                <td className="border border-slate-900 p-2 font-bold w-1/4 text-rose-800">
                  {surat.sifat}
                </td>
              </tr>
              <tr>
                <td className="border border-slate-900 p-2 font-bold bg-slate-100">
                  Nomor Surat Asli
                </td>
                <td className="border border-slate-900 p-2 font-mono">
                  {surat.nomorSurat || '-'}
                </td>
                <td className="border border-slate-900 p-2 font-bold bg-slate-100">
                  Tanggal Disposisi
                </td>
                <td className="border border-slate-900 p-2 font-mono">
                  {surat.tanggalDisposisi || '-'}
                </td>
              </tr>
              <tr>
                <td className="border border-slate-900 p-2 font-bold bg-slate-100">
                  Tenggat Waktu
                </td>
                <td className="border border-slate-900 p-2 font-mono font-semibold text-amber-800">
                  {surat.tenggatWaktu || '-'}
                </td>
                <td className="border border-slate-900 p-2 font-bold bg-slate-100">
                  Status Tindak Lanjut
                </td>
                <td className="border border-slate-900 p-2 font-semibold">
                  {surat.statusSelesai ? 'Selesai Tindak Lanjut' : 'Dalam Proses'}
                </td>
              </tr>
              <tr>
                <td className="border border-slate-900 p-2 font-bold bg-slate-100">
                  Asal Surat / Pengirim
                </td>
                <td colSpan={3} className="border border-slate-900 p-2 font-bold">
                  {surat.asalSurat}
                </td>
              </tr>
              <tr>
                <td className="border border-slate-900 p-2 font-bold bg-slate-100 align-top">
                  Perihal
                </td>
                <td colSpan={3} className="border border-slate-900 p-2 leading-relaxed">
                  {surat.perihal}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Section: Disposisi Pejabat */}
          <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 border border-slate-900 text-xs font-sans mb-4">
            
            {/* Left: Disposisi Kabid Perumahan */}
            <div className="p-3 border-b sm:border-b-0 sm:border-r print:border-b-0 print:border-r border-slate-900 flex flex-col justify-between min-h-[160px]">
              <div>
                <div className="font-bold border-b border-slate-400 pb-1 mb-2 text-slate-900">
                  1. Disposisi Kepala Bidang Perumahan:
                </div>
                <div className="text-[11px] text-slate-700 italic">
                  Diteruskan kepada Ketua Tim Pengawasan dan Pengendalian Perumahan untuk ditelaah dan ditindaklanjuti secara seksama.
                </div>
              </div>
              <div className="pt-4 text-center">
                <div className="text-[10px] text-slate-500">Kepala Bidang Perumahan</div>
                <div className="font-bold underline mt-6">{pejabatConfig.kepalaBidang.nama}</div>
                <div className="text-[10px] font-mono">NIP. {pejabatConfig.kepalaBidang.nip}</div>
              </div>
            </div>

            {/* Right: Disposisi Ketua Tim */}
            <div className="p-3 flex flex-col justify-between min-h-[160px]">
              <div>
                <div className="font-bold border-b border-slate-400 pb-1 mb-2 text-slate-900">
                  2. Disposisi Ketua Tim Wasdal Perumahan:
                </div>
                <div className="text-[11px] mb-2 font-bold text-slate-900">
                  Diteruskan Kepada Personel:
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {(personelList.filter((p) => (p.peran === 'staf' || p.peran === 'administrator') && !p.isKetuaTim).length > 0
                    ? personelList.filter((p) => (p.peran === 'staf' || p.peran === 'administrator') && !p.isKetuaTim)
                    : personelList.filter((p) => !p.isKetuaTim && p.peran !== 'ketua_tim')
                  ).map((p) => {
                    const isAssigned = surat.penerimaDisposisiNama?.includes(p.nama);
                    return (
                      <span 
                        key={p.id}
                        className={`px-1.5 py-0.5 rounded text-[10px] border ${
                          isAssigned 
                            ? 'bg-purple-100 border-purple-500 font-bold text-purple-900' 
                            : 'border-slate-300 text-slate-400'
                        }`}
                      >
                        [{isAssigned ? '✓' : ' '}] {p.nama}
                      </span>
                    );
                  })}
                </div>
                {surat.instruksiDisposisi && (
                  <div className="text-[11px] text-slate-800 bg-slate-50 p-2 rounded border border-slate-200">
                    <span className="font-semibold">Instruksi:</span> {surat.instruksiDisposisi}
                  </div>
                )}
              </div>
              <div className="pt-4 text-center">
                <div className="text-[10px] text-slate-500">Ketua Tim Wasdal Perumahan</div>
                <div className="font-bold underline mt-6">{pejabatConfig.ketuaTim.nama}</div>
                <div className="text-[10px] font-mono">NIP. {pejabatConfig.ketuaTim.nip}</div>
              </div>
            </div>

          </div>

          {/* Section: Status Tindak Lanjut Terkini */}
          <div className="border border-slate-900 p-3 font-sans text-xs mb-4 bg-slate-50">
            <div className="font-bold text-slate-900 mb-1">
              Catatan / Progres Tindak Lanjut Terkini:
            </div>
            <div className="flex items-center gap-2 mb-2 font-semibold text-blue-900">
              <span>Posisi Tahap:</span>
              <span className="px-2 py-0.5 bg-blue-100 rounded text-blue-800">
                Tahap {surat.tahapSaatIni}: {TAHAP_TINDAK_LANJUT[surat.tahapSaatIni].nama}
              </span>
            </div>
            <div className="text-[11px] text-slate-700">
              {surat.riwayatTindakLanjut && surat.riwayatTindakLanjut.length > 0 ? (
                surat.riwayatTindakLanjut.map((r, i) => (
                  <div key={i} className="mb-1">
                    • <span className="font-mono text-slate-500">[{r.tanggal}]</span> {r.catatan} (Oleh: {r.aktor})
                  </div>
                ))
              ) : (
                <div>Dalam proses tindak lanjut tim pelaksana.</div>
              )}
            </div>
          </div>

          {/* Footer Official Disposisi */}
          <div className="text-[10px] text-slate-500 font-sans flex items-center justify-between border-t border-slate-300 pt-2">
            <span>SIPANTAU-WASDAL · Sistem Informasi Persuratan, Agenda, dan Pemantauan · Tim Pengawasan dan Pengendalian Perumahan</span>
            <span>Dokumen Otentik Terintegrasi DPKP</span>
          </div>

        </div>

        {/* Action bar on bottom (screen only) */}
        <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 flex justify-end shrink-0 print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
