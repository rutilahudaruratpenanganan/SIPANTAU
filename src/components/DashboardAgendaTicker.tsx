import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronRight, Pause, Play } from 'lucide-react';
import { AgendaEvent } from '../types';
import {
  TodayRunningAgendaItem,
  formatAgendaTimeRange,
  formatIndonesianDateFull,
  getTodayActiveAndUpcomingAgendas,
  pad2,
} from '../utils/agendaLogic';

interface DashboardAgendaTickerProps {
  agendaList: AgendaEvent[];
  onOpenEvent: (event: AgendaEvent) => void;
  onOpenAgendaTab: () => void;
}

function getLocalNowInfo(): { todayIso: string; nowMinutes: number; clockLabel: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = pad2(now.getMonth() + 1);
  const d = pad2(now.getDate());
  const hh = pad2(now.getHours());
  const mm = pad2(now.getMinutes());
  return {
    todayIso: `${y}-${m}-${d}`,
    nowMinutes: now.getHours() * 60 + now.getMinutes(),
    clockLabel: `${hh}:${mm} WIB`,
  };
}

export const DashboardAgendaTicker: React.FC<DashboardAgendaTickerProps> = ({
  agendaList,
  onOpenEvent,
  onOpenAgendaTab,
}) => {
  const [nowInfo, setNowInfo] = useState(() => getLocalNowInfo());
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowInfo(getLocalNowInfo());
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const runningItems = useMemo(
    () => getTodayActiveAndUpcomingAgendas(agendaList, nowInfo.todayIso, nowInfo.nowMinutes),
    [agendaList, nowInfo.todayIso, nowInfo.nowMinutes]
  );

  const cancelledCount = useMemo(
    () => runningItems.filter((item) => item.status === 'dibatalkan').length,
    [runningItems]
  );
  const activeCount = runningItems.length - cancelledCount;

  const durationSeconds = Math.max(22, runningItems.length * 14);

  const renderAgendaSegment = (item: TodayRunningAgendaItem, isDuplicate: boolean) => {
    const { event, status } = item;
    const isCancelled = status === 'dibatalkan';
    const isRescheduled = !isCancelled && event.status === 'dijadwalkan_ulang';
    const pesertaText =
      event.pesertaNama.length > 0
        ? event.pesertaNama.length > 2
          ? `${event.pesertaNama.slice(0, 2).join(', ')} +${event.pesertaNama.length - 2}`
          : event.pesertaNama.join(', ')
        : event.pesertaTambahan || '-';

    return (
      <button
        key={`${isDuplicate ? 'dup' : 'main'}-${event.id}`}
        type="button"
        tabIndex={isDuplicate ? -1 : undefined}
        onClick={() => onOpenEvent(event)}
        data-status={status}
        className={`inline-flex items-center gap-2 text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:underline ${
          isCancelled
            ? 'text-slate-500 hover:text-rose-700'
            : 'text-slate-700 hover:text-blue-700'
        }`}
        title={`Klik untuk melihat detail agenda: ${event.judul}`}
      >
        <span
          className={`font-bold tracking-tight ${
            isCancelled
              ? 'text-rose-700'
              : status === 'sedang'
              ? 'text-emerald-700'
              : 'text-blue-700'
          }`}
        >
          {isCancelled
            ? 'DIBATALKAN'
            : status === 'sedang'
            ? 'SEDANG BERLANGSUNG'
            : 'AKAN BERJALAN'}
        </span>
        <span aria-hidden="true" className="text-slate-300">
          ·
        </span>
        <span
          className={`font-mono font-semibold tabular-nums ${
            isCancelled ? 'text-slate-500 line-through' : 'text-slate-900'
          }`}
        >
          {formatAgendaTimeRange(event)}
        </span>
        <span aria-hidden="true" className="text-slate-300">
          ·
        </span>
        <span
          className={`font-bold ${
            isCancelled ? 'text-slate-500 line-through' : 'text-slate-900'
          }`}
        >
          {event.judul}
        </span>
        {isRescheduled && (
          <>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span className="font-semibold text-amber-700">Jadwal Ulang</span>
          </>
        )}
        <span aria-hidden="true" className="text-slate-300">
          ·
        </span>
        <span className={isCancelled ? 'text-slate-500' : 'text-slate-600'}>
          Lokasi: {event.lokasi}
        </span>
        <span aria-hidden="true" className="text-slate-300">
          ·
        </span>
        <span className="text-slate-500">Peserta: {pesertaText}</span>
      </button>
    );
  };

  return (
    <section
      aria-label="Agenda Hari Ini yang Sedang, Akan Berjalan, dan Dibatalkan"
      data-testid="dashboard-agenda-ticker"
      data-active-count={runningItems.length}
      className="w-full max-w-full bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col sm:flex-row sm:items-stretch"
    >
      {/* Left Header Zone */}
      <div className="px-3.5 py-2 sm:py-2.5 bg-slate-900 text-white flex items-center justify-between sm:justify-start gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="text-xs font-bold tracking-tight whitespace-nowrap">
            Agenda Hari Ini
          </span>
          <span className="text-[11px] font-mono text-slate-300 tabular-nums whitespace-nowrap">
            {cancelledCount > 0
              ? `· ${activeCount} aktif · ${cancelledCount} batal`
              : `· ${runningItems.length} aktif/terjadwal`}
          </span>
        </div>
        <span className="sm:hidden text-[11px] font-mono text-slate-400 tabular-nums whitespace-nowrap">
          {nowInfo.clockLabel}
        </span>
      </div>

      {/* Center Running Text Viewport */}
      <div className="wasdal-ticker-viewport w-full sm:w-auto flex-1 min-w-0 max-w-full overflow-hidden bg-slate-50/70 px-3 sm:px-4 py-2 sm:py-2.5 flex items-center">
        {runningItems.length === 0 ? (
          <p className="text-xs text-slate-500 truncate">
            Tidak ada agenda yang sedang atau akan berjalan hari ini ({formatIndonesianDateFull(nowInfo.todayIso)}).
          </p>
        ) : (
          <div
            className="wasdal-ticker-track items-center"
            data-paused={isPaused ? 'true' : 'false'}
            style={{ ['--ticker-duration' as string]: `${durationSeconds}s` }}
          >
            <div className="flex items-center gap-6 pr-10">
              {runningItems.map((item, idx) => (
                <React.Fragment key={item.event.id}>
                  {idx > 0 && (
                    <span aria-hidden="true" className="text-slate-300 font-bold select-none">
                      |
                    </span>
                  )}
                  {renderAgendaSegment(item, false)}
                </React.Fragment>
              ))}
            </div>
            <div
              aria-hidden="true"
              className="wasdal-ticker-duplicate flex items-center gap-6 pr-10"
            >
              {runningItems.map((item, idx) => (
                <React.Fragment key={`dup-${item.event.id}`}>
                  {idx > 0 && (
                    <span aria-hidden="true" className="text-slate-300 font-bold select-none">
                      |
                    </span>
                  )}
                  {renderAgendaSegment(item, true)}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Controls Zone */}
      <div className="px-3 py-1.5 sm:py-2 border-t sm:border-t-0 sm:border-l border-slate-200 bg-white flex items-center justify-between sm:justify-end gap-2 shrink-0">
        {runningItems.length > 0 && (
          <button
            type="button"
            onClick={() => setIsPaused((prev) => !prev)}
            aria-label={isPaused ? 'Jalankan teks berjalan' : 'Jeda teks berjalan'}
            title={isPaused ? 'Jalankan teks berjalan' : 'Jeda teks berjalan'}
            className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>
        )}
        <button
          type="button"
          onClick={onOpenAgendaTab}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-blue-700 hover:text-blue-900 hover:bg-blue-50 transition-colors whitespace-nowrap shrink-0"
        >
          <span>Lihat Kalender</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </section>
  );
};
