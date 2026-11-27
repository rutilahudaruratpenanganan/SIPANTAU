import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BriefcaseBusiness,
  Check,
  Landmark,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import {
  JenisPelaksanaan,
  MekanismePencairan,
  PaketPekerjaan,
  Personel,
  RekeningAnggaran,
  SkemaKontrak,
  SkemaPembayaran,
  StatusPencairan,
  StatusTahapPekerjaan,
  TahapPekerjaan,
  TerminPekerjaan,
} from '../types';
import {
  PaketPekerjaanMutationPayload,
  RekeningAnggaranMutationPayload,
} from '../services/firestoreService';
import {
  JENIS_PELAKSANAAN_LIST,
  MAX_DURASI_HARI_KERJA,
  MAX_TAHUN_ANGGARAN,
  MAX_TERMIN_PEKERJAAN,
  MEKANISME_PENCAIRAN_LIST,
  MIN_TAHUN_ANGGARAN,
  SKEMA_KONTRAK_LIST,
  SKEMA_PEMBAYARAN_LIST,
  STATUS_PENCAIRAN_LIST,
  addCalendarDaysIso,
  buildDefaultTerminPencairan,
  buildRekeningUniqueKey,
  buildTemplateTahapan,
  createTahapId,
  createTerminId,
  filterRekeningByTahun,
  formatRupiah,
  formatTanggalDdMmYyyy,
  formatTanggalDisplay,
  getPaketDurasiHariKerja,
  getPaketTahunAnggaran,
  getTodayLocalIso,
  normalizeTahapanOrder,
  normalizeTerminOrder,
  parseRupiahInput,
  resolvePaketPaguInfo,
  resolvePaketTanggalSelesai,
  resolveStatusPencairanFromTermin,
  summarizeRekeningAnggaran,
  summarizeTerminPencairan,
  validatePaketPekerjaanInput,
  validateRekeningAnggaranInput,
} from '../utils/pekerjaanLogic';

interface ModalPaketPekerjaanProps {
  isOpen: boolean;
  onClose: () => void;
  initialPaket: PaketPekerjaan | null;
  personelList: Personel[];
  rekeningList: RekeningAnggaran[];
  paketList?: PaketPekerjaan[];
  onCreateRekening?: (
    payload: RekeningAnggaranMutationPayload
  ) => Promise<RekeningAnggaran>;
  onSave: (payload: PaketPekerjaanMutationPayload, editingId?: string) => Promise<void>;
  onDeletePaket?: (paketId: string) => Promise<void>;
}

