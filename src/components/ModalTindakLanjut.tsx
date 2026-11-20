import React, { useState, useEffect } from 'react';
import { 
  X, 
  CheckCircle2, 
  Circle, 
  Clock, 
  ArrowRight, 
  FileText, 
  Upload, 
  User, 
  Calendar,
  AlertCircle,
  FileCheck2,
  RotateCcw,
  Check,
  ChevronRight,
  FileEdit,
  Send,
  Pencil
} from 'lucide-react';
import { SuratMasuk, Role, Personel, TahapTindakLanjutId } from '../types';
import {
  TAHAP_TINDAK_LANJUT,
  LIST_TAHAP,
  getNextStage,
  canAdvanceStage,
  canCreateDisposisi,
  canUploadSuratKeluar,
  isFullAccessRole,
} from '../utils/disposisiLogic';

interface ModalTindakLanjutProps {
  isOpen: boolean;
  onClose: () => void;
  surat: SuratMasuk | null;
  currentRole: Role;
  currentUser: Personel;
  onAdvanceStage: (suratId: string, nextStage: TahapTindakLanjutId, catatan: string) => void;
  onUpdateStatusSelesai: (suratId: string, statusSelesai: boolean, catatan?: string, tanggalSelesai?: string) => void;
  onSetTahapDirect?: (suratId: string, tahap: TahapTindakLanjutId, catatan?: string) => void;
  onAddCatatan: (suratId: string, catatan: string) => void;
  onOpenUploadSuratKeluar: (surat: SuratMasuk) => void;
  onOpenPdfViewer: (file: any) => void;
  onOpenDisposisi: (surat: SuratMasuk) => void;
  onOpenEditSurat?: (surat: SuratMasuk) => void;
}

