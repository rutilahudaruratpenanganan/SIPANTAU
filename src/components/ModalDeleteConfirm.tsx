import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { SuratMasuk } from '../types';

interface ModalDeleteConfirmProps {
  isOpen: boolean;
  onClose: () => void;
  surat: SuratMasuk | null;
  onConfirmDelete: (suratId: string) => void;
}

export const ModalDeleteConfirm: React.FC<ModalDeleteConfirmProps> = ({
  isOpen,
  onClose,
  surat,
  onConfirmDelete,
}) => {
  if (!isOpen || !surat) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-xs">
        
        {/* Header */}
        <div className="p-5 flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Konfirmasi Hapus Surat
            </h3>
            <p className="text-slate-500 mt-1 leading-relaxed">
              Apakah Anda yakin ingin menghapus surat masuk dengan rincian berikut dari sistem persuratan?
            </p>
          </div>
        </div>

        {/* Details Box */}
        <div className="px-5 pb-3">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
            <div className="font-bold text-slate-900">{surat.asalSurat}</div>
            <div className="text-slate-600 font-mono text-[11px]">{surat.nomorSurat || `Tanggal Surat: ${surat.tanggalSurat}`}</div>
            <div className="text-slate-500 line-clamp-2">{surat.perihal}</div>
          </div>
          <p className="text-[11px] text-rose-600 mt-2 font-medium">
            * Tindakan ini permanen dan akan menghapus seluruh data disposisi serta riwayat tindak lanjut terkait.
          </p>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirmDelete(surat.id);
              onClose();
            }}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Ya, Hapus Surat</span>
          </button>
        </div>

      </div>
    </div>
  );
};
