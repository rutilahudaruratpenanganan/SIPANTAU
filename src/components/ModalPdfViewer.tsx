import React, { useEffect, useState } from 'react';
import { X, Download, AlertTriangle } from 'lucide-react';
import { DokumenFile } from '../types';
import { isChunkedPdfUrl, loadPdfDataUrlFromFirestore } from '../services/firestoreService';

interface ModalPdfViewerProps {
  isOpen: boolean;
  onClose: () => void;
  file: DokumenFile | null;
}

function dataUrlToViewerUrl(dataUrl: string): { url: string; isBlob: boolean } {
  try {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1 || !dataUrl.startsWith('data:')) {
      return { url: dataUrl, isBlob: false };
    }
    const header = dataUrl.slice(5, commaIdx);
    const mimeMatch = header.match(/^([^;]+)/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'application/pdf';
    const isBase64 = header.includes(';base64');
    const rawBody = dataUrl.slice(commaIdx + 1);
    if (!isBase64) {
      const blob = new Blob([decodeURIComponent(rawBody)], { type: mimeType });
      return { url: URL.createObjectURL(blob), isBlob: true };
    }
    const binary = atob(rawBody);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    return { url: URL.createObjectURL(blob), isBlob: true };
  } catch {
    return { url: dataUrl, isBlob: false };
  }
}

