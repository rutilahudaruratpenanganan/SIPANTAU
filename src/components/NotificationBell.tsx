import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Bell,
  CheckCheck,
  Clock,
  FileText,
  Inbox,
  Send,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { NotifikasiDisposisi, SuratMasuk } from '../types';
import { getNotificationDeadlineInfo } from '../utils/notifikasiLogic';

interface NotificationBellProps {
  currentAccountName: string;
  notifications: NotifikasiDisposisi[];
  unreadCount: number;
  suratList: SuratMasuk[];
  onClickNotification: (notif: NotifikasiDisposisi) => void;
  onMarkAllRead: () => void;
}

const SIFAT_BADGE_MAP: Record<SuratMasuk['sifat'], string> = {
  Biasa: 'bg-slate-100 text-slate-600 border-slate-200',
  Penting: 'bg-blue-50 text-blue-700 border-blue-200',
  Segera: 'bg-amber-50 text-amber-800 border-amber-200',
  'Sangat Segera': 'bg-rose-50 text-rose-700 border-rose-200',
  Rahasia: 'bg-purple-50 text-purple-800 border-purple-200',
};

const DEADLINE_TONE_MAP = {
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  slate: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const NotificationBell: React.FC<NotificationBellProps> = ({
  currentAccountName,
  notifications,
  unreadCount,
  suratList,
  onClickNotification,
  onMarkAllRead,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'unread'>('all');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  const suratMap = new Map<string, SuratMasuk>(suratList.map((s) => [s.id, s]));
  const visibleItems =
    filterMode === 'unread'
      ? notifications.filter((n) => !n.dibaca)
      : notifications;

  const ariaLabel =
    unreadCount > 0
      ? `Notifikasi Disposisi (${unreadCount} belum dibaca)`
      : 'Notifikasi Disposisi';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        data-testid="notification-bell-button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        title={ariaLabel}
        className={`relative flex items-center justify-center w-9 h-9 rounded-lg border transition-colors ${
          isOpen
            ? 'bg-slate-700 border-slate-500 text-white'
            : unreadCount > 0
            ? 'bg-slate-800 hover:bg-slate-700/90 border-amber-500/40 text-amber-300'
            : 'bg-slate-800 hover:bg-slate-700/80 border-slate-700 text-slate-300 hover:text-white'
        }`}
      >
        <Bell className={`w-4 h-4 ${unreadCount > 0 ? 'animate-[wiggle_1.5s_ease-in-out_1]' : ''}`} />
        {unreadCount > 0 && (
          <span
            data-testid="notification-unread-badge"
            className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-none flex items-center justify-center ring-2 ring-slate-900 shadow-sm tabular-nums"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <div
            role="dialog"
            aria-label="Daftar Notifikasi Disposisi"
            data-testid="notification-popover"
            className="fixed inset-x-3 top-16 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[410px] bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden text-slate-800"
          >
            {/* Header */}
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between gap-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Bell className="w-4 h-4 text-amber-400 shrink-0" />
                  <h3 className="text-xs font-bold tracking-tight text-white whitespace-nowrap">
                    Notifikasi Disposisi
                  </h3>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-rose-500/25 text-rose-200 border border-rose-400/30 text-[10px] font-bold tabular-nums whitespace-nowrap shrink-0">
                      {unreadCount} baru
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                  Penerima: <span className="text-slate-200 font-medium">{currentAccountName}</span>
                </p>
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => onMarkAllRead()}
                  className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-semibold text-sky-300 hover:text-sky-200 transition-colors whitespace-nowrap"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tandai semua dibaca</span>
                  <span className="sm:hidden">Tandai dibaca</span>
                </button>
              )}
            </div>

            {/* Filter Switch */}
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 text-[11px]">
              <div className="inline-flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                    filterMode === 'all'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Semua ({notifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('unread')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                    filterMode === 'unread'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Belum Dibaca ({unreadCount})
                </button>
              </div>

              <span className="text-[10px] text-slate-500 hidden sm:inline">
                Klik item untuk buka surat
              </span>
            </div>

            {/* Notification List */}
            <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
              {visibleItems.length === 0 ? (
                <div className="py-10 px-6 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <Inbox className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700">
                    {filterMode === 'unread' && notifications.length > 0
                      ? 'Semua notifikasi disposisi sudah dibaca.'
                      : 'Belum ada disposisi surat untuk Anda.'}
                  </p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {filterMode === 'unread' && notifications.length > 0
                      ? 'Anda dapat meninjau riwayat disposisi sebelumnya pada tab Semua.'
                      : 'Notifikasi akan muncul otomatis saat Ketua Tim mendisposisikan surat kepada akun Anda.'}
                  </p>
                  {filterMode === 'unread' && notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilterMode('all')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 mt-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-colors"
                    >
                      Lihat Semua Disposisi
                    </button>
                  )}
                </div>
              ) : (
                visibleItems.map((notif) => {
                  const linkedSurat = suratMap.get(notif.suratId);
                  const deadlineBadge = getNotificationDeadlineInfo(
                    notif.tenggatWaktu,
                    linkedSurat?.statusSelesai
                  );

                  return (
                    <button
                      key={notif.id}
                      type="button"
                      data-testid={`notif-item-${notif.suratId}`}
                      onClick={() => {
                        setIsOpen(false);
                        onClickNotification(notif);
                      }}
                      className={`w-full text-left px-4 py-3 transition-colors flex flex-col gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 ${
                        notif.dibaca
                          ? 'bg-white hover:bg-slate-50'
                          : 'bg-blue-50/75 hover:bg-blue-50'
                      }`}
                    >
                      {/* Top Badge & Time Row */}
                      <div className="flex items-center justify-between gap-2 w-full">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          {!notif.dibaca && (
                            <span
                              className="w-2 h-2 rounded-full bg-blue-600 shrink-0"
                              title="Belum dibaca"
                            />
                          )}
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                              notif.jenis === 'disposisi_diperbarui'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-purple-50 text-purple-800 border-purple-200'
                            }`}
                          >
                            {notif.jenis === 'disposisi_diperbarui' ? (
                              <Sparkles className="w-2.5 h-2.5" />
                            ) : (
                              <Send className="w-2.5 h-2.5" />
                            )}
                            <span>
                              {notif.jenis === 'disposisi_diperbarui'
                                ? 'Disposisi Diperbarui'
                                : 'Disposisi Baru'}
                            </span>
                          </span>

                          {notif.sifat !== 'Biasa' && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                SIFAT_BADGE_MAP[notif.sifat] || SIFAT_BADGE_MAP.Biasa
                              }`}
                            >
                              {notif.sifat}
                            </span>
                          )}

                          {deadlineBadge && (
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                DEADLINE_TONE_MAP[deadlineBadge.tone]
                              }`}
                            >
                              <Clock className="w-2.5 h-2.5" />
                              <span>{deadlineBadge.label}</span>
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          {notif.updatedAt || notif.createdAt}
                        </span>
                      </div>

                      {/* Letter Sender & Number */}
                      <div className="flex items-start gap-2 min-w-0">
                        <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {notif.asalSurat}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500 truncate">
                            {notif.nomorSurat}
                          </div>
                        </div>
                      </div>

                      {/* Subject */}
                      <div className="text-[11px] text-slate-700 font-medium line-clamp-2 leading-snug">
                        {notif.perihal}
                      </div>

                      {/* Disposition Instruction Preview */}
                      <div className="px-2.5 py-1.5 rounded-lg bg-slate-100/80 border border-slate-200/80 text-[11px] text-slate-700 line-clamp-2 leading-snug">
                        <span className="font-semibold text-purple-900">Arahan: </span>
                        {notif.instruksiDisposisi}
                      </div>

                      {/* Footer Meta & CTA */}
                      <div className="flex items-center justify-between gap-2 pt-0.5 text-[10px]">
                        <span className="inline-flex items-center gap-1 text-slate-500 truncate">
                          <UserCheck className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>Dari {notif.pengirimNama}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-blue-700 font-semibold shrink-0">
                          <span>Buka Surat</span>
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