export const ModalPaketPekerjaan: React.FC<ModalPaketPekerjaanProps> = ({
  isOpen,
  onClose,
  initialPaket,
  personelList,
  rekeningList,
  paketList = [],
  onCreateRekening,
  onSave,
  onDeletePaket,
}) => {
  const isEditing = Boolean(initialPaket);

  const [namaKegiatan, setNamaKegiatan] = useState('');
  const [subKegiatan, setSubKegiatan] = useState('');
  const [pekerjaan, setPekerjaan] = useState('');
  const [jenisPelaksanaan, setJenisPelaksanaan] = useState<JenisPelaksanaan>('Perorangan');
  const [skemaKontrak, setSkemaKontrak] = useState<SkemaKontrak | ''>('');
  const [tahunAnggaranText, setTahunAnggaranText] = useState<string>(() =>
    String(new Date().getFullYear())
  );
  const [nilaiAnggaran, setNilaiAnggaran] = useState<number>(0);
  const [nilaiAnggaranText, setNilaiAnggaranText] = useState<string>('');
  const [hps, setHps] = useState<number | undefined>(undefined);
  const [hpsText, setHpsText] = useState<string>('');
  const [nilaiKontrak, setNilaiKontrak] = useState<number | undefined>(undefined);
  const [nilaiKontrakText, setNilaiKontrakText] = useState<string>('');
  const [tanggalMulai, setTanggalMulai] = useState(getTodayLocalIso());
  const [durasiHariText, setDurasiHariText] = useState('30');
  const [skemaPembayaran, setSkemaPembayaran] = useState<SkemaPembayaran>('Sekaligus');
  const [terminPencairan, setTerminPencairan] = useState<TerminPekerjaan[]>([]);
  const [statusPencairan, setStatusPencairan] = useState<StatusPencairan>('Belum');
  const [tanggalPencairan, setTanggalPencairan] = useState<string>('');
  const [mekanismePencairan, setMekanismePencairan] = useState<MekanismePencairan | ''>('');
  const [kodeRup, setKodeRup] = useState('');
  const [nomorKontrak, setNomorKontrak] = useState('');
  const [penyedia, setPenyedia] = useState('');
  const [picNama, setPicNama] = useState('');
  const [catatan, setCatatan] = useState('');
  const [tahapan, setTahapan] = useState<TahapPekerjaan[]>(() =>
    buildTemplateTahapan('Perorangan')
  );
  const [hasCustomWorkflowEdit, setHasCustomWorkflowEdit] = useState(false);

  const [selectedRekeningId, setSelectedRekeningId] = useState<string>('');
  const [showInlineNewRekening, setShowInlineNewRekening] = useState(false);
  const [newRekKode, setNewRekKode] = useState('');
  const [newRekUraian, setNewRekUraian] = useState('');
  const [newRekTahunText, setNewRekTahunText] = useState<string>(() =>
    String(new Date().getFullYear())
  );
  const [newRekPagu, setNewRekPagu] = useState<number>(0);
  const [newRekPaguText, setNewRekPaguText] = useState('');
  const [inlineRekError, setInlineRekError] = useState('');
  const [isCreatingRek, setIsCreatingRek] = useState(false);
  const [justCreatedRekening, setJustCreatedRekening] = useState<RekeningAnggaran | null>(null);

  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (initialPaket) {
      const initSkemaBayar: SkemaPembayaran =
        initialPaket.skemaPembayaran === 'Termin' ||
        (Array.isArray(initialPaket.terminPencairan) && initialPaket.terminPencairan.length > 0)
          ? 'Termin'
          : 'Sekaligus';
      setNamaKegiatan(initialPaket.namaKegiatan);
      setSubKegiatan(initialPaket.subKegiatan);
      setPekerjaan(initialPaket.pekerjaan || '');
      setJenisPelaksanaan(initialPaket.jenisPelaksanaan);
      setSkemaKontrak(initialPaket.skemaKontrak || '');
      const matchedRek = resolvePaketPaguInfo(initialPaket, rekeningList).rekening;
      setSelectedRekeningId(matchedRek ? matchedRek.id : '');
      const effectiveTa = matchedRek
        ? matchedRek.tahunAnggaran
        : getPaketTahunAnggaran(initialPaket);
      const effectivePagu = matchedRek
        ? matchedRek.paguAnggaran
        : initialPaket.nilaiAnggaran || 0;
      setTahunAnggaranText(String(effectiveTa));
      setNilaiAnggaran(effectivePagu);
      setNilaiAnggaranText(
        effectivePagu > 0 ? effectivePagu.toLocaleString('id-ID') : '0'
      );
      setHps(initialPaket.hps);
      setHpsText(
        typeof initialPaket.hps === 'number'
          ? initialPaket.hps.toLocaleString('id-ID')
          : ''
      );
      setNilaiKontrak(initialPaket.nilaiKontrak);
      setNilaiKontrakText(
        typeof initialPaket.nilaiKontrak === 'number'
          ? initialPaket.nilaiKontrak.toLocaleString('id-ID')
          : ''
      );
      setTanggalMulai(initialPaket.tanggalMulai || getTodayLocalIso());
      setDurasiHariText(String(getPaketDurasiHariKerja(initialPaket)));
      setSkemaPembayaran(initSkemaBayar);
      setTerminPencairan(
        initSkemaBayar === 'Termin'
          ? normalizeTerminOrder(
              initialPaket.terminPencairan && initialPaket.terminPencairan.length > 0
                ? initialPaket.terminPencairan
                : buildDefaultTerminPencairan()
            )
          : []
      );
      setStatusPencairan(initialPaket.statusPencairan || 'Belum');
      setTanggalPencairan(initialPaket.tanggalPencairan || '');
      setMekanismePencairan(initialPaket.mekanismePencairan || '');
      setKodeRup(initialPaket.kodeRup || '');
      setNomorKontrak(initialPaket.nomorKontrak || '');
      setPenyedia(initialPaket.penyedia || '');
      setPicNama(initialPaket.picNama || '');
      setCatatan(initialPaket.catatan || '');
      setTahapan(
        initialPaket.tahapan.length > 0
          ? initialPaket.tahapan.map((t, i) => ({ ...t, urutan: i + 1 }))
          : buildTemplateTahapan(initialPaket.jenisPelaksanaan)
      );
      setHasCustomWorkflowEdit(true);
    } else {
      const today = getTodayLocalIso();
      setSelectedRekeningId('');
      setNamaKegiatan('');
      setSubKegiatan('');
      setPekerjaan('');
      setJenisPelaksanaan('Perorangan');
      setSkemaKontrak('');
      setTahunAnggaranText(today.slice(0, 4));
      setNilaiAnggaran(0);
      setNilaiAnggaranText('');
      setHps(undefined);
      setHpsText('');
      setNilaiKontrak(undefined);
      setNilaiKontrakText('');
      setTanggalMulai(today);
      setDurasiHariText('30');
      setSkemaPembayaran('Sekaligus');
      setTerminPencairan([]);
      setStatusPencairan('Belum');
      setTanggalPencairan('');
      setMekanismePencairan('');
      setKodeRup('');
      setNomorKontrak('');
      setPenyedia('');
      setPicNama('');
      setCatatan('');
      setTahapan(buildTemplateTahapan('Perorangan'));
      setHasCustomWorkflowEdit(false);
    }
    setShowInlineNewRekening(false);
    setNewRekKode('');
    setNewRekUraian('');
    setNewRekTahunText(String(new Date().getFullYear()));
    setNewRekPagu(0);
    setNewRekPaguText('');
    setInlineRekError('');
    setIsCreatingRek(false);
    setJustCreatedRekening(null);
    setErrorMessage('');
    setIsSaving(false);
    setConfirmDelete(false);
    setIsDeleting(false);
  }, [isOpen, initialPaket]);

  const effectiveRekeningList = useMemo(
    () =>
      justCreatedRekening && !rekeningList.some((r) => r.id === justCreatedRekening.id)
        ? [justCreatedRekening, ...rekeningList]
        : rekeningList,
    [rekeningList, justCreatedRekening]
  );

  const selectedRekening = useMemo(
    () => effectiveRekeningList.find((r) => r.id === selectedRekeningId) || null,
    [effectiveRekeningList, selectedRekeningId]
  );

  const trimmedTahunState = tahunAnggaranText.trim();
  const parsedTahunState = trimmedTahunState === '' ? NaN : Number(trimmedTahunState);
  const activeTahunFilter =
    Number.isInteger(parsedTahunState) &&
    parsedTahunState >= MIN_TAHUN_ANGGARAN &&
    parsedTahunState <= MAX_TAHUN_ANGGARAN
      ? parsedTahunState
      : undefined;

  const rekeningForActiveTa = useMemo(() => {
    const scoped = activeTahunFilter
      ? filterRekeningByTahun(effectiveRekeningList, activeTahunFilter)
      : effectiveRekeningList;
    if (
      selectedRekening &&
      !scoped.some((r) => r.id === selectedRekening.id)
    ) {
      return [selectedRekening, ...scoped];
    }
    return scoped;
  }, [effectiveRekeningList, activeTahunFilter, selectedRekening]);

  const copySourceRekeningOptions = useMemo(() => {
    const targetYr = Number(newRekTahunText.trim());
    const targetKeys = new Set(
      Number.isInteger(targetYr)
        ? effectiveRekeningList
            .filter((r) => r.tahunAnggaran === targetYr)
            .map((r) => buildRekeningUniqueKey(targetYr, r.kodeRekening))
        : []
    );
    return [...effectiveRekeningList]
      .filter(
        (r) =>
          !Number.isInteger(targetYr) ||
          !targetKeys.has(buildRekeningUniqueKey(targetYr, r.kodeRekening))
      )
      .sort((a, b) => {
        if (b.tahunAnggaran !== a.tahunAnggaran) return b.tahunAnggaran - a.tahunAnggaran;
        return a.kodeRekening.localeCompare(b.kodeRekening, 'id-ID');
      });
  }, [effectiveRekeningList, newRekTahunText]);

  const rekeningSummariesMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof summarizeRekeningAnggaran>[number]>();
    for (const s of summarizeRekeningAnggaran(effectiveRekeningList, paketList)) {
      map.set(s.rekening.id, s);
    }
    return map;
  }, [effectiveRekeningList, paketList]);

  const sharedRekeningUsage = useMemo(() => {
    if (!selectedRekening) return null;
    const otherPackets = paketList.filter(
      (p) =>
        p.id !== initialPaket?.id &&
        resolvePaketPaguInfo(p, effectiveRekeningList).rekening?.id === selectedRekening.id
    );
    const otherKontrakTotal = otherPackets.reduce(
      (sum, p) => sum + (typeof p.nilaiKontrak === 'number' ? p.nilaiKontrak : 0),
      0
    );
    const currentKontrak = typeof nilaiKontrak === 'number' ? nilaiKontrak : 0;
    const totalKontrak = otherKontrakTotal + currentKontrak;
    const sisaPagu = selectedRekening.paguAnggaran - totalKontrak;
    return {
      otherCount: otherPackets.length,
      otherKontrakTotal,
      totalKontrak,
      sisaPagu,
      isOverBudget: totalKontrak > selectedRekening.paguAnggaran,
    };
  }, [selectedRekening, paketList, effectiveRekeningList, initialPaket?.id, nilaiKontrak]);

  if (!isOpen) return null;

  const isLegacyUnlinkedEdit = Boolean(
    isEditing && initialPaket && !initialPaket.rekeningId && !selectedRekening
  );

  const handleTahunAnggaranChange = (nextRaw: string) => {
    setTahunAnggaranText(nextRaw);
    const parsed = Number(nextRaw.trim());
    if (
      selectedRekening &&
      Number.isInteger(parsed) &&
      parsed !== selectedRekening.tahunAnggaran
    ) {
      setSelectedRekeningId('');
      if (isEditing && initialPaket && !initialPaket.rekeningId) {
        const legacyPagu = initialPaket.nilaiAnggaran || 0;
        setNilaiAnggaran(legacyPagu);
        setNilaiAnggaranText(legacyPagu > 0 ? legacyPagu.toLocaleString('id-ID') : '0');
      } else {
        setNilaiAnggaran(0);
        setNilaiAnggaranText('');
      }
    }
    if (showInlineNewRekening && nextRaw.trim()) {
      setNewRekTahunText(nextRaw.trim());
    }
  };

  const handleSelectRekening = (nextId: string) => {
    setSelectedRekeningId(nextId);
    if (!nextId) {
      if (isEditing && initialPaket && !initialPaket.rekeningId) {
        const legacyPagu = initialPaket.nilaiAnggaran || 0;
        setNilaiAnggaran(legacyPagu);
        setNilaiAnggaranText(legacyPagu > 0 ? legacyPagu.toLocaleString('id-ID') : '0');
      } else {
        setNilaiAnggaran(0);
        setNilaiAnggaranText('');
      }
      return;
    }
    const found = effectiveRekeningList.find((r) => r.id === nextId);
    if (found) {
      setNilaiAnggaran(found.paguAnggaran);
      setNilaiAnggaranText(found.paguAnggaran.toLocaleString('id-ID'));
      setTahunAnggaranText(String(found.tahunAnggaran));
    }
  };

  const handleInlineCreateRekening = async () => {
    if (!onCreateRekening) return;
    const parsedTa = Number(newRekTahunText.trim());
    const validationErr = validateRekeningAnggaranInput(
      {
        kodeRekening: newRekKode,
        uraian: newRekUraian,
        tahunAnggaran: Number.isInteger(parsedTa) ? parsedTa : NaN,
        paguAnggaran: newRekPagu,
      },
      effectiveRekeningList
    );
    if (validationErr) {
      setInlineRekError(validationErr);
      return;
    }

    setInlineRekError('');
    setIsCreatingRek(true);
    try {
      const created = await onCreateRekening({
        kodeRekening: newRekKode.trim(),
        uraian: newRekUraian.trim(),
        tahunAnggaran: parsedTa,
        paguAnggaran: newRekPagu,
      });
      setJustCreatedRekening(created);
      setSelectedRekeningId(created.id);
      setNilaiAnggaran(created.paguAnggaran);
      setNilaiAnggaranText(created.paguAnggaran.toLocaleString('id-ID'));
      setTahunAnggaranText(String(created.tahunAnggaran));
      setShowInlineNewRekening(false);
      setNewRekKode('');
      setNewRekUraian('');
      setNewRekPagu(0);
      setNewRekPaguText('');
    } catch (err) {
      setInlineRekError(
        err instanceof Error ? err.message : 'Gagal membuat Kode Rekening baru.'
      );
    } finally {
      setIsCreatingRek(false);
    }
  };

  const handleChangeJenisPelaksanaan = (nextJenis: JenisPelaksanaan) => {
    setJenisPelaksanaan(nextJenis);
    // Automatically load the workflow template when selecting Jenis Pelaksanaan.
    // During editing, preserve existing stages only if the user already customized progress, unless they click reset or haven't edited yet.
    if (!isEditing || !hasCustomWorkflowEdit) {
      setTahapan(buildTemplateTahapan(nextJenis));
      setHasCustomWorkflowEdit(false);
    }
  };

  const handleResetTemplate = () => {
    setTahapan(buildTemplateTahapan(jenisPelaksanaan));
    setHasCustomWorkflowEdit(false);
  };

  const handleHpsInputChange = (raw: string) => {
    if (raw.trim() === '') {
      setHps(undefined);
      setHpsText('');
      return;
    }
    const parsed = parseRupiahInput(raw);
    setHps(parsed);
    setHpsText(parsed.toLocaleString('id-ID'));
  };

  const handleNilaiKontrakInputChange = (raw: string) => {
    if (raw.trim() === '') {
      setNilaiKontrak(undefined);
      setNilaiKontrakText('');
      return;
    }
    const parsed = parseRupiahInput(raw);
    setNilaiKontrak(parsed);
    setNilaiKontrakText(parsed.toLocaleString('id-ID'));
  };

  const handleChangeSkemaPembayaran = (next: SkemaPembayaran) => {
    setSkemaPembayaran(next);
    if (next === 'Termin' && terminPencairan.length === 0) {
      setTerminPencairan(buildDefaultTerminPencairan());
    }
  };

  const handleStatusPencairanSekaligusChange = (next: StatusPencairan) => {
    setStatusPencairan(next);
    if (next === 'Sudah') {
      setTanggalPencairan((prev) => prev || getTodayLocalIso());
    } else {
      setTanggalPencairan('');
    }
  };

  const handleTerminFieldChange = (
    id: string,
    patch: Partial<TerminPekerjaan>
  ) => {
    const today = getTodayLocalIso();
    setTerminPencairan((prev) =>
      prev.map((tr) => {
        if (tr.id !== id) return tr;
        const updated: TerminPekerjaan = { ...tr, ...patch };
        if (patch.status === 'Sudah' && !updated.tanggalCair) {
          updated.tanggalCair = today;
        } else if (patch.status === 'Belum') {
          updated.tanggalCair = undefined;
        }
        return updated;
      })
    );
  };

  const handleAddTermin = () => {
    if (terminPencairan.length >= MAX_TERMIN_PEKERJAAN) return;
    setTerminPencairan((prev) =>
      normalizeTerminOrder([
        ...prev,
        {
          id: createTerminId(prev.length + 1),
          urutan: prev.length + 1,
          nama: `Termin ${prev.length + 1}`,
          status: 'Belum',
        },
      ])
    );
  };

  const handleDeleteTermin = (id: string) => {
    if (terminPencairan.length <= 1) return;
    setTerminPencairan((prev) => normalizeTerminOrder(prev.filter((tr) => tr.id !== id)));
  };

  const handleStageNameChange = (id: string, nextName: string) => {
    setHasCustomWorkflowEdit(true);
    setTahapan((prev) => prev.map((t) => (t.id === id ? { ...t, nama: nextName } : t)));
  };

  const handleStageStatusChange = (id: string, nextStatus: StatusTahapPekerjaan) => {
    setHasCustomWorkflowEdit(true);
    const today = getTodayLocalIso();
    setTahapan((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        return {
          ...t,
          status: nextStatus,
          tanggalSelesai: nextStatus === 'selesai' ? t.tanggalSelesai || today : undefined,
        };
      })
    );
  };

  const handleStageTargetChange = (id: string, nextTarget: string) => {
    setHasCustomWorkflowEdit(true);
    setTahapan((prev) =>
      prev.map((t) => (t.id === id ? { ...t, tanggalTarget: nextTarget || undefined } : t))
    );
  };

  const handleMoveStage = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= tahapan.length) return;
    setHasCustomWorkflowEdit(true);
    setTahapan((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIdx];
      next[targetIdx] = temp;
      return normalizeTahapanOrder(next);
    });
  };

  const handleDeleteStage = (id: string) => {
    if (tahapan.length <= 1) return;
    setHasCustomWorkflowEdit(true);
    setTahapan((prev) => normalizeTahapanOrder(prev.filter((t) => t.id !== id)));
  };

  const handleAddStage = () => {
    if (tahapan.length >= 30) return;
    setHasCustomWorkflowEdit(true);
    setTahapan((prev) =>
      normalizeTahapanOrder([
        ...prev,
        {
          id: createTahapId(prev.length + 1),
          urutan: prev.length + 1,
          nama: `Tahapan Tambahan ${prev.length + 1}`,
          status: 'belum_mulai',
        },
      ])
    );
  };

  const trimmedTahun = tahunAnggaranText.trim();
  const parsedTahunNumber = trimmedTahun === '' ? NaN : Number(trimmedTahun);
  const tahunAnggaran =
    Number.isInteger(parsedTahunNumber) ? parsedTahunNumber : NaN;

  const trimmedDurasi = durasiHariText.trim();
  const parsedDurasiNumber = trimmedDurasi === '' ? NaN : Number(trimmedDurasi);
  const durasiHariKerja =
    Number.isInteger(parsedDurasiNumber) && parsedDurasiNumber >= 1
      ? parsedDurasiNumber
      : NaN;
  const computedTanggalSelesai = Number.isInteger(durasiHariKerja)
    ? addCalendarDaysIso(tanggalMulai, durasiHariKerja)
    : '';

  const currentYear = new Date().getFullYear();
  const presetYears = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  const handleDeleteCurrent = async () => {
    if (!initialPaket || !onDeletePaket) return;
    setErrorMessage('');
    setIsDeleting(true);
    try {
      await onDeletePaket(initialPaket.id);
      onClose();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Gagal menghapus paket pekerjaan.'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const terminSummary = summarizeTerminPencairan({
    skemaPembayaran,
    statusPencairan,
    terminPencairan,
    nilaiKontrak,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedTahapan = normalizeTahapanOrder(tahapan);
    const cleanedTermins =
      skemaPembayaran === 'Termin' ? normalizeTerminOrder(terminPencairan) : undefined;
    const resolvedStatusPencairan = resolveStatusPencairanFromTermin(
      skemaPembayaran,
      statusPencairan,
      cleanedTermins
    );
    const resolvedTanggalSelesai = resolvePaketTanggalSelesai(
      cleanedTahapan,
      initialPaket?.tanggalSelesai,
      getTodayLocalIso()
    );
    const legacyAllowedWithoutRekening = Boolean(
      isEditing && initialPaket && !initialPaket.rekeningId
    );
    const effectiveTahunAnggaran = selectedRekening
      ? selectedRekening.tahunAnggaran
      : tahunAnggaran;
    const effectiveNilaiAnggaran = selectedRekening
      ? selectedRekening.paguAnggaran
      : nilaiAnggaran;

    const validationErr = validatePaketPekerjaanInput({
      rekeningId: selectedRekening ? selectedRekening.id : undefined,
      matchedRekening: selectedRekening,
      requireRekening: !legacyAllowedWithoutRekening,
      namaKegiatan,
      subKegiatan,
      jenisPelaksanaan,
      skemaKontrak: skemaKontrak || undefined,
      tahunAnggaran: effectiveTahunAnggaran,
      nilaiAnggaran: effectiveNilaiAnggaran,
      hps,
      nilaiKontrak,
      tanggalMulai,
      durasiHariKerja,
      tenggatWaktu: computedTanggalSelesai,
      tanggalSelesai: resolvedTanggalSelesai,
      skemaPembayaran,
      terminPencairan: cleanedTermins,
      statusPencairan: resolvedStatusPencairan,
      tanggalPencairan:
        skemaPembayaran === 'Sekaligus' ? tanggalPencairan.trim() || undefined : undefined,
      mekanismePencairan: mekanismePencairan || undefined,
      tahapan: cleanedTahapan,
    });

    if (validationErr) {
      setErrorMessage(validationErr);
      return;
    }

    setErrorMessage('');
    setIsSaving(true);
    try {
      await onSave(
        {
          rekeningId: selectedRekening ? selectedRekening.id : undefined,
          kodeRekening: selectedRekening ? selectedRekening.kodeRekening : undefined,
          namaRekening: selectedRekening ? selectedRekening.uraian : undefined,
          namaKegiatan: namaKegiatan.trim(),
          subKegiatan: subKegiatan.trim(),
          pekerjaan: pekerjaan.trim() || undefined,
          jenisPelaksanaan,
          skemaKontrak: skemaKontrak || undefined,
          tahunAnggaran: effectiveTahunAnggaran,
          nilaiAnggaran: effectiveNilaiAnggaran,
          hps,
          nilaiKontrak,
          tanggalMulai: tanggalMulai.trim(),
          durasiHariKerja,
          tenggatWaktu: computedTanggalSelesai,
          tanggalSelesai: resolvedTanggalSelesai,
          skemaPembayaran,
          terminPencairan: cleanedTermins,
          statusPencairan: resolvedStatusPencairan,
          tanggalPencairan:
            skemaPembayaran === 'Sekaligus' ? tanggalPencairan.trim() || undefined : undefined,
          mekanismePencairan: mekanismePencairan || undefined,
          kodeRup: kodeRup.trim() || undefined,
          nomorKontrak: nomorKontrak.trim() || undefined,
          penyedia: penyedia.trim() || undefined,
          picNama: picNama.trim() || undefined,
          catatan: catatan.trim() || undefined,
          tahapan: cleanedTahapan,
        },
        initialPaket?.id
      );
      onClose();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Gagal menyimpan paket pekerjaan ke database.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-paket-title"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0">
              <BriefcaseBusiness className="w-4 h-4 text-indigo-300" />
            </div>
            <div className="min-w-0">
              <h2 id="modal-paket-title" className="text-sm sm:text-base font-bold truncate">
                {isEditing ? 'Edit Keseluruhan Paket Pekerjaan' : 'Tambah Paket Pekerjaan Baru'}
              </h2>
              <p className="text-[11px] text-slate-300 truncate">
                Atur identitas kegiatan, anggaran, jadwal pelaksanaan, dan tahapan kerja
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup form paket pekerjaan"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {errorMessage && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          {/* Section 1: Identitas Paket Pekerjaan */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-900 border-b border-slate-200 pb-2">
              1. Informasi Paket Pekerjaan
            </h3>

            {/* Pemilih Tahun Anggaran, Kode Rekening & 1 Pagu Anggaran */}
            <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-emerald-700 shrink-0" />
                  <div>
                    <div className="font-bold text-slate-900">
                      Tahun Anggaran, Kode Rekening &amp; Pagu Anggaran (1 Rekening per TA = 1 Pagu)
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Kode Rekening &amp; Pagu berlaku per Tahun Anggaran DPA. Pagu kegiatan otomatis terkunci sesuai Kode Rekening TA terpilih.
                    </p>
                  </div>
                </div>
                {onCreateRekening && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowInlineNewRekening((v) => !v);
                      setInlineRekError('');
                      setNewRekTahunText(
                        tahunAnggaranText || String(new Date().getFullYear())
                      );
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-800 text-[11px] font-semibold transition-colors whitespace-nowrap self-start sm:self-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>
                      {showInlineNewRekening
                        ? 'Tutup Form Rekening'
                        : 'Input Kode Rekening Baru'}
                    </span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-3">
                  <label
                    htmlFor="paket-tahun-anggaran"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    Tahun Anggaran <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono font-semibold text-[11px]">
                      TA
                    </span>
                    <input
                      id="paket-tahun-anggaran"
                      type="number"
                      min={MIN_TAHUN_ANGGARAN}
                      max={MAX_TAHUN_ANGGARAN}
                      step={1}
                      list="tahun-anggaran-presets"
                      required
                      value={tahunAnggaranText}
                      onChange={(e) => handleTahunAnggaranChange(e.target.value)}
                      placeholder={String(currentYear)}
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-white font-mono font-semibold tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                    />
                    <datalist id="tahun-anggaran-presets">
                      {Array.from(
                        new Set([
                          ...presetYears,
                          ...effectiveRekeningList.map((r) => r.tahunAnggaran),
                        ])
                      )
                        .sort((a, b) => b - a)
                        .map((yr) => (
                          <option key={yr} value={yr} />
                        ))}
                    </datalist>
                  </div>
                </div>

                <div className="sm:col-span-9">
                  <label
                    htmlFor="paket-kode-rekening"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    Kode Rekening (TA {activeTahunFilter ?? (tahunAnggaranText || currentYear)}){' '}
                    {!isLegacyUnlinkedEdit && <span className="text-rose-600">*</span>}
                  </label>
                  <select
                    id="paket-kode-rekening"
                    value={selectedRekeningId}
                    onChange={(e) => handleSelectRekening(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="">
                      {rekeningForActiveTa.length > 0
                        ? `-- Pilih Kode Rekening TA ${activeTahunFilter ?? tahunAnggaranText} (${rekeningForActiveTa.length} tersedia) --`
                        : `-- Belum ada Kode Rekening untuk TA ${activeTahunFilter ?? tahunAnggaranText} --`}
                    </option>
                    {rekeningForActiveTa.map((rek) => {
                      const sum = rekeningSummariesMap.get(rek.id);
                      const sisaLabel = sum
                        ? `Sisa ${sum.isOverBudget ? '-' : ''}${formatRupiah(Math.abs(sum.sisaPagu))}`
                        : '';
                      return (
                        <option key={rek.id} value={rek.id}>
                          {rek.kodeRekening} — {rek.uraian} (TA {rek.tahunAnggaran} · Pagu{' '}
                          {formatRupiah(rek.paguAnggaran)}
                          {sum ? ` · ${sum.jumlahPaket} keg · ${sisaLabel}` : ''})
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {rekeningForActiveTa.length === 0 && !showInlineNewRekening && (
                <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/90 text-amber-900 text-[11px] flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Belum ada master Kode Rekening untuk{' '}
                    <strong>TA {activeTahunFilter ?? tahunAnggaranText}</strong>.{' '}
                    {effectiveRekeningList.length > 0
                      ? 'Tambahkan kode rekening TA ini (bisa menyalin kode & uraian dari TA sebelumnya).'
                      : 'Tambahkan Kode Rekening terlebih dahulu agar Pagu Anggaran terisi otomatis.'}
                  </span>
                  {onCreateRekening && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowInlineNewRekening(true);
                        setInlineRekError('');
                        setNewRekTahunText(
                          tahunAnggaranText || String(new Date().getFullYear())
                        );
                      }}
                      className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shrink-0"
                    >
                      + Buat Rekening TA {activeTahunFilter ?? tahunAnggaranText}
                    </button>
                  )}
                </div>
              )}

              {isLegacyUnlinkedEdit && (
                <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-[11px]">
                  Data kegiatan ini belum tertaut ke Master Kode Rekening. Pilih atau buat Kode Rekening di atas untuk menyinkronkan Pagu Anggaran tahunan.
                </div>
              )}

              {selectedRekening && sharedRekeningUsage && (
                <div
                  className={`p-2.5 rounded-lg border text-[11px] space-y-1 ${
                    sharedRekeningUsage.isOverBudget
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : 'bg-white border-emerald-200 text-slate-700'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">
                      <span className="font-mono">{selectedRekening.kodeRekening}</span> ·{' '}
                      {selectedRekening.uraian} (TA {selectedRekening.tahunAnggaran})
                    </span>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      Pagu Rekening (1x): {formatRupiah(selectedRekening.paguAnggaran)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 tabular-nums">
                    <span>
                      Kegiatan lain pada rekening ini:{' '}
                      <strong>{sharedRekeningUsage.otherCount}</strong> (Kontrak{' '}
                      {formatRupiah(sharedRekeningUsage.otherKontrakTotal)})
                    </span>
                    <span>·</span>
                    <span
                      className={`font-semibold ${
                        sharedRekeningUsage.isOverBudget ? 'text-rose-700' : 'text-emerald-700'
                      }`}
                    >
                      Sisa Pagu setelah kegiatan ini:{' '}
                      {sharedRekeningUsage.isOverBudget ? '-' : ''}
                      {formatRupiah(Math.abs(sharedRekeningUsage.sisaPagu))}
                    </span>
                  </div>
                  {sharedRekeningUsage.isOverBudget && (
                    <div className="flex items-center gap-1.5 text-rose-700 font-semibold pt-0.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Perhatian: Akumulasi nilai kontrak melebihi pagu anggaran kode rekening ini.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {showInlineNewRekening && onCreateRekening && (
                <div
                  data-testid="inline-rekening-form"
                  className="p-3 rounded-xl border border-emerald-300 bg-white space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="font-bold text-slate-900 text-[11px]">
                      Tambah Master Kode Rekening Baru (Berlaku TA {newRekTahunText || currentYear})
                    </div>
                    {copySourceRekeningOptions.length > 0 && (
                      <select
                        id="inline-rek-copy-source"
                        aria-label="Salin kode dan uraian dari tahun sebelumnya"
                        defaultValue=""
                        onChange={(e) => {
                          const src = effectiveRekeningList.find(
                            (r) => r.id === e.target.value
                          );
                          if (src) {
                            setNewRekKode(src.kodeRekening);
                            setNewRekUraian(src.uraian);
                          }
                        }}
                        className="px-2 py-1 rounded-md border border-indigo-200 bg-indigo-50/70 text-[11px] font-medium text-indigo-900"
                      >
                        <option value="">
                          Salin kode &amp; uraian dari TA lain (Opsional)...
                        </option>
                        {copySourceRekeningOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            [TA {opt.tahunAnggaran}] {opt.kodeRekening} — {opt.uraian}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  {inlineRekError && (
                    <div
                      role="alert"
                      className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-medium"
                    >
                      {inlineRekError}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                    <div className="sm:col-span-4">
                      <label
                        htmlFor="inline-rek-kode"
                        className="block text-[11px] font-semibold text-slate-700 mb-1"
                      >
                        Kode Rekening *
                      </label>
                      <input
                        id="inline-rek-kode"
                        type="text"
                        maxLength={100}
                        value={newRekKode}
                        onChange={(e) => setNewRekKode(e.target.value)}
                        placeholder="5.1.02.02.01.0029"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono text-slate-900"
                      />
                    </div>
                    <div className="sm:col-span-5">
                      <label
                        htmlFor="inline-rek-uraian"
                        className="block text-[11px] font-semibold text-slate-700 mb-1"
                      >
                        Uraian Rekening *
                      </label>
                      <input
                        id="inline-rek-uraian"
                        type="text"
                        maxLength={300}
                        value={newRekUraian}
                        onChange={(e) => setNewRekUraian(e.target.value)}
                        placeholder="Belanja Jasa Konsultansi..."
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-900"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label
                        htmlFor="inline-rek-tahun"
                        className="block text-[11px] font-semibold text-slate-700 mb-1"
                      >
                        Tahun *
                      </label>
                      <input
                        id="inline-rek-tahun"
                        type="number"
                        min={MIN_TAHUN_ANGGARAN}
                        max={MAX_TAHUN_ANGGARAN}
                        value={newRekTahunText}
                        onChange={(e) => setNewRekTahunText(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono tabular-nums text-slate-900"
                      />
                    </div>
                    <div className="sm:col-span-7">
                      <label
                        htmlFor="inline-rek-pagu"
                        className="block text-[11px] font-semibold text-slate-700 mb-1"
                      >
                        Pagu Anggaran (Rp) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono font-semibold text-[11px]">
                          Rp
                        </span>
                        <input
                          id="inline-rek-pagu"
                          type="text"
                          inputMode="numeric"
                          value={newRekPaguText}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw.trim() === '') {
                              setNewRekPagu(0);
                              setNewRekPaguText('');
                              return;
                            }
                            const parsed = parseRupiahInput(raw);
                            setNewRekPagu(parsed);
                            setNewRekPaguText(parsed.toLocaleString('id-ID'));
                          }}
                          placeholder="0"
                          className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-300 font-mono tabular-nums text-slate-900"
                        />
                      </div>
                    </div>
                    <div className="sm:col-span-5 flex items-end justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowInlineNewRekening(false)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={handleInlineCreateRekening}
                        disabled={isCreatingRek}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>
                          {isCreatingRek ? 'Menyimpan...' : 'Simpan & Pilih Rekening'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="paket-nama-kegiatan"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Nama Kegiatan <span className="text-rose-600">*</span>
                </label>
                <input
                  id="paket-nama-kegiatan"
                  type="text"
                  required
                  value={namaKegiatan}
                  onChange={(e) => setNamaKegiatan(e.target.value)}
                  placeholder="Contoh: Pengawasan & Pengendalian Perumahan"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="paket-sub-kegiatan"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Sub Kegiatan <span className="text-rose-600">*</span>
                </label>
                <input
                  id="paket-sub-kegiatan"
                  type="text"
                  required
                  value={subKegiatan}
                  onChange={(e) => setSubKegiatan(e.target.value)}
                  placeholder="Contoh: Kajian Teknis Kelaikan Bangunan"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-slate-900"
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="paket-pekerjaan"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Pekerjaan
                </label>
                <input
                  id="paket-pekerjaan"
                  type="text"
                  maxLength={300}
                  value={pekerjaan}
                  onChange={(e) => setPekerjaan(e.target.value)}
                  placeholder="Contoh: Pengawasan Teknis Pembangunan Perumahan Wilayah Timur"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="paket-jenis-pelaksanaan"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Jenis Pelaksanaan <span className="text-rose-600">*</span>
                </label>
                <select
                  id="paket-jenis-pelaksanaan"
                  value={jenisPelaksanaan}
                  onChange={(e) =>
                    handleChangeJenisPelaksanaan(e.target.value as JenisPelaksanaan)
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-slate-900 font-medium"
                >
                  {JENIS_PELAKSANAAN_LIST.map((jenis) => (
                    <option key={jenis} value={jenis}>
                      {jenis}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Otomatis memuat template tahapan.
                </p>
              </div>

              <div>
                <label
                  htmlFor="paket-skema-kontrak"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Skema Kontrak
                </label>
                <select
                  id="paket-skema-kontrak"
                  value={skemaKontrak}
                  onChange={(e) => setSkemaKontrak(e.target.value as SkemaKontrak | '')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-slate-900 font-medium"
                >
                  <option value="">-- Pilih Skema Kontrak --</option>
                  {SKEMA_KONTRAK_LIST.map((skema) => (
                    <option key={skema} value={skema}>
                      {skema}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Lump Sum, Waktu Penugasan, Pengadaan Langsung, atau Katalog.
                </p>
              </div>

              <div>
                <label
                  htmlFor="paket-mekanisme-pencairan"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Mekanisme Pencairan
                </label>
                <select
                  id="paket-mekanisme-pencairan"
                  value={mekanismePencairan}
                  onChange={(e) =>
                    setMekanismePencairan(e.target.value as MekanismePencairan | '')
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-slate-900 font-medium"
                >
                  <option value="">-- Pilih Mekanisme --</option>
                  {MEKANISME_PENCAIRAN_LIST.map((mek) => (
                    <option key={mek} value={mek}>
                      {mek}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  LS, GU, atau TU.
                </p>
              </div>
            </div>

            {/* Pilihan di awal input: Pembayaran Sekaligus vs Termin */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="font-semibold text-slate-800">
                  Skema Pembayaran Pencairan <span className="text-rose-600">*</span>
                </span>
                <span className="text-[11px] text-slate-500">
                  Tentukan apakah pekerjaan dibayar sekaligus atau dalam beberapa termin
                </span>
              </div>
              <div
                role="radiogroup"
                aria-label="Skema Pembayaran Pencairan"
                className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
              >
                {SKEMA_PEMBAYARAN_LIST.map((mode) => {
                  const selected = skemaPembayaran === mode;
                  const title =
                    mode === 'Sekaligus'
                      ? 'Pembayaran Sekaligus (Tanpa Termin)'
                      : 'Pembayaran Bertahap (Beberapa Termin)';
                  const desc =
                    mode === 'Sekaligus'
                      ? 'Satu status pencairan penuh (Belum / Sudah Cair).'
                      : 'Atur beberapa termin pembayaran beserta progres cair per termin.';
                  return (
                    <button
                      key={mode}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => handleChangeSkemaPembayaran(mode)}
                      className={`text-left p-3 rounded-xl border transition-all flex items-start gap-2.5 ${
                        selected
                          ? 'bg-blue-50/70 border-blue-600 ring-1 ring-blue-600 text-slate-900'
                          : 'bg-white border-slate-300 hover:border-slate-400 text-slate-700'
                      }`}
                    >
                      <span
                        className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          selected ? 'border-blue-600 bg-blue-600' : 'border-slate-400 bg-white'
                        }`}
                      >
                        {selected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-900">{title}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="paket-nilai-anggaran"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Pagu Anggaran {selectedRekening ? 'Rekening (1x)' : '(Sesuai Kode Rekening)'}{' '}
                  <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono font-semibold">
                    Rp
                  </span>
                  <input
                    id="paket-nilai-anggaran"
                    type="text"
                    inputMode="numeric"
                    readOnly
                    aria-readonly="true"
                    value={
                      selectedRekening
                        ? selectedRekening.paguAnggaran.toLocaleString('id-ID')
                        : isLegacyUnlinkedEdit
                        ? nilaiAnggaranText
                        : ''
                    }
                    placeholder={
                      selectedRekening || isLegacyUnlinkedEdit
                        ? '0'
                        : 'Pilih Kode Rekening terlebih dahulu'
                    }
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-slate-100 text-slate-800 font-semibold font-mono tabular-nums cursor-not-allowed focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1 font-mono tabular-nums">
                  {selectedRekening
                    ? `Terkunci sesuai ${selectedRekening.kodeRekening} (TA ${selectedRekening.tahunAnggaran}): ${formatRupiah(selectedRekening.paguAnggaran)}`
                    : isLegacyUnlinkedEdit
                    ? `Pagu data lama: ${formatRupiah(nilaiAnggaran)} (pilih Kode Rekening untuk sinkronisasi TA)`
                    : 'Otomatis terisi & terkunci sesuai Kode Rekening TA terpilih'}
                </p>
              </div>

              <div>
                <label
                  htmlFor="paket-hps"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Harga Perkiraan Sendiri / HPS (Rp)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono font-semibold">
                    Rp
                  </span>
                  <input
                    id="paket-hps"
                    type="text"
                    inputMode="numeric"
                    value={hpsText}
                    onChange={(e) => handleHpsInputChange(e.target.value)}
                    placeholder="0"
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-slate-900"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1 font-mono tabular-nums">
                  {hps !== undefined
                    ? `Terbaca: ${formatRupiah(hps)}`
                    : 'Opsional (Rp)'}
                </p>
              </div>

              <div>
                <label
                  htmlFor="paket-nilai-kontrak"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Nilai Kontrak / Realisasi (Rp)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono font-semibold">
                    Rp
                  </span>
                  <input
                    id="paket-nilai-kontrak"
                    type="text"
                    inputMode="numeric"
                    value={nilaiKontrakText}
                    onChange={(e) => handleNilaiKontrakInputChange(e.target.value)}
                    placeholder="0"
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-slate-900"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1 font-mono tabular-nums">
                  {nilaiKontrak !== undefined
                    ? `Terbaca: ${formatRupiah(nilaiKontrak)}`
                    : 'Opsional (Rp)'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="paket-tanggal-mulai"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Tanggal Mulai <span className="text-rose-600">*</span>
                </label>
                <input
                  id="paket-tanggal-mulai"
                  type="date"
                  required
                  value={tanggalMulai}
                  onChange={(e) => setTanggalMulai(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
                />
                <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
                  {tanggalMulai
                    ? `${formatTanggalDisplay(tanggalMulai)} (${formatTanggalDdMmYyyy(tanggalMulai)})`
                    : 'Format DD-MM-YYYY'}
                </p>
              </div>

              <div>
                <label
                  htmlFor="paket-durasi-hari"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Durasi (Hari Kalender) <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <input
                    id="paket-durasi-hari"
                    type="number"
                    min={1}
                    max={MAX_DURASI_HARI_KERJA}
                    step={1}
                    required
                    value={durasiHariText}
                    onChange={(e) => setDurasiHariText(e.target.value)}
                    placeholder="30"
                    className="w-full pl-3 pr-24 py-2 rounded-lg border border-slate-300 font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-slate-500 pointer-events-none">
                    hari kalender
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Tanggal Mulai dihitung sebagai hari ke-1 (Senin–Minggu)
                </p>
              </div>

              <div>
                <label
                  htmlFor="paket-tanggal-selesai"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Tanggal Selesai <span className="text-slate-400 font-normal">(Otomatis)</span>
                </label>
                <input
                  id="paket-tanggal-selesai"
                  type="text"
                  readOnly
                  aria-readonly="true"
                  value={computedTanggalSelesai ? formatTanggalDisplay(computedTanggalSelesai) : '-'}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-100 font-semibold tabular-nums text-slate-800 cursor-not-allowed focus:outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
                  {computedTanggalSelesai
                    ? `DD-MM-YYYY: ${formatTanggalDdMmYyyy(computedTanggalSelesai)}`
                    : 'Otomatis: Tanggal Mulai (hari ke-1) + Durasi'}
                </p>
              </div>
            </div>


            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label
                  htmlFor="paket-kode-rup"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Kode RUP
                </label>
                <input
                  id="paket-kode-rup"
                  type="text"
                  maxLength={100}
                  value={kodeRup}
                  onChange={(e) => setKodeRup(e.target.value)}
                  placeholder="Contoh: 51234567"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="paket-nomor-kontrak"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Nomor Kontrak / SPK
                </label>
                <input
                  id="paket-nomor-kontrak"
                  type="text"
                  value={nomorKontrak}
                  onChange={(e) => setNomorKontrak(e.target.value)}
                  placeholder="Opsional"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="paket-penyedia"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Penyedia / Pelaksana
                </label>
                <input
                  id="paket-penyedia"
                  type="text"
                  value={penyedia}
                  onChange={(e) => setPenyedia(e.target.value)}
                  placeholder="Nama konsultan / badan usaha / tim"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="paket-pic"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Penanggung Jawab (PIC)
                </label>
                <select
                  id="paket-pic"
                  value={picNama}
                  onChange={(e) => setPicNama(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
                >
                  <option value="">-- Pilih Personel PIC --</option>
                  {personelList.map((p) => (
                    <option key={p.id} value={p.nama}>
                      {p.nama}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Template Tahapan Otomatis & Custom Workflow */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div>
                <h3 className="text-xs font-bold text-slate-900">
                  2. Alur Tahapan Pekerjaan ({tahapan.length} Tahap)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Otomatis terisi sesuai jenis pelaksanaan{' '}
                  <span className="font-semibold text-slate-700">{jenisPelaksanaan}</span> · Tetap
                  dapat diubah, ditambah, diurutkan, atau dihapus secara manual.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleResetTemplate}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition-colors whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Muat Template {jenisPelaksanaan}</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddStage}
                  disabled={tahapan.length >= 30}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Tahapan</span>
                </button>
              </div>
            </div>

            {/* Tahapan Pencairan dalam Alur Tahapan Pekerjaan */}
            {skemaPembayaran === 'Sekaligus' ? (
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div>
                  <label
                    htmlFor="paket-status-pencairan"
                    className="block font-semibold text-slate-800"
                  >
                    Tahapan Pencairan (Pembayaran Sekaligus)
                  </label>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Status dan tanggal pencairan anggaran penuh sebagai bagian dari alur tahapan pekerjaan.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full lg:w-auto shrink-0">
                  <div className="sm:w-36">
                    <label
                      htmlFor="paket-status-pencairan"
                      className="block text-[10px] font-semibold text-slate-600 mb-1"
                    >
                      Status Pencairan
                    </label>
                    <select
                      id="paket-status-pencairan"
                      value={statusPencairan}
                      onChange={(e) =>
                        handleStatusPencairanSekaligusChange(e.target.value as StatusPencairan)
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 font-medium"
                    >
                      {STATUS_PENCAIRAN_LIST.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:w-44">
                    <label
                      htmlFor="paket-tanggal-pencairan"
                      className="block text-[10px] font-semibold text-slate-600 mb-1"
                    >
                      Tanggal Pencairan
                    </label>
                    <input
                      id="paket-tanggal-pencairan"
                      type="date"
                      value={tanggalPencairan}
                      onChange={(e) => setTanggalPencairan(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
                    />
                    {tanggalPencairan && (
                      <p className="text-[10px] text-emerald-700 mt-0.5 tabular-nums">
                        {formatTanggalDisplay(tanggalPencairan)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-3"
                data-testid="termin-pencairan-editor"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-900">
                      Daftar Termin Pencairan ({terminPencairan.length} Termin)
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5 tabular-nums">
                      Status gabungan:{' '}
                      <span className="font-semibold text-indigo-800">
                        {terminSummary.summaryLabel}
                      </span>{' '}
                      · Akumulasi cair {terminSummary.totalPersenCair}%
                      {terminSummary.sudahCount > 0 && terminSummary.hasNominalCair && (
                        <>
                          {' '}
                          ·{' '}
                          <span className="font-mono font-bold text-emerald-700">
                            Sudah Dibayar: {formatRupiah(terminSummary.totalNilaiCair)}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddTermin}
                    disabled={terminPencairan.length >= MAX_TERMIN_PEKERJAAN}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 text-white text-[11px] font-semibold transition-colors whitespace-nowrap self-start sm:self-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Termin</span>
                  </button>
                </div>

                <div className="hidden lg:flex items-center gap-2 px-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  <div className="flex-1 min-w-0 pl-8">Nama Termin</div>
                  <div className="w-[68px] text-center">Persen</div>
                  <div className="w-[136px]">Nilai (Rp)</div>
                  <div className="w-[92px]">Status</div>
                  <div className="w-[142px]">Tanggal Pencairan</div>
                  <div className="w-[30px]" />
                </div>

                <div className="space-y-2">
                  {terminPencairan.map((tr, idx) => (
                    <div
                      key={tr.id}
                      data-testid={`termin-row-${idx}`}
                      className="p-2.5 rounded-xl border border-slate-200 bg-white grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-center gap-2"
                    >
                      <div className="sm:col-span-2 lg:flex-1 flex items-center gap-2 min-w-0">
                        <span className="w-6 h-6 rounded-md bg-indigo-700 text-white font-mono font-bold text-[11px] flex items-center justify-center shrink-0 tabular-nums">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          aria-label={`Nama Termin ${idx + 1}`}
                          value={tr.nama}
                          onChange={(e) =>
                            handleTerminFieldChange(tr.id, { nama: e.target.value })
                          }
                          placeholder={`Termin ${idx + 1}`}
                          className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>

                      <div className="lg:w-[68px] shrink-0">
                        <div className="relative">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            aria-label={`Persentase Termin ${idx + 1}`}
                            value={tr.persentase ?? ''}
                            onChange={(e) => {
                              const val = e.target.value.trim();
                              handleTerminFieldChange(tr.id, {
                                persentase: val === '' ? undefined : Number(val),
                              });
                            }}
                            placeholder="%"
                            className="w-full pl-2 pr-5 py-1.5 rounded-lg border border-slate-300 font-mono tabular-nums text-[11px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                          />
                          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">
                            %
                          </span>
                        </div>
                      </div>

                      <div className="lg:w-[136px] shrink-0">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400 pointer-events-none">
                            Rp
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            aria-label={`Nilai Rupiah Termin ${idx + 1}`}
                            value={
                              typeof tr.nilaiRupiah === 'number'
                                ? tr.nilaiRupiah.toLocaleString('id-ID')
                                : ''
                            }
                            onChange={(e) => {
                              const raw = e.target.value.trim();
                              handleTerminFieldChange(tr.id, {
                                nilaiRupiah: raw === '' ? undefined : parseRupiahInput(raw),
                              });
                            }}
                            placeholder="Nilai Rp"
                            className="w-full pl-7 pr-2 py-1.5 rounded-lg border border-slate-300 font-mono tabular-nums text-[11px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                          />
                        </div>
                      </div>

                      <div className="lg:w-[92px] shrink-0">
                        <select
                          aria-label={`Status Termin ${idx + 1}`}
                          value={tr.status}
                          onChange={(e) =>
                            handleTerminFieldChange(tr.id, {
                              status: e.target.value as StatusPencairan,
                            })
                          }
                          className={`w-full px-2 py-1.5 rounded-lg border text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                            tr.status === 'Sudah'
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                              : 'border-slate-300 bg-white text-slate-800'
                          }`}
                        >
                          {STATUS_PENCAIRAN_LIST.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="lg:w-[142px] shrink-0">
                        <input
                          type="date"
                          aria-label={`Tanggal Pencairan Termin ${idx + 1}`}
                          title="Tanggal Pencairan Termin"
                          value={tr.tanggalCair || ''}
                          onChange={(e) =>
                            handleTerminFieldChange(tr.id, {
                              tanggalCair: e.target.value || undefined,
                            })
                          }
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-300 font-mono tabular-nums text-[11px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>

                      <div className="flex justify-end shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDeleteTermin(tr.id)}
                          disabled={terminPencairan.length <= 1}
                          aria-label={`Hapus termin ${idx + 1}`}
                          title="Hapus termin"
                          className="p-1.5 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 disabled:opacity-40 text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2" data-testid="workflow-stages-editor">
              {tahapan.map((stage, idx) => (
                <div
                  key={stage.id}
                  data-testid={`workflow-stage-row-${idx}`}
                  className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col lg:flex-row lg:items-center gap-2"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="w-6 h-6 rounded-md bg-slate-900 text-white font-mono font-bold text-[11px] flex items-center justify-center shrink-0 tabular-nums">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      aria-label={`Nama Tahap ${idx + 1}`}
                      value={stage.nama}
                      onChange={(e) => handleStageNameChange(stage.id, e.target.value)}
                      placeholder={`Nama tahap ke-${idx + 1}`}
                      className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
                    <select
                      aria-label={`Status Tahap ${idx + 1}`}
                      value={stage.status}
                      onChange={(e) =>
                        handleStageStatusChange(stage.id, e.target.value as StatusTahapPekerjaan)
                      }
                      className="px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-[11px] font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="belum_mulai">Belum Mulai</option>
                      <option value="sedang_berjalan">Sedang Berjalan</option>
                      <option value="selesai">Selesai</option>
                    </select>

                    <input
                      type="date"
                      aria-label={`Target Tanggal Tahap ${idx + 1}`}
                      title="Target tanggal tahap (opsional)"
                      value={stage.tanggalTarget || ''}
                      onChange={(e) => handleStageTargetChange(stage.id, e.target.value)}
                      className="px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-mono tabular-nums text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveStage(idx, -1)}
                        disabled={idx === 0}
                        aria-label={`Naikkan urutan tahap ${idx + 1}`}
                        title="Naikkan urutan"
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-600"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveStage(idx, 1)}
                        disabled={idx === tahapan.length - 1}
                        aria-label={`Turunkan urutan tahap ${idx + 1}`}
                        title="Turunkan urutan"
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-600"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteStage(stage.id)}
                        disabled={tahapan.length <= 1}
                        aria-label={`Hapus tahap ${idx + 1}`}
                        title="Hapus tahapan"
                        className="p-1.5 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 disabled:opacity-40 text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Catatan Tambahan */}
          <div>
            <label htmlFor="paket-catatan" className="block font-semibold text-slate-700 mb-1">
              Catatan / Keterangan Tambahan
            </label>
            <textarea
              id="paket-catatan"
              rows={2}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Catatan kendala, lokasi pekerjaan, atau informasi tambahan (opsional)"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2">
            <div>
              {isEditing && initialPaket && onDeletePaket && (
                confirmDelete ? (
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleDeleteCurrent}
                      disabled={isDeleting || isSaving}
                      className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-semibold transition-colors"
                    >
                      {isDeleting ? 'Menghapus...' : 'Ya, Hapus Paket'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      disabled={isDeleting}
                      className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition-colors"
                    >
                      Batal
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 font-semibold transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Hapus Paket</span>
                  </button>
                )
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving || isDeleting}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSaving || isDeleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold shadow-sm transition-colors"
              >
                <Check className="w-4 h-4" />
                <span>
                  {isSaving
                    ? 'Menyimpan...'
                    : isEditing
                    ? 'Simpan Perubahan Paket'
                    : 'Simpan Paket Pekerjaan'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
