import React, { useState, useEffect } from 'react';
import { 
  X, 
  Send, 
  UserCheck, 
  Calendar, 
  Clock, 
  AlertCircle, 
  FileEdit, 
  Check, 
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { SuratMasuk, Personel } from '../types';

interface ModalDisposisiProps {
  isOpen: boolean;
  onClose: () => void;
  surat: SuratMasuk | null;
  personelList: Personel[];
  onSaveDisposisi: (
    suratId: string, 
    penerimaIds: string[], 
    penerimaNama: string[], 
    instruksi: string, 
    catatan: string, 
    tanggalDisposisi: string,
    tenggatWaktu: string
  ) => void;
}

const TEMPLATE_INSTRUKSI = [
  'Pelajari, teliti regulasi, dan siapkan konsep naskah dinas/tanggapan.',
  'Lakukan verifikasi faktual dan tinjauan ke lapangan.',
  'Koordinasikan dengan para pihak terkait (pengurus/warga/instansi).',
  'Inventarisir kronologi masalah dan susun matriks tindak lanjut.',
  'Hadiri rapat pembahasan dan siapkan bahan paparan teknis.',
  'Siapkan konsep surat teguran/peringatan dan berita acara pemeriksaan.',
];

export const ModalDisposisi: React.FC<ModalDisposisiProps> = ({
  isOpen,
  onClose,
  surat,
  personelList,
  onSaveDisposisi,
}) => {
  const isEditing = Boolean(
    (surat?.penerimaDisposisiIds && surat.penerimaDisposisiIds.length > 0) ||
    surat?.instruksiDisposisi
  );

  const [selectedPersonelIds, setSelectedPersonelIds] = useState<string[]>(
    surat?.penerimaDisposisiIds || []
  );
  const [instruksi, setInstruksi] = useState(surat?.instruksiDisposisi || '');
  const [catatan, setCatatan] = useState(surat?.catatanDisposisiKetuaTim || '');
  const [tanggalDisposisi, setTanggalDisposisi] = useState(
    surat?.tanggalDisposisi || new Date().toISOString().split('T')[0]
  );
  const [tenggatWaktu, setTenggatWaktu] = useState(
    surat?.tenggatWaktu || 
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  const [errorMessage, setErrorMessage] = useState('');

  // Sync internal state only when the modal opens or target surat changes
  useEffect(() => {
    if (isOpen && surat) {
      setSelectedPersonelIds(surat.penerimaDisposisiIds || []);
      setInstruksi(surat.instruksiDisposisi || '');
      setCatatan(surat.catatanDisposisiKetuaTim || '');
      setTanggalDisposisi(
        surat.tanggalDisposisi || new Date().toISOString().split('T')[0]
      );
      setTenggatWaktu(
        surat.tenggatWaktu ||
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      );
      setErrorMessage('');
    }
  }, [isOpen, surat?.id]);

  if (!isOpen || !surat) return null;

  const stafList = personelList.filter((p) => (p.peran === 'staf' || p.peran === 'administrator') && !p.isKetuaTim);
  const availablePersonel =
    stafList.length > 0
      ? stafList
      : personelList.filter((p) => !p.isKetuaTim && p.peran !== 'ketua_tim').length > 0
      ? personelList.filter((p) => !p.isKetuaTim && p.peran !== 'ketua_tim')
      : personelList;

  const togglePersonel = (id: string) => {
    setErrorMessage('');
    if (selectedPersonelIds.includes(id)) {
      setSelectedPersonelIds(selectedPersonelIds.filter((pId) => pId !== id));
    } else {
      setSelectedPersonelIds([...selectedPersonelIds, id]);
    }
  };

  const handleSelectTemplate = (templateText: string) => {
    if (!instruksi.trim()) {
      setInstruksi(templateText);
    } else {
      setInstruksi(instruksi.trim() + ' ' + templateText);
    }
  };

  const handleReplaceTemplate = (templateText: string) => {
    setInstruksi(templateText);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPersonelIds.length === 0) {
      setErrorMessage('Pilih setidaknya satu staf / personel penerima disposisi.');
      return;
    }

    if (!instruksi.trim()) {
      setErrorMessage('Instruksi arahan disposisi Ketua Tim wajib diisi.');
      return;
    }

    const selectedNames = personelList
      .filter((p) => selectedPersonelIds.includes(p.id))
      .map((p) => p.nama);

    onSaveDisposisi(
      surat.id,
      selectedPersonelIds,
      selectedNames,
      instruksi.trim(),
      catatan.trim(),
      tanggalDisposisi.trim(),
      tenggatWaktu.trim()
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        
        {/* Header with Dynamic Edit / Initial State */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                {isEditing ? (
                  <FileEdit className="w-5 h-5 text-amber-400" />
                ) : (
                  <Send className="w-5 h-5 text-purple-400" />
                )}
                {isEditing ? 'Edit Disposisi & Instruksi Ketua Tim' : 'Lembar Disposisi & Instruksi Ketua Tim'}
              </h2>
              {isEditing && (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  Mode Edit
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isEditing
                ? 'Perbarui personel penerima, edit teks instruksi disposisi, catatan, dan tenggat waktu'
                : 'Penetapan personel pelaksana, petunjuk arahan disposisi, dan tenggat waktu tindak lanjut'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal disposisi"
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Surat Overview Header */}
        <div className="p-4 bg-purple-50/60 border-b border-purple-100 text-xs">
          <div className="font-semibold text-purple-950 mb-0.5">
            Surat Masuk: {surat.nomorSurat || `Surat Tanggal ${surat.tanggalSurat}`}
          </div>
          <div className="text-purple-800">
            <span className="font-medium">Asal:</span> {surat.asalSurat} · <span className="font-medium">Perihal:</span> {surat.perihal}
          </div>
        </div>

        {/* Disposisi Form */}
        <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
          
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 flex items-center gap-2 font-semibold animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Pilih Personel Staf Pelaksana */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block font-semibold text-slate-800">
                Diteruskan Kepada / Personel Pelaksana Disposisi <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-purple-700 font-medium">
                {selectedPersonelIds.length} personel dipilih
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {availablePersonel.map((staf) => {
                const isSelected = selectedPersonelIds.includes(staf.id);
                return (
                  <button
                    type="button"
                    key={staf.id}
                    onClick={() => togglePersonel(staf.id)}
                    className={`flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-purple-600 bg-purple-50 text-purple-950 ring-1 ring-purple-600'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{staf.nama}</div>
                      <div className="text-[11px] text-slate-500">{staf.jabatan}</div>
                    </div>
                    <UserCheck className={`w-4 h-4 ${isSelected ? 'text-purple-600' : 'text-slate-300'}`} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tanggal & Tenggat */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="disposisi-tanggal" className="block font-semibold text-slate-700 mb-1">
                Tanggal Disposisi
              </label>
              <input
                id="disposisi-tanggal"
                type="date"
                value={tanggalDisposisi}
                onChange={(e) => setTanggalDisposisi(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-purple-600 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="disposisi-tenggat" className="block font-semibold text-slate-700 mb-1">
                Tenggat Waktu Penyelesaian
              </label>
              <input
                id="disposisi-tenggat"
                type="date"
                value={tenggatWaktu}
                onChange={(e) => setTenggatWaktu(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-purple-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Petunjuk / Instruksi Disposisi - EDITABLE */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="disposisi-instruksi" className="block font-semibold text-slate-800">
                Instruksi / Arahan Disposisi Ketua Tim <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                {instruksi && (
                  <button
                    type="button"
                    onClick={() => setInstruksi('')}
                    className="text-[11px] text-rose-600 hover:underline"
                  >
                    Kosongkan
                  </button>
                )}
                <span className="text-[11px] text-slate-400">
                  {instruksi.length} karakter
                </span>
              </div>
            </div>

            {/* Template Buttons */}
            <div className="space-y-1 mb-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className="text-[10px] font-semibold text-slate-500 block uppercase tracking-wider">
                Pilih atau gabungkan instruksi standar:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATE_INSTRUKSI.map((tmpl, idx) => (
                  <div key={idx} className="inline-flex rounded-md shadow-2xs">
                    <button
                      type="button"
                      onClick={() => handleReplaceTemplate(tmpl)}
                      className="px-2 py-1 bg-white hover:bg-purple-100 text-slate-700 hover:text-purple-900 border border-slate-200 rounded-l text-[11px] transition-colors"
                      title="Ganti instruksi dengan teks ini"
                    >
                      {tmpl.substring(0, 32)}...
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectTemplate(tmpl)}
                      className="px-1.5 py-1 bg-purple-50 hover:bg-purple-200 text-purple-700 border-t border-b border-r border-purple-200 rounded-r text-[10px] font-bold"
                      title="Tambahkan ke akhir teks instruksi"
                    >
                      +
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Textarea for Instruksi */}
            <textarea
              id="disposisi-instruksi"
              rows={3}
              value={instruksi}
              onChange={(e) => setInstruksi(e.target.value)}
              placeholder="Ketik instruksi atau arahan spesifik pelaksanaan tindak lanjut bagi personel..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-purple-600 focus:outline-none leading-relaxed"
            />
          </div>

          {/* Catatan Tambahan */}
          <div>
            <label htmlFor="disposisi-catatan" className="block font-semibold text-slate-700 mb-1">
              Catatan Penting / Atensi Khusus Ketua Tim
            </label>
            <input
              id="disposisi-catatan"
              type="text"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Contoh: Lampirkan bukti tanda terima lapangan, koordinasi dengan perwakilan warga..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-purple-600 focus:outline-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Batal
            </button>

            <button
              type="submit"
              className={`px-5 py-2 font-bold text-white rounded-lg shadow-sm transition-all flex items-center gap-1.5 ${
                isEditing
                  ? 'bg-amber-600 hover:bg-amber-500'
                  : 'bg-purple-600 hover:bg-purple-500'
              }`}
            >
              {isEditing ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Simpan Perubahan Disposisi & Instruksi</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Simpan & Teruskan Disposisi</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