export const ModalPdfViewer: React.FC<ModalPdfViewerProps> = ({
  isOpen,
  onClose,
  file,
}) => {
  const [viewerUrl, setViewerUrl] = useState<string | undefined>(undefined);
  const [isLoadingChunks, setIsLoadingChunks] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let createdBlobUrl: string | null = null;
    setLoadError('');

    const applyResolvedDataUrl = (dataUrl: string) => {
      const converted = dataUrlToViewerUrl(dataUrl);
      if (cancelled) {
        if (converted.isBlob) URL.revokeObjectURL(converted.url);
        return;
      }
      if (converted.isBlob) {
        createdBlobUrl = converted.url;
      }
      setViewerUrl(converted.url);
      setIsLoadingChunks(false);
    };

    if (!isOpen || !file) {
      setViewerUrl(undefined);
      setIsLoadingChunks(false);
      return;
    }

    if (!file.dataUrl) {
      setViewerUrl(undefined);
      setIsLoadingChunks(false);
      return;
    }

    if (isChunkedPdfUrl(file.dataUrl)) {
      setViewerUrl(undefined);
      setIsLoadingChunks(true);
      loadPdfDataUrlFromFirestore(file.dataUrl)
        .then((assembled) => {
          applyResolvedDataUrl(assembled);
        })
        .catch((err) => {
          if (!cancelled) {
            setLoadError(
              err instanceof Error ? err.message : 'Gagal memuat isi dokumen PDF dari Cloud Firestore.'
            );
            setIsLoadingChunks(false);
          }
        });
    } else {
      applyResolvedDataUrl(file.dataUrl);
    }

    return () => {
      cancelled = true;
      if (createdBlobUrl) {
        URL.revokeObjectURL(createdBlobUrl);
      }
    };
  }, [isOpen, file?.nama, file?.dataUrl]);

  if (!isOpen || !file) return null;

  const hasBinaryPdf = Boolean(
    viewerUrl && (viewerUrl.startsWith('blob:') || viewerUrl.startsWith('data:'))
  );

  const handleDownload = () => {
    if (viewerUrl && (viewerUrl.startsWith('blob:') || viewerUrl.startsWith('data:'))) {
      const a = document.createElement('a');
      a.href = viewerUrl;
      a.download = file.nama;
      a.click();
    } else {
      const content = `%PDF-1.4\n% Dokumen Metadata SIPANTAU-WASDAL: ${file.nama}\n% Pengunggah: ${file.pengunggah}\n% Waktu: ${file.tanggalUnggah}\n%%EOF`;
      const blob = new Blob([content], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.nama;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden my-6 max-h-[92vh] flex flex-col text-slate-100">
        
        {/* Top Control Bar */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-950 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-red-600/20 text-red-400 border border-red-500/30 flex items-center justify-center font-bold text-xs">
              PDF
            </div>
            <div>
              <div className="font-bold text-white text-xs truncate max-w-md">
                {file.nama}
              </div>
              <div className="text-[10px] text-slate-400">
                {file.ukuran} · Diunggah pada {file.tanggalUnggah} oleh <span className="text-slate-300 font-medium">{file.pengunggah}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              disabled={isLoadingChunks}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
              title="Unduh Berkas PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh Berkas</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF Viewer Canvas */}
        <div className="flex-1 p-6 overflow-y-auto bg-slate-800 flex justify-center items-center">
          
          {isLoadingChunks ? (
            <div className="w-full max-w-2xl bg-slate-900/70 rounded-xl p-12 border border-slate-700 flex flex-col items-center justify-center gap-3 text-slate-200 text-xs min-h-[360px]">
              <div className="w-8 h-8 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
              <span className="font-semibold">Mengunduh & menyusun berkas PDF dari Cloud Firestore...</span>
            </div>
          ) : hasBinaryPdf ? (
            <iframe 
              src={viewerUrl} 
              title={file.nama} 
              className="w-full h-[65vh] rounded-lg bg-white shadow-2xl border border-slate-600"
            />
          ) : (
            /* Metadata-only Preview Canvas when binary PDF bytes are absent */
            <div className="w-full max-w-2xl bg-white text-slate-900 rounded-lg shadow-2xl p-8 sm:p-12 border border-slate-300 min-h-[560px] flex flex-col justify-between">
              
              {/* Kop Instansi */}
              <div>
                <div className="text-center border-b-2 border-slate-900 pb-4 mb-6">
                  <div className="text-xs uppercase tracking-widest font-bold text-slate-600">
                    Pemerintah Kota Bandung
                  </div>
                  <div className="text-sm font-extrabold uppercase text-slate-900 tracking-wide mt-0.5">
                    Dinas Perumahan dan Kawasan Permukiman
                  </div>
                  <div className="text-xs font-semibold text-slate-700">
                    Tim Pengawasan dan Pengendalian Perumahan (WASDAL)
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Jalan Caringin Nomor 103 Telp. (022) 5410403, Fax 5410403 · Email: dpkpkotabandung@gmail.com
                  </div>
                </div>

                {/* Transparent Notice */}
                <div className="mb-4 p-3.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <div className="font-bold">
                      {loadError ? 'Gagal Memuat Isi Berkas PDF' : 'Isi Berkas PDF Asli Belum Tersimpan di Server'}
                    </div>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      {loadError
                        ? loadError
                        : 'Dokumen ini baru memiliki metadata nama berkas (berasal dari data awal atau unggahan lama > 250 KB sebelum fitur penyimpanan penuh diaktifkan). Silakan unggah ulang file PDF melalui Edit Surat atau Upload Surat Keluar (klik "Buka Kembali" dahulu jika surat sudah berstatus Selesai).'}
                    </p>
                  </div>
                </div>

                {/* Document Body */}
                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between text-slate-600 text-[11px] pb-2 border-b border-slate-100">
                    <span>Ringkasan Metadata Dokumen Digital</span>
                    <span className="font-mono">METADATA TERCATAT</span>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Nama Dokumen:</span>
                      <span className="font-bold text-slate-900 font-mono text-right">{file.nama}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Tipe / Format:</span>
                      <span className="text-slate-800 font-medium">Portable Document Format (PDF)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Ukuran Berkas:</span>
                      <span className="text-slate-800 font-mono">{file.ukuran}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Waktu Registrasi:</span>
                      <span className="text-slate-800 font-mono">{file.tanggalUnggah}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Petugas Pengunggah:</span>
                      <span className="text-slate-900 font-semibold">{file.pengunggah}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Verification Footnote */}
              <div className="border-t border-slate-200 pt-4 flex items-center justify-between text-[11px] text-slate-500 mt-8">
                <div>
                  <div className="font-semibold text-slate-700">SIPANTAU-WASDAL</div>
                  <div className="text-[10px]">Penyimpanan Dokumen PDF Multi-Bagian Cloud Firestore</div>
                </div>
                <div className="w-16 h-16 border-2 border-blue-900 rounded p-1 flex flex-col items-center justify-center text-[9px] font-bold text-blue-900 text-center leading-tight">
                  <span>METADATA</span>
                  <span className="text-[8px] font-mono">SIPANTAU</span>
                  <span className="text-[7px]">DPKP</span>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0 text-xs">
          <span className="text-slate-400 text-[11px]">
            SIPANTAU-WASDAL · Document Preview Engine
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors font-medium text-xs"
          >
            Tutup Preview
          </button>
        </div>

      </div>
    </div>
  );
};
