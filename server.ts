import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { GoogleGenAI, Type } from '@google/genai';

const PORT = Number(process.env.PORT || 3000);
const MODEL_NAME = 'gemini-4-hydrogen';

function getGeminiClient(): GoogleGenAI {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw Object.assign(
      new Error(
        'GEMINI_API_KEY belum dikonfigurasi pada server. Silakan atur GEMINI_API_KEY di panel Settings > Secrets.'
      ),
      { statusCode: 503, code: 'GEMINI_API_KEY_MISSING' }
    );
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function sendAiError(res: Response, err: unknown, fallbackMsg: string) {
  const anyErr = err as { statusCode?: number; status?: number; code?: string; message?: string };
  const status = anyErr?.statusCode || anyErr?.status || 502;
  const message = anyErr?.message || fallbackMsg;
  console.error('[Gemini AI Route Error]', message);
  res.status(status >= 400 && status < 600 ? status : 502).json({
    error: message,
    code: anyErr?.code || 'GEMINI_API_ERROR',
  });
}

function normalizeWeightsTo100(
  stages: Array<{
    nama: string;
    bobot: number;
    deskripsi: string;
    dokumenWajib: string[];
    jenisJadwal: string;
  }>
) {
  if (stages.length === 0) return stages;
  const sanitized = stages.map((s) => ({
    ...s,
    bobot: Math.max(5, Math.round(Number(s.bobot) || 0)),
  }));
  const sum = sanitized.reduce((acc, s) => acc + s.bobot, 0);
  if (sum !== 100 && sanitized.length > 0) {
    const diff = 100 - sum;
    const lastIdx = sanitized.length - 1;
    sanitized[lastIdx] = {
      ...sanitized[lastIdx],
      bobot: Math.max(5, sanitized[lastIdx].bobot + diff),
    };
  }
  return sanitized;
}

function clampText(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    res.json({
      ok: true,
      aiConfigured: Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY'),
      model: MODEL_NAME,
    });
  });

  // 1. AI Generator Tahapan & KAK dari Surat
  app.post('/api/ai/generate-pekerjaan', async (req: Request, res: Response) => {
    try {
      const namaKegiatan = clampText(req.body?.namaKegiatan, 250);
      const bidangTimKerja = clampText(req.body?.bidangTimKerja, 200);
      const nomorSurat = clampText(req.body?.nomorSurat, 150);
      const asalSurat = clampText(req.body?.asalSurat, 250);
      const perihalSurat = clampText(req.body?.perihalSurat, 1500);
      const tanggalMulai = clampText(req.body?.tanggalMulai, 40);
      const tenggatWaktu = clampText(req.body?.tenggatWaktu, 40);

      if (!namaKegiatan && !perihalSurat) {
        res.status(400).json({
          error: 'Isi Nama Kegiatan atau pilih Referensi Surat terlebih dahulu sebelum menjalankan AI.',
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      const ai = getGeminiClient();

      const prompt = `Anda adalah perencana pengadaan dan pengendalian kegiatan pemerintahan pada Dinas Perumahan dan Kawasan Permukiman (Tim Pengawasan dan Pengendalian Perumahan).

Analisislah data paket kegiatan dan surat referensi berikut, lalu rekomendasikan jenis pelaksanaan yang paling sesuai (antara "Konsultan Perorangan", "Konsultan Badan Usaha", "Pekerjaan Fisik", atau "Swakelola/Rutin"), rincian tahapan kerja dengan total bobot tepat 100%, daftar dokumen wajib per tahap, dan ringkasan KAK operasional.

Data Masukan:
- Nama Kegiatan: ${namaKegiatan || '(Belum diisi - tentukan dari perihal surat)'}
- Bidang / Tim Kerja: ${bidangTimKerja || 'Tim Pengawasan dan Pengendalian Perumahan'}
- Nomor Surat Referensi: ${nomorSurat || '-'}
- Asal Surat: ${asalSurat || '-'}
- Perihal / Isi Dasar Surat: ${perihalSurat || '-'}
- Rencana Tanggal Mulai: ${tanggalMulai || '-'}
- Target Tenggat Waktu: ${tenggatWaktu || '-'}

Ketentuan Jenis Pelaksanaan & Template Acuan Pemerintah Daerah:
- Konsultan Perorangan: cocok untuk tenaga ahli individual / kajian teknis skala terbatas (mis. Persiapan & SPK, Laporan Pendahuluan, Laporan Akhir & BAST).
- Konsultan Badan Usaha: cocok untuk jasa konsultansi tim multidisiplin / pengawasan teknis / studi komprehensif (mis. Rapat Persiapan/PCM, Laporan Pendahuluan, Laporan Antara, Draf Laporan Akhir, Laporan Akhir & BAST).
- Pekerjaan Fisik: cocok untuk konstruksi/rehabilitasi/prasarana fisik (mis. PCM, Progres 25%, Progres 50%, Progres 75%, PHO).
- Swakelola/Rutin: cocok untuk kegiatan internal dinas, sosialisasi, pengawasan rutin, pendataan lapangan tim (mis. Perencanaan & KAK, Pelaksanaan Kegiatan, Laporan Pertanggungjawaban).

Pastikan:
1. Total bobot seluruh tahapan berjumlah tepat 100.
2. Gunakan nama kategori dokumen wajib dari: "KAK", "SPK", "Notulensi", "Foto", "BAST", "Lainnya" atau deskripsi spesifik yang jelas.
3. Bahasa Indonesia formal birokrasi pemerintahan.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction:
            'Berikan output JSON valid sesuai schema. Jangan sertakan markdown atau teks di luar JSON.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              jenisPelaksanaan: {
                type: Type.STRING,
                enum: [
                  'Konsultan Perorangan',
                  'Konsultan Badan Usaha',
                  'Pekerjaan Fisik',
                  'Swakelola/Rutin',
                ],
                description: 'Jenis pelaksanaan paket pekerjaan yang direkomendasikan.',
              },
              namaKegiatanSaran: {
                type: Type.STRING,
                description: 'Nama kegiatan dinas yang rapi dan formal bila belum diisi.',
              },
              alasanRekomendasi: {
                type: Type.STRING,
                description: 'Alasan pemilihan jenis pelaksanaan (mis. Individual vs Badan Usaha vs Fisik vs Swakelola).',
              },
              ringkasanKak: {
                type: Type.STRING,
                description: 'Ringkasan KAK / ruang lingkup pekerjaan dan output utama (2-4 kalimat formal).',
              },
              dokumenWajib: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Daftar dokumen wajib utama untuk paket pekerjaan ini.',
              },
              tahapan: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    nama: { type: Type.STRING, description: 'Nama tahapan kerja' },
                    bobot: { type: Type.INTEGER, description: 'Bobot persentase tahapan (bilangan bulat)' },
                    deskripsi: { type: Type.STRING, description: 'Output atau fokus kegiatan di tahap ini' },
                    jenisJadwal: {
                      type: Type.STRING,
                      enum: ['Tenggat Tahap', 'Rapat PCM', 'Paparan Laporan', 'BAST / PHO'],
                    },
                    dokumenWajib: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                  required: ['nama', 'bobot', 'deskripsi', 'jenisJadwal', 'dokumenWajib'],
                },
              },
            },
            required: [
              'jenisPelaksanaan',
              'namaKegiatanSaran',
              'alasanRekomendasi',
              'ringkasanKak',
              'dokumenWajib',
              'tahapan',
            ],
          },
        },
      });

      const rawText = (response.text || '').trim();
      if (!rawText) {
        throw new Error('Model AI tidak mengembalikan respons yang dapat diproses.');
      }
      const parsed = JSON.parse(rawText);
      const tahapan = normalizeWeightsTo100(Array.isArray(parsed.tahapan) ? parsed.tahapan : []);

      res.json({
        jenisPelaksanaan: parsed.jenisPelaksanaan,
        namaKegiatanSaran: parsed.namaKegiatanSaran || namaKegiatan,
        alasanRekomendasi: parsed.alasanRekomendasi || '',
        ringkasanKak: parsed.ringkasanKak || '',
        dokumenWajib: Array.isArray(parsed.dokumenWajib) ? parsed.dokumenWajib : [],
        tahapan,
      });
    } catch (err) {
      sendAiError(res, err, 'Gagal menghasilkan rekomendasi tahapan & KAK dari Gemini AI.');
    }
  });

  // 2. AI Executive Briefing (Dashboard)
  app.post('/api/ai/executive-briefing', async (req: Request, res: Response) => {
    try {
      const pekerjaanList = Array.isArray(req.body?.pekerjaanList) ? req.body.pekerjaanList : [];
      const summaryMetrics = req.body?.summaryMetrics || {};
      const todayIso = clampText(req.body?.todayIso, 20) || new Date().toISOString().split('T')[0];

      if (pekerjaanList.length === 0) {
        res.status(400).json({
          error: 'Belum ada data paket pekerjaan untuk dianalisis oleh AI.',
          code: 'NO_DATA',
        });
        return;
      }

      const ai = getGeminiClient();

      const compactPackages = pekerjaanList.slice(0, 30).map((p: Record<string, unknown>) => ({
        namaKegiatan: p.namaKegiatan,
        jenisPelaksanaan: p.jenisPelaksanaan,
        bidangTimKerja: p.bidangTimKerja,
        nilaiKontrak: p.nilaiKontrak,
        tanggalMulai: p.tanggalMulai,
        tenggatWaktu: p.tenggatWaktu,
        progresPersen: p.progresPersen,
        suratReferensiNomor: p.suratReferensiNomor,
        tahapan: Array.isArray(p.tahapan)
          ? p.tahapan.map((t: Record<string, unknown>) => ({
              nama: t.nama,
              bobot: t.bobot,
              tenggatWaktu: t.tenggatWaktu,
              statusVerifikasi: t.statusVerifikasi,
              catatanVerifikasi: t.catatanVerifikasi,
              jumlahBukti: Array.isArray(t.buktiDukung) ? t.buktiDukung.length : 0,
            }))
          : [],
      }));

      const prompt = `Anda adalah Analis Manajemen Kinerja Senior pada Dinas Perumahan dan Kawasan Permukiman (Tim Pengawasan dan Pengendalian Perumahan).
Tanggal evaluasi hari ini: ${todayIso}.

Analisislah portofolio kegiatan dan paket pekerjaan berikut secara faktual berdasarkan progres disetujui, tenggat waktu paket/tahap terhadap tanggal ${todayIso}, tahap yang berstatus "Perlu Revisi" atau "Menunggu Review", serta nilai kontraknya.

Ringkasan Statistik: ${JSON.stringify(summaryMetrics)}
Daftar Paket Pekerjaan: ${JSON.stringify(compactPackages)}

Tugas Anda:
1. Susun ringkasan eksekutif kinerja secara ringkas, faktual, dan tajam untuk Pimpinan / Kepala Dinas.
2. Tentukan tingkat risiko keseluruhan ("Rendah", "Sedang", atau "Tinggi") berdasarkan keterlambatan tenggat dan revisi terbuka.
3. Identifikasi temuan keterlambatan atau potensi keterlambatan serta hambatan verifikasi tahap secara spesifik (sebutkan nama kegiatan/tahap yang relevan).
4. Berikan rekomendasi langkah tindak lanjut konkret bagi Ketua Tim / PPK.
5. Susun satu paragraf/butir Draf Laporan Evaluasi Singkat formal yang siap disampaikan langsung kepada Kepala Dinas.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction:
            'Hanya analisis data yang diberikan secara akurat. Jangan mengarang proyek yang tidak ada pada input. Keluarkan JSON sesuai schema.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              ringkasanEksekutif: { type: Type.STRING },
              tingkatRisiko: {
                type: Type.STRING,
                enum: ['Rendah', 'Sedang', 'Tinggi'],
              },
              temuanKeterlambatan: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              rekomendasiTindakLanjut: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              drafLaporanSingkat: { type: Type.STRING },
            },
            required: [
              'ringkasanEksekutif',
              'tingkatRisiko',
              'temuanKeterlambatan',
              'rekomendasiTindakLanjut',
              'drafLaporanSingkat',
            ],
          },
        },
      });

      const rawText = (response.text || '').trim();
      if (!rawText) {
        throw new Error('Model AI tidak mengembalikan ringkasan eksekutif.');
      }
      res.json(JSON.parse(rawText));
    } catch (err) {
      sendAiError(res, err, 'Gagal menyusun ringkasan kinerja & risiko pekerjaan dari Gemini AI.');
    }
  });

  // 3. AI Draf Surat Pengantar / Undangan Pembahasan
  app.post('/api/ai/draft-surat-pembahasan', async (req: Request, res: Response) => {
    try {
      const pekerjaan = req.body?.pekerjaan;
      const tahap = req.body?.tahap;
      const jenisSurat =
        req.body?.jenisSurat === 'Surat Pengantar' ? 'Surat Pengantar' : 'Undangan Pembahasan';
      const pejabatConfig = req.body?.pejabatConfig || {};

      if (!pekerjaan || !tahap) {
        res.status(400).json({
          error: 'Data pekerjaan dan tahapan wajib disertakan untuk membuat draf surat.',
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      const ai = getGeminiClient();

      const prompt = `Susunlah draf surat dinas resmi Pemerintah Kota Bandung (${pejabatConfig?.kepalaDinas?.instansi || 'Dinas Perumahan dan Kawasan Permukiman'} - Tim Pengawasan dan Pengendalian Perumahan) dalam Bahasa Indonesia baku tata naskah dinas.

Jenis Surat yang Diminta: ${jenisSurat}
Data Pekerjaan:
- Nama Kegiatan: ${clampText(pekerjaan.namaKegiatan, 250)}
- Jenis Pelaksanaan: ${clampText(pekerjaan.jenisPelaksanaan, 100)}
- Bidang / Tim Kerja: ${clampText(pekerjaan.bidangTimKerja, 200)}
- Nomor Referensi Surat Dasar: ${clampText(pekerjaan.suratReferensiNomor, 150) || '-'}
- Perihal Surat Dasar: ${clampText(pekerjaan.suratReferensiPerihal, 500) || '-'}
- Penanggung Jawab Internal: ${Array.isArray(pekerjaan.penanggungJawabNama) ? pekerjaan.penanggungJawabNama.join(', ') : '-'}

Data Tahapan Pekerjaan Terkait:
- Nama Tahapan: ${clampText(tahap.nama, 200)} (Bobot ${tahap.bobot}%)
- Jenis Jadwal: ${clampText(tahap.jenisJadwal, 60) || 'Pembahasan Tahap'}
- Tanggal Rapat / Tenggat: ${clampText(tahap.tanggalRapat, 40) || clampText(tahap.tenggatWaktu, 40)}
- Jam Pelaksanaan: ${clampText(tahap.jamMulaiRapat, 10) || '09:00'} - ${clampText(tahap.jamSelesaiRapat, 10) || '11:00'} WIB
- Lokasi: ${clampText(tahap.lokasiRapat, 200) || 'Ruang Rapat Bidang Perumahan DPKP'}
- Deskripsi/Output: ${clampText(tahap.deskripsi, 500) || '-'}

Data Penandatangan:
- Kepala Dinas: ${pejabatConfig?.kepalaDinas?.nama || '-'} (NIP ${pejabatConfig?.kepalaDinas?.nip || '-'})
- Kepala Bidang: ${pejabatConfig?.kepalaBidang?.nama || '-'} (NIP ${pejabatConfig?.kepalaBidang?.nip || '-'})
- Ketua Tim: ${pejabatConfig?.ketuaTim?.nama || '-'} (NIP ${pejabatConfig?.ketuaTim?.nip || '-'})

Buatlah draf surat yang lengkap dan siap digunakan, berisi:
- saran nomor surat keluar dinas yang wajar (format mis. 005/WASDAL/DPKP/XI/2026 atau 600/...)
- perihal surat yang ringkas dan jelas
- pihak tujuan surat yang relevan
- isi lengkap naskah surat dinas (Nomor, Sifat, Lampiran, Hal, Kepada Yth., paragraf pembuka merujuk surat dasar/kegiatan, rincian jadwal/dokumen yang diantar, penutup, dan blok tanda tangan).`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction:
            'Gunakan tata naskah dinas pemerintahan Indonesia yang formal, sopan, dan terstruktur rapi. Keluarkan JSON sesuai schema.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              nomorSuratSaran: { type: Type.STRING },
              perihalSurat: { type: Type.STRING },
              tujuanSurat: { type: Type.STRING },
              isiDrafSurat: { type: Type.STRING },
            },
            required: ['nomorSuratSaran', 'perihalSurat', 'tujuanSurat', 'isiDrafSurat'],
          },
        },
      });

      const rawText = (response.text || '').trim();
      if (!rawText) {
        throw new Error('Model AI tidak mengembalikan draf surat.');
      }
      res.json(JSON.parse(rawText));
    } catch (err) {
      sendAiError(res, err, 'Gagal membuat draf surat pembahasan/pengantar dari Gemini AI.');
    }
  });

  // Mount Vite middleware in development, or serve built assets in production
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve('dist/index.html'));
  if (isProd) {
    app.use(express.static(path.resolve('dist')));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SIPANTAU-WASDAL server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
