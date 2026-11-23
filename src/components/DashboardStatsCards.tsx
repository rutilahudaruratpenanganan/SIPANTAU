import React from 'react';
import { 
  Inbox, 
  SendHorizontal, 
  FileCheck2, 
  Clock, 
  FileEdit, 
  TrendingUp,
  User,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { DashboardStats } from '../utils/disposisiLogic';
import { TahapTindakLanjutId } from '../types';

interface DashboardStatsCardsProps {
  stats: DashboardStats;
  selectedTahap: TahapTindakLanjutId | 'selesai' | 'perlu_disposisi' | 'aktif' | 'all';
  onSelectTahap: (tahap: TahapTindakLanjutId | 'selesai' | 'perlu_disposisi' | 'aktif' | 'all') => void;
  onOpenTambahSurat: () => void;
}

export const DashboardStatsCards: React.FC<DashboardStatsCardsProps> = ({
  stats,
  selectedTahap,
  onSelectTahap,
  onOpenTambahSurat,
}) => {
  return (
    <div className="space-y-6">
      
      {/* Top Welcome & Announcement Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-2xl p-6 text-white shadow-sm border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Sistem Informasi Persuratan, Agenda, dan Pemantauan
            </h1>
            <p className="text-sm sm:text-base font-medium text-blue-200 mt-1">
              Tim Pengawasan dan Pengendalian Perumahan
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onOpenTambahSurat}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              <Inbox className="w-4 h-4" />
              <span>Registrasi Surat Masuk</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main KPI Row - High level executive metrics without listing stages */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Card 1: Total Surat */}
        <div 
          onClick={() => onSelectTahap('all')}
          className={`cursor-pointer p-4 rounded-xl border bg-white transition-all shadow-sm hover:shadow-md ${
            selectedTahap === 'all' ? 'ring-2 ring-blue-600 border-blue-300' : 'border-slate-200'
          }`}
          title="Klik untuk melihat seluruh surat"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Total Surat Terdaftar</span>
            <Inbox className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {stats.totalSurat}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-blue-600" />
            <span>{stats.totalAktif} proses aktif · {stats.totalSelesai} selesai</span>
          </div>
        </div>

        {/* Card 2: Perlu Disposisi Ketua Tim */}
        <div 
          onClick={() => onSelectTahap('perlu_disposisi')}
          className={`cursor-pointer p-4 rounded-xl border bg-white transition-all shadow-sm hover:shadow-md ${
            selectedTahap === 'perlu_disposisi' ? 'ring-2 ring-amber-600 border-amber-300' : 'border-slate-200'
          }`}
          title="Klik untuk melihat surat yang belum didisposisikan"
        >
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-xs font-medium">Perlu Disposisi</span>
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-900 tabular-nums">
            {stats.totalPerluDisposisi}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Menunggu disposisi Ketua Tim
          </div>
        </div>

        {/* Card 3: Sedang Diproses (Aktif) */}
        <div 
          onClick={() => onSelectTahap('aktif')}
          className={`cursor-pointer p-4 rounded-xl border bg-white transition-all shadow-sm hover:shadow-md ${
            selectedTahap === 'aktif' ? 'ring-2 ring-blue-600 border-blue-300' : 'border-slate-200'
          }`}
          title="Klik untuk melihat surat yang sedang dalam proses tindak lanjut"
        >
          <div className="flex items-center justify-between text-blue-600 mb-2">
            <span className="text-xs font-medium">Sedang Diproses</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-blue-900 tabular-nums">
            {stats.totalAktif}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Dalam tindak lanjut operasional
          </div>
        </div>

        {/* Card 4: Selesai Tindak Lanjut */}
        <div 
          onClick={() => onSelectTahap('selesai')}
          className={`cursor-pointer p-4 rounded-xl border bg-white transition-all shadow-sm hover:shadow-md ${
            selectedTahap === 'selesai' ? 'ring-2 ring-emerald-600 border-emerald-300' : 'border-slate-200'
          }`}
          title="Klik untuk melihat surat yang telah selesai ditindaklanjuti"
        >
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-medium">Selesai Tindak Lanjut</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-900 tabular-nums">
            {stats.totalSelesai}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Tuntas dan terarsip resmi
          </div>
        </div>

        {/* Card 5: Surat Keluar Terbit */}
        <div 
          onClick={() => onSelectTahap('all')}
          className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="flex items-center justify-between text-purple-600 mb-2">
            <span className="text-xs font-medium">Surat Keluar Terbit</span>
            <FileCheck2 className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-purple-900 tabular-nums">
            {stats.totalDenganSuratKeluar}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Berkas naskah keluar ber-PDF
          </div>
        </div>

      </div>

      {/* Personel Workload Strip */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <User className="w-4 h-4 text-slate-500 shrink-0" />
          <span className="text-xs font-semibold text-slate-700 sm:whitespace-nowrap">Distribusi Disposisi Personel:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {stats.personelWorkload.map((p) => (
            <div 
              key={p.nama}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200"
            >
              <span className="font-medium">{p.nama}</span>
              <span className="font-mono font-bold px-1.5 py-0.2 bg-white text-blue-700 rounded text-[11px] border border-slate-200">
                {p.count} surat
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
