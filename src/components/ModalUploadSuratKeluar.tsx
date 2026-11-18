import React, { useState, useEffect } from 'react';
import { X, Upload, FileCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { SuratMasuk, DokumenFile } from '../types';

interface ModalUploadSuratKeluarProps {
  isOpen: boolean;
  onClose: () => void;
  surat: SuratMasuk | null;
  onSaveSuratKeluar: (
    suratId: string,
    fileData: DokumenFile,
    nomorSuratKeluar: string,
    tanggalSuratKeluar: string,
    perihalSuratKeluar: string,
    tandaiSelesai: boolean
  ) => void;
  currentPengunggah: string;
}

export const ModalUploadSuratKeluar: React.FC<ModalUploadSuratKeluarProps> = ({
  isOpen,
  onClose,
  surat,
  onSaveSuratKeluar,
  currentPengunggah,
}) => {
  const [nomorSuratKeluar, setNomorSuratKeluar] = useState(
    surat?.nomorSuratKeluar || `503/WASDAL/${Date.now().toString().slice(-4)}/DPKP`
  );
  const [tanggalSuratKeluar, setTanggalSuratKeluar] = useState(
    surat?.tanggalSuratKeluar || new Date().toISOString().split('T')[0]
  );
  const [perihalSuratKeluar, setPerihalSuratKeluar] = useState(
    surat?.perihalSuratKeluar || (surat ? `Jawaban / Tanggapan atas ${surat.perihal}` : '')
  );
  const [tandaiSelesai, setTandaiSelesai] = useState(true);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewData, setFilePreviewData] = useState<DokumenFile | null>(
    surat?.fileSuratKeluar || null
  );
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Sync only when modal opens or active surat ID changes (avoid wiping selectedFile during snapshot updates)
  useEffect(() => {
    if (!isOpen || !surat) return;
    setNomorSuratKeluar(
      surat.nomorSuratKeluar || `503/WASDAL/${Date.now().toString().slice(-4)}/DPKP`
    );
    setTanggalSuratKeluar(
      surat.tanggalSuratKeluar || new Date().toISOString().split('T')[0]
    );
    setPerihalSuratKeluar(
      surat.perihalSuratKeluar || `Jawaban / Tanggapan atas ${surat.perihal}`
    );
    setFilePreviewData(surat.fileSuratKeluar || null);
    setSelectedFile(null);
    setIsReadingFile(false);
    setErrorMessage('');
  }, [isOpen, surat?.id]);

  if (!isOpen || !surat) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 12 * 1024 * 1024) {
        setErrorMessage('Ukuran berkas PDF maksimal 12 MB agar dapat tersimpan penuh di database.');
        e.target.value = '';
        return;
      }

      setErrorMessage('');
      setSelectedFile(file);
      setIsReadingFile(true);

      const sizeFormatted = Math.max(0.1, file.size / (1024 * 1024)).toFixed(1) + ' MB';
      const fileData: DokumenFile = {
        nama: file.name,
        ukuran: sizeFormatted,
        tipe: file.type || 'application/pdf',
        tanggalUnggah: new Date().toISOString().replace('T', ' ').substring(0, 16),
        pengunggah: currentPengunggah,
      };

      const reader = new FileReader();
      reader.onload = () => {
        fileData.dataUrl = reader.result as string;
        setFilePreviewData(fileData);
        setIsReadingFile(false);
      };
      reader.onerror = () => {
        setErrorMessage('Gagal membaca berkas PDF yang dipilih. Silakan coba lagi.');
        setIsReadingFile(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadingFile) {
      setErrorMessage('Mohon tunggu hingga proses pembacaan berkas PDF selesai.');
      return;
    }

    const fileToSave: DokumenFile = filePreviewData || {
      nama: `Surat_Keluar_Resmi_${(surat.nomorSurat || surat.id).replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
      ukuran: '2.1 MB',
      tipe: 'application/pdf',
      tanggalUnggah: new Date().toISOString().replace('T', ' ').substring(0, 16),
      pengunggah: currentPengunggah,
    };

    onSaveSuratKeluar(
      surat.id,
      fileToSave,
      nomorSuratKeluar,
      tanggalSuratKeluar,
      perihalSuratKeluar,
      tandaiSelesai
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-emerald-400" />
              Upload Berkas Surat Keluar (PDF)
            </h2>
            <p className="text-xs text-slate-400">
              Dokumen resmi jawaban / tindak lanjut akhir yang telah diparaf atau ditandatangani
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Surat Masuk Context */}
        <div className="p-4 bg-emerald-50/70 border-b border-emerald-100 text-xs">
          <div className="font-semibold text-emerald-950">
            Tindak Lanjut Surat Masuk: {surat.nomorSurat || `Surat Tanggal ${surat.tanggalSurat}`}
          </div>
          <div className="text-emerald-800 mt-0.5 truncate">
            {surat.perihal}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Nomor Surat Keluar <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={nomorSuratKeluar}
                onChange={(e) => setNomorSuratKeluar(e.target.value)}
                placeholder="Contoh: 503/WASDAL/1102/DPKP"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Tanggal Surat Keluar <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={tanggalSuratKeluar}
                onChange={(e) => setTanggalSuratKeluar(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Perihal Surat Keluar <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              value={perihalSuratKeluar}
              onChange={(e) => setPerihalSuratKeluar(e.target.value)}
              placeholder="Perihal surat balasan / penjelasan / surat keterangan..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
            />
          </div>

          {/* Upload PDF Box */}
          <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/80">
            <label className="block font-semibold text-slate-800 mb-1">
              Unggah File PDF Surat Keluar (TTE PESONA) <span className="text-rose-500">*</span>
            </label>
            <p className="text-[11px] text-slate-500 mb-3">
              Format dokumen PDF resmi yang telah disahkan dan siap didistribusikan (maks. 12MB)
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:border-emerald-500 rounded-lg font-medium text-slate-700 shadow-xs transition-colors">
                <Upload className="w-4 h-4 text-emerald-600" />
                <span>{filePreviewData ? 'Ganti Berkas PDF' : 'Pilih Berkas PDF'}</span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {isReadingFile ? (
                <div className="flex items-center gap-2 text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                  <span className="font-medium">Memproses berkas PDF...</span>
                </div>
              ) : (selectedFile || filePreviewData) && (
                <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span className="font-semibold truncate max-w-xs">
                    {selectedFile ? selectedFile.name : filePreviewData?.nama}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Tandai Selesai Checkbox */}
          <label className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-50 border border-emerald-200 cursor-pointer">
            <input
              type="checkbox"
              checked={tandaiSelesai}
              onChange={(e) => setTandaiSelesai(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
            />
            <div>
              <span className="font-bold text-emerald-950 block">
                Tandai Tindak Lanjut Selesai Penuh
              </span>
              <span className="text-[11px] text-emerald-800">
                Surat akan diarsipkan dengan status 'Selesai' dan berkas surat keluar terpasang.
              </span>
            </div>
          </label>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isReadingFile}
              className="px-4 py-2 font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <FileCheck className="w-4 h-4" />
              <span>{isReadingFile ? 'Memproses PDF...' : 'Simpan & Terbitkan Surat Keluar'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
