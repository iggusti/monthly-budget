/**
 * Seed daily expenses + savings withdrawals (Jan - Sep 2026) from the
 * "Budgeting Bulanan.xlsx" Sheet2 into Firestore.
 *
 * Structure written per month (id `YYYY-MM`):
 *   dailyFromSalary:    husband daily expenses paid from the monthly salary
 *   savingsWithdrawals: money taken from savings ("Ambil ke Dana Tabungan")
 *
 * Income and fixed expenses are intentionally left untouched.
 *
 * Run with: node scripts/seed-daily-2026.mjs
 */
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA76dfX8IPTvTx7ehorlHi9OFvr2s-Npug",
  authDomain: "monthly-budget-580b2.firebaseapp.com",
  projectId: "monthly-budget-580b2",
  storageBucket: "monthly-budget-580b2.firebasestorage.app",
  messagingSenderId: "276706600878",
  appId: "1:276706600878:web:0d8914bd9e8ecbc4048a3f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let seq = 0;
const id = () => `seed-${(++seq).toString(36).padStart(4, "0")}`;

/**
 * Daily expenses, transcribed from Sheet2.
 * Each entry: [name, amount, method]. Empty method becomes "".
 */
const daily = {
  "2026-01": [
    ["Car Free Day", 200000, "BNI"],
    ["Gendongan Depan", 225000, "Shopee"],
    ["Selang Flexible", 20000, "Tiktok"],
    ["Belanja Pagi", 200000, "BSI"],
    ["Syukuran Capeg", 100000, "Transfer"],
    ["Beli Beras, Gas", 300000, "BRI"],
    ["Kuota Bulanan", 160000, "QRIS"],
    ["Set Top Box + Dongle Wifi", 170000, "TokPed"],
    ["Connector Selang Flexible", 10000, "TokPed"],
    ["Sedekah Tiap Subuh", 30000, "QRIS"],
    ["Minuman Mie Gacoan", 14500, "QRIS"],
    ["GoCar Pulang dari Mie Gacoan", 50000, "GoPay"],
    ["Bayar Listrik Ciparay 55k + 10k", 10000, "Transfer"],
    ["Stock Mie dan Tepung Pisang", 100000, "BRI"],
    ["Ngelayat", 100000, "BRI"],
    ["Fore Coffee", 60000, "QRIS"],
    ["Nombok Hilang Uang 100k", 100000, "BRI"],
    ["Car Free Day", 200000, "BRI"]
  ],
  "2026-02": [
    ["Sedekah Jariyah", 30000, "Auto Donate"],
    ["Sedekah Tiap Subuh", 30000, "Auto Donate"],
    ["Sedekah Darurat Dibantu", 30000, "Auto Donate"],
    ["Belanja Sayur Bayam", 55000, "QRIS"],
    ["Mie Indomie, Seblak", 300000, "Bank Mandiri"],
    ["Belanja Cumi Sawi Sosis", 70000, "QRIS"],
    ["Ayam Taliwang", 49500, "QRIS"],
    ["Bawang Goreng", 40000, "Transfer"],
    ["Minyak Sayur Setelah Kesemutan", 52300, "QRIS"],
    ["Bukaan", 300000, "Bank BNI"],
    ["Nambahin Baju Lebaran", 100000, "Transfer"],
    ["Map Plastik", 10000, "Transfer"],
    ["Bukaan Ayam Opor & Cabe Ijo", 100000, "BRI"],
    ["Tulang Rangu & Paru Mercon", 80422, "QRIS"],
    ["Ayam Gepuk & Cakwe", 200000, "BRI"],
    ["Hijab Lebaran Eneng", 56000, "Transfer"],
    ["Jaket Hijau Matahari", 249900, "Card"]
  ],
  "2026-03": [
    ["Sedekah Jariyah", 30000, "Auto Donate"],
    ["Sedekah Tiap Subuh", 30000, "Auto Donate"],
    ["Sedekah Darurat Dibantu", 30000, "Auto Donate"],
    ["Koolfever", 25300, "SPay"],
    ["Pisang Molen", 50000, "BRI"],
    ["Pegangan Balik Cilegon", 200000, "BJB"],
    ["Beli Aqua Galon dan Telur", 200000, "BRI"],
    ["SPay ke Tarsudi", 100000, "SPay"],
    ["Beli Sepeda Listrik", 500000, "SPay"],
    ["Ban Belakang Tubeless", 31700, "Transfer"],
    ["Pegangan ke Ciparay & Beli Ketoprak", 300000, "BRI"],
    ["Beli Makan Sore", 300000, "BRI"]
  ],
  "2026-04": [
    ["Sedekah Jariyah", 30000, "Auto Donate"],
    ["Sedekah Tiap Subuh", 30000, "Auto Donate"],
    ["Sedekah Darurat Dibantu", 30000, "Auto Donate"],
    ["Wisuda ke Ciparay", 1000000, ""],
    ["Pegangan Sambil Ambil Kasbon Wa Mu", 100000, "BNI"],
    ["Pengeluaran di Ciparay ambil kartu", 700000, ""]
  ],
  "2026-05": [
    ["Sedekah Jariyah", 30000, "Auto Donate"],
    ["Sedekah Tiap Subuh", 30000, "Auto Donate"],
    ["Sedekah Darurat Dibantu", 30000, "Auto Donate"],
    ["Belanja Super Indo & Hadiah Ultah", 400000, "QRIS"],
    ["Bakso Malang", 24000, "QRIS"],
    ["Beli Sayur", 30000, "QRIS"],
    ["Roti Kukus, Dorayaki, Pie", 50000, "QRIS"],
    ["Ambil Uang Di Indomaret", 200000, "Transfer"],
    ["Antena TV", 189000, "QRIS"],
    ["Butter, Bumbu Bambo", 89470, "QRIS"],
    ["Konektor Kran", 20904, "QRIS"],
    ["Jajan Enza", 200000, "BRI"],
    ["Konektor Kran", 7899, "QRIS"],
    ["AZKO", 87700, "QRIS"],
    ["MAKO", 27000, "QRIS"],
    ["Grab CCM to Kontrakan", 45500, "QRIS"],
    ["Es Krim Pulang dari Nala", 15700, "QRIS"]
  ],
  "2026-06": [
    ["Sedekah Jariyah", 30000, "Auto Donate"],
    ["Sedekah Tiap Subuh", 30000, "Auto Donate"],
    ["Sedekah Darurat Dibantu", 30000, "Auto Donate"],
    ["Bongko Kateng", 200000, "BJB"],
    ["Potong Rambut Salon Shanty", 165000, "Transfer"],
    ["Nasgor, Kwetiaw", 200000, ""],
    ["Pulsa Ayang", 28946, ""],
    ["Cukur Rambut", 200000, ""],
    ["Bayar Tol", 400000, ""],
    ["Kuota Simpati Uti", 53000, ""],
    ["Kondangan Ang Aji", 50000, ""]
  ],
  "2026-07": [
    ["Sedekah Jariyah", 30000, "Auto Donate"],
    ["Sedekah Tiap Subuh", 30000, "Auto Donate"],
    ["Sedekah Darurat Dibantu", 30000, "Auto Donate"],
    ["Admin Kita Bisa", 928, ""],
    ["Belanja Kangkung, Pindang, Oncom", 66000, ""],
    ["Casing, Anti Gores, Lem Samsung S23 FE", 77875, ""],
    ["Beli Saham GOTO", 20051, ""],
    ["Paralon Jalan Le Minerale", 28612, ""],
    ["Imunisasi Campak", 150000, ""],
    ["Poster Anak", 17999, ""],
    ["Makan Siang Warteg", 200000, ""],
    ["Beras 10kg", 150000, ""],
    ["Eneng ke Subang", 23000, ""],
    ["Nestle, Snack, Puding", 93200, ""],
    ["Nasi Uduk, Obat Flu", 200000, ""],
    ["Gojek Cilegon", 21600, ""],
    ["Rawon Telyu", 17000, ""],
    ["Gojek ke Telyu", 8000, ""],
    ["Gojek ke Ciparay", 53000, ""],
    ["Bubur Ayam", 16000, ""],
    ["Nasi Dadar Tahu", 9000, ""],
    ["Nasi Ati Ampela", 15000, ""],
    ["Nasi Tongkol Terong Tahu", 12000, ""],
    ["Pecel Lele", 100000, ""],
    ["Pudding Ayang", 27500, ""],
    ["Rawon Telur Bebek", 22000, ""],
    ["Telur 1kg + Daun Bawang", 28000, ""]
  ],
  "2026-08": [
    ["Sedekah Jariyah", 30000, "Auto Donate"],
    ["Sedekah Tiap Subuh", 30000, "Auto Donate"],
    ["Sedekah Darurat Dibantu", 30000, "Auto Donate"],
    ["Cumi Capcay", 41000, ""],
    ["Ayam Mrotol", 30000, ""],
    ["Pegangan Ke Baso Malang", 200000, ""],
    ["Eneng Pinjem", 100000, ""],
    ["Minyak Telon dan Parfum", 39400, ""],
    ["Ayam Penyet", 30000, ""],
    ["Belanja Sayur Mentah", 63000, ""],
    ["Mie Ayam", 35000, ""],
    ["Jus Melon Alpukat", 32000, ""],
    ["Pegangan Ke Ciparay", 200000, ""],
    ["Gojek Ke BTM Cilegon", 22500, ""],
    ["Jajan di Rest Area", 20000, ""],
    ["Gojek ke Ciparay", 39500, ""],
    ["Pembersih Seprai", 35000, ""],
    ["Bubur Ayam", 13000, ""],
    ["Kantin Mulya Rasa", 15000, ""],
    ["Nasi Ati Ampela", 33000, ""],
    ["Teh Pucuk + Sosis", 13000, ""],
    ["Bolu + Cireng Ayang", 63987, ""],
    ["Pegangan 2 Sept", 100000, ""],
    ["Pegangan 3 Sept", 100000, ""],
    ["Stock Mie", 41800, ""],
    ["Teh Susu Momoyo", 18100, ""],
    ["Bento Chicken", 45000, ""],
    ["Warteg Tempe Terong Mustofa", 12000, ""],
    ["Dimsum", 35000, ""],
    ["STNK Motor Vario Ciparay", 40000, ""],
    ["Nabung", 2213, ""]
  ],
  "2026-09": [
    ["Sedekah Jariyah", 30000, "Auto Donate"],
    ["Sedekah Tiap Subuh", 30000, "Auto Donate"],
    ["Sedekah Darurat Dibantu", 30928, "Auto Donate"],
    ["Bubur, Pudding, Uduk, Mie Ayam 2, Ayam Gepuk, Galon", 100000, ""],
    ["Duren Palem Hills", 100000, ""],
    ["Mie Bangka, Mie Yamin Manis", 49000, ""],
    ["Bubur Ayam", 26000, ""],
    ["Gojek Ciparay, Cilegon", 150000, ""],
    ["Pop Mie, Pisang", 12500, ""],
    ["Bubur Ayam", 16000, ""],
    ["Pegangan sebelum Pelatihan", 300000, ""],
    ["Parkir Pelatihan", 10000, ""],
    ["Nasi Ayam", 15000, ""],
    ["Kaos Enza Copy Ayah", 51300, ""],
    ["Labbaik Ayang", 35600, ""],
    ["Nombok BTM", 35000, ""],
    ["Tip Driver", 5000, ""],
    ["Jajan Indomaret", 16700, ""],
    ["Kopi Indomaret", 14000, ""],
    ["Pop Mie", 9000, ""],
    ["Obat Alergi Enza", 70000, ""],
    ["Ambil Untuk Beli Buah", 200000, ""],
    ["Lazzato", 48000, ""],
    ["Telur Kopi Teh Jus", 46500, ""],
    ["Bayem Tahu Daun Bawang Kentang", 25000, ""],
    ["Taliwang Ayam", 49500, ""],
    ["Durian Sop", 20000, ""],
    ["Cukur Enza", 15000, ""],
    ["Nasi Uduk SD", 15000, ""],
    ["Kopi Depan Alfamidi", 8000, ""],
    ["Tukeran Uang Eneng", 7000, ""]
  ],
  "2026-10": [
    ["Sedekah Jariyah", 30000, "Auto Donate"],
    ["Sedekah Tiap Subuh", 30000, "Auto Donate"],
    ["Sedekah Darurat Dibantu", 30928, "Auto Donate"],
    ["Belanja Minyak, Garam, Masako, Sarden, Bumbu Nasgor, Sasa", 87500, ""],
    ["Warung Apotek, Bensin, Sop Buah", 200000, ""],
    ["Roti, Teh Pucuk", 23600, ""],
    ["Tambahan BTM", 5000, ""],
    ["Gojek Ke CFD", 8500, ""],
    ["Gojek Dari CFD", 8500, ""],
    ["Gojek Perjalanan Cilegon Bandung", 200000, ""],
    ["Nasgor Mie", 30000, ""],
    ["Bubur Ayam", 16000, ""],
    ["Warteg", 15000, ""],
    ["Kopi Serenceng, Gabin", 21000, ""],
    ["Kecap Enza", 45000, ""],
    ["Ambil 100k buat maksi", 100000, ""],
    ["Warteg", 12000, ""],
    ["Dimsum Ayang", 30000, ""],
    ["Labbaik Ayang", 35600, ""],
    ["Roti'O ayang", 75000, ""],
    ["Gas, Telur", 35000, ""],
    ["Warteg tongkol oreg", 23000, ""],
    ["Nasgor", 15000, ""],
    ["Teh Pucuk, Kecap", 11000, ""],
    ["Nombok BTM Travel", 5000, ""],
    ["Bubur Ayam, Lotek, Warteg", 47000, ""]
  ]
};

