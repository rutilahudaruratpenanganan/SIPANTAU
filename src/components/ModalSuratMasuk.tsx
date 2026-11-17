import React, { useState } from 'react';
import { X, Upload, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { SuratMasuk, DokumenFile } from '../types';

interface ModalSuratMasukProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (suratData: Partial<SuratMasuk>) => void;
  currentPengunggah: string;
}

export const ModalSuratMasuk: React.FC<ModalSuratMasukProps> = ({
  isOpen,
  onClose,
  onSave,
  currentPengunggah,
}) => {
  const [nomorSurat, setNomorSurat] = useState('');
  const [tanggalSurat, setTanggalSurat] = useState(new Date().toISOString().split('T')[0]);
  const [asalSurat, setAsalSurat] = useState('');
  const [perihal, setPerihal] = useState('');
  const [sifat, setSifat] = useState<'Biasa' | 'Penting' | 'Segera' | 'Sangat Segera' | 'Rahasia'>('Biasa');
  const [errorMessage, setErrorMessage] = useState('');
  
  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewData, setFilePreviewData] = useState<DokumenFile | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);

      // Create previewable representation
      const sizeFormatted = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
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
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!asalSurat.trim() || !perihal.trim()) {
      setErrorMessage('Mohon lengkapi asal surat dan perihal surat.');
      return;
    }

    const newSurat: Partial<SuratMasuk> = {
      nomorSurat: nomorSurat.trim() || `SM/${Date.now().toString().slice(-4)}/DPKP`,
      tanggalSurat,
      tanggalDiterima: tanggalSurat,
      asalSurat: asalSurat.trim(),
      perihal: perihal.trim(),
      sifat,
      fileSuratMasuk: filePreviewData || {
        nama: `Surat_Masuk_${asalSurat.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
        ukuran: '1.8 MB',
        tipe: 'application/pdf',
        tanggalUnggah: new Date().toISOString().replace('T', ' ').substring(0, 16),
        pengunggah: currentPengunggah,
      },
    };

    onSave(newSurat);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              Upload & Registrasi Surat Masuk
            </h2>
            <p className="text-xs text-slate-400">
              Input data persuratan dan berkas naskah dinas masuk untuk ditindaklanjuti
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs flex items-center gap-2 font-semibold animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nomor Surat
              </label>
              <input
                type="text"
                value={nomorSurat}
                onChange={(e) => setNomorSurat(e.target.value)}
                placeholder="Contoh: 045/DIR-SS/XI/2026"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tanggal Surat *
              </label>
              <input
                type="date"
                value={tanggalSurat}
                onChange={(e) => setTanggalSurat(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Sifat Surat
              </label>
              <select
                value={sifat}
                onChange={(e) => setSifat(e.target.value as any)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
              >
                <option value="Biasa">Biasa</option>
                <option value="Penting">Penting</option>
                <option value="Segera">Segera</option>
                <option value="Sangat Segera">Sangat Segera</option>
                <option value="Rahasia">Rahasia</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Asal Surat / Pengirim <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={asalSurat}
              onChange={(e) => {
                setAsalSurat(e.target.value);
                if (errorMessage) setErrorMessage('');
              }}
              placeholder="Contoh: PPPSRS Apartemen Metro / Ombudsman RI / Ir. Max Bambang"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Perihal Surat <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={perihal}
              onChange={(e) => {
                setPerihal(e.target.value);
                if (errorMessage) setErrorMessage('');
              }}
              placeholder="Ringkasan atau perihal isi surat masuk..."
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>

          {/* Upload File PDF Surat Masuk */}
          <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/80">
            <label className="block text-xs font-semibold text-slate-800 mb-1">
              Upload Berkas Surat Masuk (PDF)
            </label>
            <p className="text-[11px] text-slate-500 mb-3">
              Unggah file dokumen resmi naskah dinas masuk dalam format PDF (maks. 25MB)
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:border-blue-500 rounded-lg text-xs font-medium text-slate-700 shadow-xs transition-colors">
                <Upload className="w-4 h-4 text-blue-600" />
                <span>Pilih File PDF</span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {(selectedFile || filePreviewData) && (
                <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="font-semibold truncate max-w-xs">
                    {selectedFile ? selectedFile.name : filePreviewData?.nama}
                  </span>
                  <span className="text-[11px] text-emerald-600">
                    ({selectedFile ? (selectedFile.size / (1024 * 1024)).toFixed(1) + ' MB' : filePreviewData?.ukuran})
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm transition-colors"
            >
              Simpan Surat Masuk
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