export const ModalTindakLanjut: React.FC<ModalTindakLanjutProps> = ({
  isOpen,
  onClose,
  surat,
  currentRole,
  currentUser,
  onAdvanceStage,
  onUpdateStatusSelesai,
  onSetTahapDirect,
  onAddCatatan,
  onOpenUploadSuratKeluar,
  onOpenPdfViewer,
  onOpenDisposisi,
  onOpenEditSurat,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  const [catatanBaru, setCatatanBaru] = useState('');
  const [statusMode, setStatusMode] = useState<'aktif' | 'selesai'>(
    surat?.statusSelesai ? 'selesai' : 'aktif'
  );
  const [tanggalSelesaiInput, setTanggalSelesaiInput] = useState(
    surat?.tanggalSelesai || todayStr
  );
  const [catatanSelesaiInput, setCatatanSelesaiInput] = useState(
    surat?.statusSelesai
      ? (surat.riwayatTindakLanjut?.slice().reverse().find(r => r.tahapNama === 'Selesai Tindak Lanjut')?.catatan || 'Tindak lanjut naskah dinas telah selesai penuh.')
      : 'Tindak lanjut naskah dinas telah selesai penuh, dokumen/surat tanggapan telah diterbitkan dan diarsipkan.'
  );
  const [selectedTahapChange, setSelectedTahapChange] = useState<TahapTindakLanjutId>(surat?.tahapSaatIni || 1);

  // Sync state whenever surat changes
  useEffect(() => {
    if (surat) {
      setStatusMode(surat.statusSelesai ? 'selesai' : 'aktif');
      setTanggalSelesaiInput(surat.tanggalSelesai || todayStr);
      setSelectedTahapChange(surat.tahapSaatIni);
      setCatatanBaru('');
      setCatatanSelesaiInput(
        surat.statusSelesai
          ? (surat.riwayatTindakLanjut?.slice().reverse().find((r) => r.tahapNama === 'Selesai Tindak Lanjut')?.catatan ||
              'Tindak lanjut naskah dinas telah selesai penuh.')
          : 'Tindak lanjut naskah dinas telah selesai penuh, dokumen/surat tanggapan telah diterbitkan dan diarsipkan.'
      );
    }
  }, [surat?.id, surat?.statusSelesai, surat?.tahapSaatIni, surat?.tanggalSelesai, todayStr]);

  if (!isOpen || !surat) return null;

  const nextStage = getNextStage(surat.tahapSaatIni);
  const allowAdvance = canAdvanceStage(currentRole, surat.tahapSaatIni);
  const allowDisposisi = canCreateDisposisi(currentRole);
  const allowUploadSuratKeluar = canUploadSuratKeluar(surat);

  const handleAdvance = () => {
    if (surat.tahapSaatIni === 7) {
      // Stage 7 advancement marks the tindak lanjut as Selesai
      const note = catatanBaru.trim() || 'Proses PESONA selesai, naskah dinas telah ditandatangani secara elektronik dan tindak lanjut dinyatakan selesai.';
      onUpdateStatusSelesai(surat.id, true, note, todayStr);
      setCatatanBaru('');
      return;
    }

    if (!nextStage) return;
    const note = catatanBaru.trim() || `Peralihan tahapan ke ${TAHAP_TINDAK_LANJUT[nextStage].nama}`;
    onAdvanceStage(surat.id, nextStage, note);
    setCatatanBaru('');
  };

  const handleApplyTahapDirect = () => {
    if (!onSetTahapDirect) return;
    if (selectedTahapChange === surat.tahapSaatIni) return;
    const note = catatanBaru.trim() || `Penyesuaian tahapan ke Tahap ${selectedTahapChange}: ${TAHAP_TINDAK_LANJUT[selectedTahapChange].nama}`;
    onSetTahapDirect(surat.id, selectedTahapChange, note);
    setCatatanBaru('');
  };

  const handleSimpanStatusSelesai = () => {
    const note = catatanSelesaiInput.trim() || 'Tindak lanjut naskah dinas telah selesai penuh.';
    onUpdateStatusSelesai(surat.id, true, note, tanggalSelesaiInput);
  };

  const handleBukaKembali = () => {
    onUpdateStatusSelesai(surat.id, false, 'Status tindak lanjut dibuka kembali ke proses berjalan.');
    setStatusMode('aktif');
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catatanBaru.trim()) return;
    onAddCatatan(surat.id, catatanBaru.trim());
    setCatatanBaru('');
  };

  const TEMPLATE_SELESAI = [
    'Surat balasan/jawaban resmi telah terbit dan dikirimkan kepada pengirim.',
    'Verifikasi lapangan dan telaahan teknis telah rampung dan disepakati.',
    'Pengesahan naskah dinas melalui PESONA telah selesai dan berkas diarsipkan.',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800 shrink-0">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs px-2.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold border border-blue-400/20 flex items-center gap-1.5 font-mono">
                <Calendar className="w-3.5 h-3.5 text-blue-300" />
                Tanggal Surat: {surat.tanggalSurat}
              </span>
              {surat.statusSelesai ? (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-400/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Status: Selesai Tindak Lanjut
                </span>
              ) : (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold border border-blue-400/30 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Status: Sedang Berjalan
                </span>
              )}
            </div>
            <h2 className="text-base font-bold text-white mt-1 line-clamp-1">
              Pemantauan Tindak Lanjut: {surat.perihal}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs flex-1">
          
          {/* Top Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 font-medium block">Asal Surat & Pengirim:</span>
                {!surat.statusSelesai && onOpenEditSurat && (
                  <button
                    type="button"
                    onClick={() => onOpenEditSurat(surat)}
                    className="text-amber-700 hover:text-amber-900 font-bold underline text-[11px] inline-flex items-center gap-1"
                    title="Edit data registrasi surat masuk"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Edit Surat</span>
                  </button>
                )}
              </div>
              <span className="font-bold text-slate-900 text-sm">{surat.asalSurat}</span>
              <span className="text-[11px] text-slate-500 block font-mono mt-0.5">
                No. {surat.nomorSurat} · Sifat: {surat.sifat}
              </span>
              {surat.tanggalDiterima && (
                <span className="text-[11px] text-slate-500 block font-mono">
                  Diterima: {surat.tanggalDiterima}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium block">Penerima Disposisi:</span>
                {!surat.statusSelesai && allowDisposisi && (
                  <button
                    type="button"
                    onClick={() => onOpenDisposisi(surat)}
                    className="text-purple-700 hover:text-purple-900 font-bold underline text-[11px]"
                  >
                    Edit Disposisi
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {surat.penerimaDisposisiNama && surat.penerimaDisposisiNama.length > 0 ? (
                  surat.penerimaDisposisiNama.map((p) => (
                    <span key={p} className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-semibold">
                      {p}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-400 italic">Belum didisposisikan</span>
                )}
              </div>
              <span className="text-[11px] text-slate-500 block mt-1">
                Tenggat: <span className="font-semibold text-slate-700">{surat.tenggatWaktu || 'Tidak ditentukan'}</span>
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block">Status Persuratan:</span>
              <div className="mt-1 flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${surat.statusSelesai ? 'bg-emerald-500' : 'bg-blue-600'}`} />
                <span className="font-bold text-slate-900">
                  {surat.statusSelesai ? 'Selesai Tindak Lanjut' : 'Sedang Berjalan (Aktif)'}
                </span>
              </div>
              {surat.fileSuratMasuk && (
                <button
                  onClick={() => onOpenPdfViewer(surat.fileSuratMasuk)}
                  className="mt-2 text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 text-[11px]"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Lihat PDF Surat Masuk</span>
                </button>
              )}
            </div>
          </div>

          {/* Instruksi Disposisi Banner with prominent Edit / Create Button */}
          {surat.instruksiDisposisi ? (
            <div className="p-4 rounded-xl bg-purple-50/80 border border-purple-200 text-purple-950 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-purple-900">
                    Instruksi Disposisi Ketua Tim:
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-purple-200 text-purple-800 font-medium">
                    {surat.tanggalDisposisi || 'Terdisposisi'}
                  </span>
                </div>
                
                {!surat.statusSelesai && allowDisposisi && (
                  <button
                    type="button"
                    onClick={() => onOpenDisposisi(surat)}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors self-start sm:self-auto"
                    title="Edit personel pelaksana atau ubah instruksi disposisi"
                  >
                    <FileEdit className="w-3.5 h-3.5" />
                    <span>Edit Disposisi & Instruksi</span>
                  </button>
                )}
              </div>

              <div className="p-3 bg-white rounded-lg border border-purple-200/80 leading-relaxed text-slate-800 font-medium">
                {surat.instruksiDisposisi}
              </div>

              {surat.catatanDisposisiKetuaTim && (
                <p className="text-[11px] text-purple-700 mt-2 italic">
                  Catatan Khusus: {surat.catatanDisposisiKetuaTim}
                </p>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-purple-50/50 border border-dashed border-purple-300 text-purple-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="font-bold text-xs text-purple-950">
                  Instruksi Disposisi Belum Ditetapkan
                </span>
                <p className="text-[11px] text-purple-700 mt-0.5">
                  {allowDisposisi
                    ? 'Surat masuk ini belum memiliki penetapan personel pelaksana dan petunjuk arahan disposisi dari Ketua Tim.'
                    : 'Menunggu penetapan personel pelaksana dan arahan disposisi dari Ketua Tim (Pendisposisi).'}
                </p>
              </div>
              {!surat.statusSelesai && allowDisposisi && (
                <button
                  type="button"
                  onClick={() => onOpenDisposisi(surat)}
                  className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>+ Buat Disposisi & Instruksi</span>
                </button>
              )}
            </div>
          )}

          {/* PUSAT PENGATURAN & PILIHAN STATUS TINDAK LANJUT */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Pusat Kendali Tindak Lanjut
                </span>
                <h3 className="text-sm font-bold text-slate-900 mt-0.5">
                  Pilihan Status Tindak Lanjut
                </h3>
              </div>

              {/* Segmented Selector for Status */}
              {!surat.statusSelesai && (
                <div className="flex items-center p-1 bg-slate-200/80 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setStatusMode('aktif')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      statusMode === 'aktif'
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Sedang Berjalan / Aktif</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatusMode('selesai')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      statusMode === 'selesai'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Selesai Tindak Lanjut</span>
                  </button>
                </div>
              )}
            </div>

            {/* TAB CONTENT 1: SEDANG BERJALAN (TAHAP 1 - 7) */}
            {statusMode === 'aktif' && (
              <div className="p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-blue-700 tracking-wider">
                      Tahapan Saat Ini
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                      Tahap {surat.tahapSaatIni}: {TAHAP_TINDAK_LANJUT[surat.tahapSaatIni]?.nama}
                    </h4>
                  </div>
                  
                  {/* Advance Action */}
                  <div className="flex items-center gap-2">
                    {allowAdvance ? (
                      <button
                        onClick={handleAdvance}
                        className={`px-4 py-2 font-semibold rounded-lg shadow-sm transition-all flex items-center gap-1.5 ${
                          surat.tahapSaatIni === 7
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : 'bg-blue-600 hover:bg-blue-500 text-white'
                        }`}
                      >
                        {surat.tahapSaatIni === 7 ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Selesaikan Tindak Lanjut (Status Selesai)</span>
                          </>
                        ) : (
                          <>
                            <span>Lanjutkan ke Tahap {nextStage}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="text-[11px] text-slate-400 bg-slate-100 px-2.5 py-1 rounded">
                        Memerlukan wewenang Ketua Tim atau Administrator untuk melanjutkan tahapan
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200/80 text-xs">
                  <p className="text-slate-700 leading-relaxed">
                    {TAHAP_TINDAK_LANJUT[surat.tahapSaatIni]?.deskripsi}
                  </p>
                  <div className="text-[11px] text-slate-500 mt-2">
                    Aktor Pelaksana: <span className="font-semibold text-slate-800">{TAHAP_TINDAK_LANJUT[surat.tahapSaatIni]?.aktorUtama}</span>
                  </div>
                </div>

                {/* Direct Stage Selector for authorized user */}
                {onSetTahapDirect && isFullAccessRole(currentRole) && (
                  <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-600">Pilih / Lompat Tahapan Langsung:</span>
                      <select
                        value={selectedTahapChange}
                        onChange={(e) => setSelectedTahapChange(Number(e.target.value) as TahapTindakLanjutId)}
                        className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                      >
                        {LIST_TAHAP.map((t) => (
                          <option key={t.id} value={t.id}>
                            Tahap {t.id}: {t.nama}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedTahapChange !== surat.tahapSaatIni && (
                      <button
                        onClick={handleApplyTahapDirect}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold transition-colors"
                      >
                        Terapkan Perubahan Tahap
                      </button>
                    )}
                  </div>
                )}

                {/* Quick button to mark Selesai directly */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-slate-500 text-[11px]">
                    Ingin langsung menutup dan menyelesaikan tindak lanjut ini?
                  </span>
                  <button
                    type="button"
                    onClick={() => setStatusMode('selesai')}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Pilih Status Selesai</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB CONTENT 2: STATUS SELESAI */}
            {statusMode === 'selesai' && (
              <div className="p-5 space-y-4 bg-emerald-50/30">
                {surat.statusSelesai ? (
                  <div className="p-4 bg-emerald-100/70 border border-emerald-300 rounded-xl flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-emerald-900 text-xs">
                          Surat Ini Telah Ditetapkan Berstatus: Selesai Tindak Lanjut
                        </h4>
                        <p className="text-emerald-800 text-[11px] mt-0.5">
                          Tercatat selesai pada tanggal: <span className="font-semibold">{surat.tanggalSelesai || 'Terarsip'}</span>
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleBukaKembali}
                      className="px-3 py-1.5 bg-white hover:bg-amber-50 text-amber-800 border border-amber-300 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                      title="Kembalikan status surat ke Sedang Berjalan jika memerlukan tindak lanjut lanjutan"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                      <span>Buka Kembali (Sedang Berjalan)</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Anda sedang memilih untuk menetapkan status surat ini menjadi <strong>Selesai Tindak Lanjut</strong>.
                    </span>
                  </div>
                )}

                {!surat.statusSelesai && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">
                          Tanggal Penyelesaian Tindak Lanjut *
                        </label>
                        <input
                          type="date"
                          value={tanggalSelesaiInput}
                          onChange={(e) => setTanggalSelesaiInput(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none font-mono"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-slate-700 font-semibold mb-1">
                          Catatan Penyelesaian Tindak Lanjut
                        </label>
                        <div className="space-y-2">
                          <textarea
                            rows={2}
                            value={catatanSelesaiInput}
                            onChange={(e) => setCatatanSelesaiInput(e.target.value)}
                            placeholder="Contoh: Tindak lanjut selesai, konsep tanggapan telah diparaf dan surat balasan telah diterbitkan..."
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                          />
                          
                          {/* Quick Template Chips */}
                          <div className="flex flex-wrap gap-1.5">
                            <span className="text-[10px] text-slate-500 self-center">Template:</span>
                            {TEMPLATE_SELESAI.map((t, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setCatatanSelesaiInput(t)}
                                className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded text-[10px] transition-colors truncate max-w-[280px]"
                                title={t}
                              >
                                + {t}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setStatusMode('aktif')}
                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors"
                      >
                        Batal / Kembali ke Proses Berjalan
                      </button>

                      <button
                        type="button"
                        onClick={handleSimpanStatusSelesai}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-sm flex items-center gap-1.5 transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Simpan & Tetapkan Status Selesai</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Section: Berkas Surat Keluar (PDF) */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <FileCheck2 className="w-4 h-4 text-emerald-600" />
                  Dokumen Surat Keluar (Hasil Akhir Tindak Lanjut)
                </h4>
                <p className="text-[11px] text-slate-500">
                  Unggah berkas PDF surat balasan / jawaban resmi yang telah selesai diparaf atau ditandatangani melalui PESONA
                </p>
              </div>

              {allowUploadSuratKeluar && !surat.statusSelesai && (
                <button
                  onClick={() => onOpenUploadSuratKeluar(surat)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{surat.fileSuratKeluar ? 'Ganti Surat Keluar' : 'Upload Surat Keluar (PDF)'}</span>
                </button>
              )}
            </div>

            {surat.fileSuratKeluar ? (
              <div className="p-3 bg-white rounded-lg border border-emerald-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    PDF
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{surat.fileSuratKeluar.nama}</div>
                    <div className="text-[11px] text-slate-500">
                      Ukuran: {surat.fileSuratKeluar.ukuran} · Unggah: {surat.fileSuratKeluar.tanggalUnggah} oleh {surat.fileSuratKeluar.pengunggah}
                    </div>
                    {surat.nomorSuratKeluar && (
                      <div className="text-[11px] font-mono text-emerald-700 mt-0.5">
                        Nomor Surat Keluar: {surat.nomorSuratKeluar}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => onOpenPdfViewer(surat.fileSuratKeluar)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold text-xs transition-colors"
                >
                  Preview Dokumen
                </button>
              </div>
            ) : (
              <div className="text-center py-4 text-slate-400 bg-white rounded-lg border border-dashed border-slate-300">
                <p>Belum ada berkas PDF Surat Keluar yang diunggah.</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Dapat diunggah pada tahap 4 (Pembuatan Draft) sampai tahap 7 (Proses PESONA).
                </p>
              </div>
            )}
          </div>

          {/* Section: Tambah Catatan & Log Riwayat */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 text-xs">
              Log Riwayat & Catatan Tindak Lanjut
            </h4>

            {/* Input Note Form */}
            {!surat.statusSelesai && (
              <form onSubmit={handleAddNote} className="flex gap-2">
                <input
                  type="text"
                  value={catatanBaru}
                  onChange={(e) => setCatatanBaru(e.target.value)}
                  placeholder="Tambah catatan perkembangan asistensi, hasil telaahan, arahan pimpinan..."
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg transition-colors whitespace-nowrap"
                >
                  Kirim Catatan
                </button>
              </form>
            )}

            {/* History Feed */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {surat.riwayatTindakLanjut && surat.riwayatTindakLanjut.length > 0 ? (
                surat.riwayatTindakLanjut.slice().reverse().map((r) => (
                  <div key={r.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between text-slate-500 text-[11px] mb-1">
                      <span className={`font-semibold ${r.tahapNama.includes('Selesai') ? 'text-emerald-700 font-bold' : 'text-slate-800'}`}>
                        {r.tahapNama}
                      </span>
                      <span className="font-mono">{r.tanggal}</span>
                    </div>
                    <p className="text-slate-700 leading-relaxed">{r.catatan}</p>
                    <div className="text-[10px] text-slate-400 mt-1">
                      Oleh: <span className="font-medium text-slate-600">{r.aktor}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-slate-400 text-center py-3 italic">
                  Belum ada catatan riwayat.
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            {!surat.statusSelesai && allowDisposisi && (
              <button
                onClick={() => onOpenDisposisi(surat)}
                className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-900 rounded-lg font-semibold text-xs transition-colors flex items-center gap-1.5"
              >
                <FileEdit className="w-3.5 h-3.5 text-purple-700" />
                <span>{surat.instruksiDisposisi ? 'Edit Disposisi & Instruksi' : 'Atur Disposisi & Instruksi'}</span>
              </button>
            )}

            {!surat.statusSelesai ? (
              <button
                onClick={() => setStatusMode('selesai')}
                className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 rounded-lg font-semibold text-xs transition-colors flex items-center gap-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Pilihan Status Selesai</span>
              </button>
            ) : (
              <button
                onClick={handleBukaKembali}
                className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 rounded-lg font-semibold text-xs transition-colors flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Buka Kembali</span>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold text-xs transition-colors"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