/** Savings withdrawals, transcribed from Sheet2 columns E/F ("Ambil ke Dana Tabungan"). */
const withdrawals = {
  "2026-05": [
    ["Kondangan Rizal", 150000],
    ["SGM Enza", 93400],
    ["Labbaik", 45000],
    ["Sumbangan Anak Yatim", 10000],
    ["Mie dan Biskuit Enza", 90200],
    ["Mie Ayam Mas Boy", 36000],
    ["Nasi Padang", 41000],
    ["Kopi Half", 29000],
    ["Sarung", 50000],
    ["Ayam Taliwang", 49500],
    ["Nila Bakar & Ayam Goreng", 54000],
    ["Ke Pantai Merak", 100000],
    ["Mie Ayam", 40000],
    ["Nge Es", 30000],
    ["Dimsum", 25000],
    ["Nescafe", 12000]
  ],
  "2026-06": [
    ["Nasi Padang Telyu", 200000],
    ["Beli Sayur", 300000],
    ["Labbaik Garlic Soy", 35600],
    ["Shopee Pulsa Eneng", 21000],
    ["Bubur Ayam", 13000],
    ["Nasi Ati Ampela", 30000],
    ["Bubur Ayam", 13000],
    ["Mie Rendang, Sereh, Daun Jeruk", 15000],
    ["Kabel Antena Sambungan", 85143],
    ["Klem Kabel Beton", 10000],
    ["Sayur Asem, Ikan Asin", 39000],
    ["Tiket BTM Ke Cilegon", 185000],
    ["Nescafe Kopi", 24000],
    ["Macha Indomart", 30000],
    ["Bolu Susu Lembang", 66000],
    ["Ambil Uang Beli Soto", 100000],
    ["Lotek Makan Siang", 200000],
    ["Service Laptop", 1500000],
    ["Makan Siang Nasi Padang", 100000]
  ],
  "2026-07": [
    ["Pegangan Malem Jumat 6 8 26", 110000],
    ["Bento dan Minyak Urut", 100000],
    ["Pegangan Pulang & Beli Oleh Oleh", 200000],
    ["Tiket Pulang Ke Cilegon (dari Fixed Expenses)", 35000],
    ["Gojek Ciparay Ke Telyu", 37000],
    ["Gojek Telyu Ke BTM Buah Batu", 8000],
    ["Gojek BTM Cilegon Ke Kontrakan", 22300],
    ["Baso Puskesmas", 38000],
    ["Warteg Puri", 66000],
    ["Bayar Kontrakan Bulanan", 300000],
    ["Diambil Setelah Makan Ramen Naruto", 300000],
    ["Paket Smartfren", 150000]
  ],
  "2026-08": [
    ["Pegangan 6 September 2026", 200000],
    ["Kaos Navy", 75000],
    ["Jajan di Alfa Tahura", 27700],
    ["Gojek ke BTM Bandung", 40500],
    ["Jajan Roti Kopi Indomaret BTM", 32000],
    ["Gojek dari BTM Cilegon", 23000],
    ["Pegangan 10 September 2026", 200000],
    ["Sedekah ke Kita Bisa", 378000],
    ["Beli Mukena", 200000],
    ["Baso Urat", 30000],
    ["Belanja ke Warung Sayur", 44000],
    ["Roti Kukus", 9000],
    ["Belanja Kangkung", 26000],
    ["Belanja Cumi", 40000],
    ["Baterai AAA & Yakult", 66000],
    ["Nombok Bayar Kontrakan", 163762],
    ["Nila Dadar Kangkung", 60000],
    ["Listrik", 51950],
    ["Galon", 30500],
    ["Kuota Smartfren", 125000],
    ["Labbaik", 74300],
    ["Susu SGM", 96900],
    ["Bubur SUN Enza", 20600],
    ["Pegangan 19 September 2026", 200000],
    ["Mainan Enza", 79624],
    ["Mie Ayam Kecamatan", 40000],
    ["Listrik", 20500],
    ["Kelapa Muda dan Warteg", 100000]
  ],
  "2026-09": [
    ["Pegangan Liburan", 500000],
    ["Lele dan Gorengan", 65000],
    ["Cukur BerAC", 25000],
    ["Mie Ayam Terowongan Murah", 23000],
    ["Ketoprak, Tukang Jahit, Galon, Nasi Uduk, Bubur Enza", 200000],
    ["Pegangan Ke Studio Foto", 200000],
    ["Gocar ke Studio Foto", 54500],
    ["Gocar dari Studio Foto", 47000],
    ["Sarapan Nasi Kuning, Lontong", 26000],
    ["Mie Ayam Ayang, Diriku, dan Uwa", 36000],
    ["Ambil Buat Kasbon Uwa 200k", 300000],
    ["Beli Beras Rojolele", 150000],
    ["Kelapa Muda, Cuci Motor, Es Teh, Galon, Uang Layat", 100000],
    ["Dimsum, Es Teh Solo", 100000],
    ["Tukeran Uang Eneng", 10000],
    ["Ambil Buat Kasbon Uwa 100k", 200000],
    ["Susu SGM 1 thn, Air Dingin", 88800],
    ["Jajan Mamah Di Alfamidi", 33700],
    ["Tomoro", 28000],
    ["Nasi Kuning Puri", 18000]
  ],
  "2026-10": [
    ["Pegangan 31 Oktober", 300000],
    ["Truk, Sutra", 104610],
    ["Gojek Isna Ayang", 50000],
    ["Sabun Nuvo", 85000],
    ["Galon Vit, Bubur Sun Enza", 62500],
    ["Beli Android box / ayunan (365k tambahan 85)", 365000],
    ["AI Neuraline", 20000],
    ["Karpet Kamar", 250000]
  ]
};

