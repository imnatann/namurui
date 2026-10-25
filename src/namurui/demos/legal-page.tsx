import { LegalPage, type LegalSection } from "../legal-page";

/* A slice of the Chatrigo privacy document: the eleven sections a reader opens the contents list
 * for, with real wording and real list items, so the page is judged at its true length. */

const DOCUMENTS = [
  { label: "Privasi", href: "#privasi", active: true },
  { label: "Syarat", href: "#syarat" },
  { label: "DPA", href: "#dpa" },
  { label: "Subprosesor", href: "#subprosesor" },
];

const SECTIONS: LegalSection[] = [
  {
    id: "pengendali",
    title: "Pengendali dan peran",
    body: (
      <>
        <p>
          PT Chatrigo Nusantara, beralamat di Jalan Kemang Raya 18, Jakarta Selatan, adalah
          pengendali data pribadi untuk akun yang dibuat di chatrigo.id, termasuk isi percakapan
          yang diproses oleh agen AI di dalamnya.
        </p>
        <p>
          Ketika Anda menghubungkan kanal milik bisnis Anda, seperti WhatsApp Business atau
          Instagram, kami bertindak sebagai prosesor dan memproses data itu hanya atas instruksi
          tertulis Anda.
        </p>
      </>
    ),
  },
  {
    id: "data",
    title: "Data yang dikumpulkan",
    body: (
      <>
        <p>
          Kami mengumpulkan data yang Anda berikan saat mendaftar, data yang lahir dari pemakaian
          produk, dan data yang masuk melalui kanal yang Anda hubungkan.
        </p>
        <ul>
          <li>Identitas akun: nama, alamat surel, nama bisnis, dan nomor telepon verifikasi.</li>
          <li>Isi percakapan: pesan pelanggan, balasan agen, lampiran, dan label yang Anda buat.</li>
          <li>Data teknis: alamat IP, jenis peramban, versi aplikasi, dan catatan galat.</li>
        </ul>
      </>
    ),
  },
  {
    id: "tujuan",
    title: "Tujuan pemrosesan",
    body: (
      <>
        <p>
          Data dipakai untuk menjalankan layanan yang Anda minta: mengarahkan percakapan ke agen
          yang tepat, menyusun ringkasan, dan menampilkan riwayat kepada tim Anda.
        </p>
        <p>
          Kami juga memakainya untuk menagih langganan, mendeteksi penyalahgunaan, dan memperbaiki
          kualitas jawaban. Kami tidak menjual data pribadi kepada pihak lain.
        </p>
      </>
    ),
  },
  {
    id: "dasar-hukum",
    title: "Dasar hukum",
    body: (
      <>
        <p>
          Pemrosesan untuk menjalankan kontrak menjadi dasar utama, termasuk saat kami menyimpan
          konfigurasi kanal dan riwayat percakapan agar layanan tetap berjalan.
        </p>
        <p>
          Persetujuan Anda menjadi dasar untuk surel produk dan untuk data sensitif yang Anda pilih
          untuk diaktifkan. Kepentingan sah menjadi dasar untuk keamanan dan pencegahan penipuan.
        </p>
      </>
    ),
  },
  {
    id: "cookie",
    title: "Cookie dan data teknis",
    body: (
      <>
        <p>
          Situs memakai cookie yang diperlukan untuk menjaga sesi masuk dan mengingat preferensi
          tampilan. Cookie ini tidak dapat dimatikan tanpa memutus fungsi dasarnya.
        </p>
        <p>
          Cookie analitik hanya dipasang setelah Anda menyetujuinya, dan persetujuan itu dapat
          ditarik kapan saja dari panel preferensi.
        </p>
      </>
    ),
  },
  {
    id: "retensi",
    title: "Retensi",
    body: (
      <>
        <p>
          Data akun disimpan selama langganan berjalan dan selama 90 hari setelah akun ditutup, agar
          Anda masih dapat memulihkannya.
        </p>
        <p>
          Isi percakapan mengikuti pengaturan retensi di ruang kerja Anda, dengan bawaan 24 bulan.
          Setelah itu pesan dihapus dari penyimpanan aktif dan tinggal dalam cadangan terenkripsi
          selama 35 hari.
        </p>
      </>
    ),
  },
  {
    id: "transfer",
    title: "Transfer internasional",
    body: (
      <>
        <p>
          Sebagian layanan kami dijalankan pada penyedia infrastruktur di Singapura dan Jerman.
          Transfer keluar Indonesia dilakukan dengan klausul kontraktual standar dan penilaian
          dampak yang ditinjau setiap tahun.
        </p>
        <p>Salinan perjanjian transfer tersedia atas permintaan melalui tim privasi.</p>
      </>
    ),
  },
  {
    id: "hak",
    title: "Hak subjek data",
    body: (
      <>
        <p>Anda berhak atas data Anda, dan kami menjawab setiap permintaan dalam 14 hari kerja.</p>
        <ul>
          <li>Melihat dan mengunduh salinan data yang kami simpan.</li>
          <li>Memperbaiki data yang tidak akurat.</li>
          <li>Menghapus akun beserta isi percakapannya.</li>
          <li>Menarik persetujuan dan menolak pemrosesan tertentu.</li>
        </ul>
        <p>Permintaan dikirim ke privasi@chatrigo.id dari alamat surel pemilik akun.</p>
      </>
    ),
  },
  {
    id: "pihak-ketiga",
    title: "Penyedia pihak ketiga",
    body: (
      <>
        <p>
          Kami memakai penyedia untuk pengiriman surel, penyimpanan berkas, pembayaran, dan model
          bahasa. Setiap penyedia terikat perjanjian pemrosesan data dan hanya menerima data yang
          diperlukan untuk tugasnya.
        </p>
        <p>
          Daftar subprosesor yang berlaku, lengkap dengan lokasi pemrosesan, ada di halaman
          Subprosesor dan diperbarui 30 hari sebelum perubahan berlaku.
        </p>
      </>
    ),
  },
  {
    id: "keamanan",
    title: "Keamanan",
    body: (
      <>
        <p>
          Percakapan dienkripsi saat transit dengan TLS 1.2 atau lebih baru dan saat disimpan dengan
          AES-256. Kunci dikelola melalui layanan manajemen kunci dan dirotasi setiap 90 hari.
        </p>
        <p>
          Akses internal dibatasi per peran dan dicatat. Jika terjadi insiden yang berdampak pada
          data pribadi, kami memberi tahu Anda dan otoritas terkait dalam 72 jam.
        </p>
      </>
    ),
  },
  {
    id: "perubahan",
    title: "Perubahan",
    body: (
      <>
        <p>
          Perubahan material diumumkan lewat surel pemilik akun dan banner di dalam produk paling
          lambat 14 hari sebelum berlaku.
        </p>
        <p>
          Versi sebelumnya diarsipkan dan dapat diminta kapan saja. Tanggal di halaman ini
          menunjukkan revisi terakhir.
        </p>
      </>
    ),
  },
];

export default function Demo() {
  return (
    <LegalPage
      title="Kebijakan Privasi"
      lead="Dokumen ini menjelaskan data apa yang kami kumpulkan saat Anda memakai Chatrigo, mengapa kami memprosesnya, dan hak apa yang Anda pegang atas data itu."
      updated="12 Maret 2025"
      documents={DOCUMENTS}
      sections={SECTIONS}
      footnote={
        <>
          <span>Pertanyaan tentang dokumen ini: privasi@chatrigo.id</span>
          <span>Versi 4.2, berlaku sejak 12 Maret 2025</span>
        </>
      }
    />
  );
}
