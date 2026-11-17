# Security Specification — SIPANTAU-WASDAL Firestore Rules (Internal Workspace Mode)

## Data Invariants
1. Seluruh dokumen aplikasi internal berada di bawah satu workspace bersama (`ownerId == 'internal_wasdal'` dan `/workspaces/internal_wasdal`) tanpa kewajiban login Google Auth agar dapat digunakan langsung oleh tim internal.
2. `ownerId` pada setiap dokumen wajib bernilai `'internal_wasdal'` saat pembuatan dan bersifat **immutable** setelah dibuat.
3. Document ID (`workspaceId`, `personelId`, `suratId`) wajib memenuhi regex `^[a-zA-Z0-9_\-]+$` dengan panjang maksimal 128 karakter.
4. Seluruh timestamp (`createdAt`, `updatedAt`) wajib menggunakan server timestamp (`request.time`). `createdAt` bersifat immutable saat update.
5. `statusSelesai == true` pada `suratMasuk` merupakan terminal state kecuali dibuka kembali secara eksplisit lewat action `reopen` (`statusSelesai` diubah ke `false`).
6. Seluruh array (`penerimaDisposisiIds`, `penerimaDisposisiNama`, `riwayatTindakLanjut`) dan string dibatasi ukuran maksimalnya untuk mencegah resource exhaustion dan melewati batas 1 MB dokumen Firestore.
7. Koleksi privat pengguna (`/users/{userId}/private/{docId}`) tetap dikunci penuh (`allow read, write: if false;`) karena mode internal tidak menyimpan data autentikasi pribadi.

## Adversarial Validation Payloads
1. **Invalid Workspace Scope Create**: Mencoba membuat `/workspaces/other_ws` atau `ownerId: "user-random"` -> `PERMISSION_DENIED`.
2. **Shadow Ghost Field Injection**: Payload valid dengan tambahan field liar `{ ..., isAdmin: true, hacked: "yes" }` -> `PERMISSION_DENIED` (ditolak oleh `keys().hasOnly(...)`).
3. **Path ID Poisoning**: Document ID mengandung karakter terlarang/panjang > 128 seperti `surat..//123` -> `PERMISSION_DENIED` (`isValidId`).
4. **Client-Forged Timestamp**: Payload mengirim `createdAt: "2020-01-01"` atau timestamp klien selain `request.time` -> `PERMISSION_DENIED`.
5. **Immutable Field Mutation**: Update mencoba mengubah `ownerId` atau `createdAt` -> `PERMISSION_DENIED`.
6. **String Length Overflow (Denial of Wallet)**: `perihal` sepanjang > 1500 karakter atau `fileSuratMasuk.dataUrl` > 250.000 karakter -> `PERMISSION_DENIED`.
7. **Array Overflow**: `penerimaDisposisiIds` berisi 31 item (> 30) atau `riwayatTindakLanjut` berisi 51 item (> 50) -> `PERMISSION_DENIED`.
8. **Invalid Enum / Stage Value**: `tahapSaatIni: 99`, `sifat: "Rahasia Negara"`, atau `peran: "superadmin"` -> `PERMISSION_DENIED`.
9. **Unauthorized Collection Access**: Mencoba membaca/menulis ke `/users/any/private/info` atau koleksi acak `/secret/doc` -> `PERMISSION_DENIED`.
10. **Unauthorized Terminal State Field Tampering**: Update mengubah field selain `statusSelesai`/`tanggalSelesai`/`riwayatTindakLanjut`/`updatedAt` ketika `statusSelesai == true` -> `PERMISSION_DENIED`.