function monthTitle(monthId) {
  const [year, month] = monthId.split("-").map(Number);
  const start = new Date(year, month - 1, 25);
  const end = new Date(year, month, 24);
  const fmt = (d) => `${d.getDate()} ${d.toLocaleString("en-US", { month: "long" })}`;
  return {
    title: `${start.toLocaleString("en-US", { month: "long" })} ${year}`,
    period: `${fmt(start)} - ${fmt(end)} ${end.getFullYear()}`
  };
}

async function seed() {
  const months = Object.keys(daily);
  console.log(`Seeding ${months.length} months (daily expenses + savings withdrawals)...\n`);

  for (const monthId of months) {
    const ref = doc(db, "budget", monthId);
    const existing = await getDoc(ref);
    const current = existing.exists() ? existing.data() : {};

    const dailyFromSalary = (daily[monthId] || []).map(([name, amount, method]) => ({
      id: id(),
      name,
      amount,
      method: method || ""
    }));

    const savingsWithdrawals = (withdrawals[monthId] || []).map(([purpose, amount]) => ({
      id: id(),
      purpose,
      amount
    }));

    const { title, period } = monthTitle(monthId);

    // Preserve anything already present; only fill what we are seeding.
    const merged = {
      ...current,
      id: monthId,
      title: current.title ?? title,
      period: current.period ?? period,
      husbandIncome: current.husbandIncome ?? 0,
      wifeIncome: current.wifeIncome ?? 0,
      transferToWife: current.transferToWife ?? 0,
      husbandFixed: current.husbandFixed ?? [],
      wifeFixed: current.wifeFixed ?? [],
      dailyFromSalary,
      dailyFromSavings: current.dailyFromSavings ?? [],
      savingsWithdrawals,
      updatedAt: new Date().toISOString()
    };

    await setDoc(ref, merged);
    const totalDaily = dailyFromSalary.reduce((s, e) => s + e.amount, 0);
    const totalSavings = savingsWithdrawals.reduce((s, e) => s + e.amount, 0);
    console.log(
      `✓ ${monthId}: ${dailyFromSalary.length} daily (${totalDaily.toLocaleString("id-ID")})` +
        `, ${savingsWithdrawals.length} savings (${totalSavings.toLocaleString("id-ID")})`
    );
  }

  console.log("\n✅ Done. Data written to Firestore.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
