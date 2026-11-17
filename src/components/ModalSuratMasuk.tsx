import React, { useState, useEffect } from 'react';
import { X, Upload, FileText, FileEdit, CheckCircle2, AlertCircle } from 'lucide-react';
import { SuratMasuk, DokumenFile } from '../types';

interface ModalSuratMasukProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (suratData: Partial<SuratMasuk>) => void;
  currentPengunggah: string;
  initialSurat?: SuratMasuk | null;
}

export const ModalSuratMasuk: React.FC<ModalSuratMasukProps> = ({
  isOpen,
  onClose,
  onSave,
  currentPengunggah,
  initialSurat = null,
}) => {
  const isEditing = Boolean(initialSurat);
  const todayStr = new Date().toISOString().split('T')[0];

  const [nomorSurat, setNomorSurat] = useState(initialSurat?.nomorSurat || '');
  const [tanggalSurat, setTanggalSurat] = useState(initialSurat?.tanggalSurat || todayStr);
  const [tanggalDiterima, setTanggalDiterima] = useState(
    initialSurat?.tanggalDiterima || initialSurat?.tanggalSurat || todayStr
  );
  const [tanggalDiterimaTouched, setTanggalDiterimaTouched] = useState(Boolean(initialSurat));
  const [asalSurat, setAsalSurat] = useState(initialSurat?.asalSurat || '');
  const [perihal, setPerihal] = useState(initialSurat?.perihal || '');
  const [sifat, setSifat] = useState<'Biasa' | 'Penting' | 'Segera' | 'Sangat Segera' | 'Rahasia'>(
    initialSurat?.sifat || 'Biasa'
  );
  const [errorMessage, setErrorMessage] = useState('');

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewData, setFilePreviewData] = useState<DokumenFile | null>(
    initialSurat?.fileSuratMasuk || null
  );

  // Sync form fields whenever modal opens or target surat changes
  useEffect(() => {
    if (!isOpen) return;
    if (initialSurat) {
      setNomorSurat(initialSurat.nomorSurat || '');
      setTanggalSurat(initialSurat.tanggalSurat || todayStr);
      setTanggalDiterima(initialSurat.tanggalDiterima || initialSurat.tanggalSurat || todayStr);
      setTanggalDiterimaTouched(true);
      setAsalSurat(initialSurat.asalSurat || '');
      setPerihal(initialSurat.perihal || '');
      setSifat(initialSurat.sifat || 'Biasa');
      setSelectedFile(null);
      setFilePreviewData(initialSurat.fileSuratMasuk || null);
      setErrorMessage('');
    } else {
      setNomorSurat('');
      setTanggalSurat(todayStr);
      setTanggalDiterima(todayStr);
      setTanggalDiterimaTouched(false);
      setAsalSurat('');
      setPerihal('');
      setSifat('Biasa');
      setSelectedFile(null);
      setFilePreviewData(null);
      setErrorMessage('');
    }
  }, [isOpen, initialSurat?.id]);

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
    if (!tanggalSurat) {
      setErrorMessage('Mohon tentukan tanggal surat.');
      return;
    }

    const payload: Partial<SuratMasuk> = {
      nomorSurat: nomorSurat.trim() || `SM/${Date.now().toString().slice(-4)}/DPKP`,
      tanggalSurat,
      tanggalDiterima: tanggalDiterima || tanggalSurat,
      asalSurat: asalSurat.trim(),
      perihal: perihal.trim(),
      sifat,
    };

    if (isEditing) {
      if (filePreviewData) {
        payload.fileSuratMasuk = filePreviewData;
      } else if (initialSurat?.fileSuratMasuk) {
        payload.fileSuratMasuk = initialSurat.fileSuratMasuk;
      }
    } else {
      payload.fileSuratMasuk = filePreviewData || {
        nama: `Surat_Masuk_${asalSurat.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
        ukuran: '1.8 MB',
        tipe: 'application/pdf',
        tanggalUnggah: new Date().toISOString().replace('T', ' ').substring(0, 16),
        pengunggah: currentPengunggah,
      };
    }

    onSave(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                {isEditing ? (
                  <FileEdit className="w-5 h-5 text-amber-400" />
                ) : (
                  <FileText className="w-5 h-5 text-blue-400" />
                )}
                {isEditing ? 'Edit Registrasi Surat Masuk' : 'Upload & Registrasi Surat Masuk'}
              </h2>
              {isEditing && (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  Mode Edit
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isEditing
                ? 'Perbarui data registrasi surat masuk (nomor surat, tanggal, asal, perihal, sifat) atau ganti berkas PDF'
                : 'Input data persuratan dan berkas naskah dinas masuk untuk ditindaklanjuti'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Tutup modal registrasi surat masuk"
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
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                Sifat Surat
              </label>
              <select
                value={sifat}
                onChange={(e) => setSifat(e.target.value as SuratMasuk['sifat'])}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
              >
                <option value="Biasa">Biasa</option>
                <option value="Penting">Penting</option>
                <option value="Segera">Segera</option>
                <option value="Sangat Segera">Sangat Segera</option>
                <option value="Rahasia">Rahasia</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tanggal Surat *
              </label>
              <input
                type="date"
                required
                value={tanggalSurat}
                onChange={(e) => {
                  const nextVal = e.target.value;
                  setTanggalSurat(nextVal);
                  if (!tanggalDiterimaTouched && !isEditing) {
                    setTanggalDiterima(nextVal);
                  }
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tanggal Diterima
              </label>
              <input
                type="date"
                value={tanggalDiterima}
                onChange={(e) => {
                  setTanggalDiterimaTouched(true);
                  setTanggalDiterima(e.target.value);
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
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
              {isEditing ? 'Berkas Surat Masuk (PDF)' : 'Upload Berkas Surat Masuk (PDF)'}
            </label>
            <p className="text-[11px] text-slate-500 mb-3">
              {isEditing
                ? 'Biarkan jika tidak mengganti berkas PDF yang sudah tersimpan, atau pilih file PDF baru (maks. 25MB).'
                : 'Unggah file dokumen resmi naskah dinas masuk dalam format PDF (maks. 25MB)'}
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:border-blue-500 rounded-lg text-xs font-medium text-slate-700 shadow-xs transition-colors">
                <Upload className="w-4 h-4 text-blue-600" />
                <span>{isEditing && filePreviewData ? 'Ganti File PDF' : 'Pilih File PDF'}</span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {(selectedFile || filePreviewData) && (
                <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
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
              className={`px-4 py-2 text-xs font-semibold text-white rounded-lg shadow-sm transition-colors ${
                isEditing
                  ? 'bg-amber-600 hover:bg-amber-500'
                  : 'bg-blue-600 hover:bg-blue-500'
              }`}
            >
              {isEditing ? 'Simpan Perubahan Surat' : 'Simpan Surat Masuk'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
