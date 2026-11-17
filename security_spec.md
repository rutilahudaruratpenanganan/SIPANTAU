# Security Specification — SIPANTAU-WASDAL Firestore Rules

## Data Invariants
1. Seluruh dokumen pada `/workspaces/{workspaceId}`, `/personel/{personelId}`, `/suratMasuk/{suratId}`, dan `/users/{userId}/private/info` wajib terautentikasi dengan Google Auth yang terverifikasi (`request.auth != null && request.auth.token.email_verified == true`).
2. `ownerId` pada setiap dokumen wajib sama persis dengan `request.auth.uid` saat pembuatan dan bersifat **immutable** setelah dibuat.
3. Document ID (`workspaceId`, `personelId`, `suratId`, `userId`) wajib memenuhi regex `^[a-zA-Z0-9_\-]+$` dengan panjang maksimal 128 karakter.
4. Seluruh timestamp (`createdAt`, `updatedAt`) wajib menggunakan server timestamp (`request.time`). `createdAt` bersifat immutable saat update.
5. `statusSelesai == true` pada `suratMasuk` merupakan terminal state kecuali dibuka kembali secara eksplisit lewat action `reopen` oleh pemilik workspace atau admin terverifikasi.
6. Seluruh array (`penerimaDisposisiIds`, `penerimaDisposisiNama`, `riwayatTindakLanjut`) dan string dibatasi ukuran maksimalnya untuk mencegah resource exhaustion dan melewati batas 1 MB dokumen Firestore.

## The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Write**: `request.auth == null` menulis ke `/suratMasuk/s1` -> `PERMISSION_DENIED`.
2. **Email Unverified Spoof**: `request.auth.token.email_verified == false` mencoba membuat `/personel/p1` -> `PERMISSION_DENIED`.
3. **Cross-Owner Spoofing on Create**: User A mengirim `ownerId: "user-B"` saat membuat `/suratMasuk/s2` -> `PERMISSION_DENIED`.
4. **Shadow Ghost Field Injection**: Payload valid dengan tambahan field liar `{ ..., isAdmin: true, hacked: "yes" }` -> `PERMISSION_DENIED` (ditolak oleh `keys().hasOnly(...)`).
5. **Path ID Poisoning**: Document ID mengandung karakter terlarang/panjang > 128 seperti `surat..//123` -> `PERMISSION_DENIED` (`isValidId`).
6. **Client-Forged Timestamp**: Payload mengirim `createdAt: "2020-01-01"` atau timestamp klien selain `request.time` -> `PERMISSION_DENIED`.
7. **Immutable Field Mutation**: Update mencoba mengubah `ownerId` atau `createdAt` -> `PERMISSION_DENIED`.
8. **String Length Overflow (Denial of Wallet)**: `perihal` sepanjang > 1500 karakter atau `fileSuratMasuk.dataUrl` > 250.000 karakter -> `PERMISSION_DENIED`.
9. **Array Overflow**: `penerimaDisposisiIds` berisi 31 item (> 30) atau `riwayatTindakLanjut` berisi 51 item (> 50) -> `PERMISSION_DENIED`.
10. **Invalid Enum / Stage Value**: `tahapSaatIni: 99` atau `peran: "superadmin"` -> `PERMISSION_DENIED`.
11. **Cross-Owner List/Get Scraping & PII Leak**: User A membaca `/personel/p-milik-B` atau `/users/B/private/info` -> `PERMISSION_DENIED`.
12. **Unauthorized Terminal State Field Tampering**: Update mengubah field selain allowlist action ketika `statusSelesai == true` -> `PERMISSION_DENIED`.
