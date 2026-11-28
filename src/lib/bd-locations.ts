export interface DivisionData {
  name: string;
  nameBn: string;
  districts: {
    name: string;
    nameBn: string;
    upazilas: string[];
  }[];
}

export const BD_DIVISIONS: DivisionData[] = [
  {
    name: 'Dhaka',
    nameBn: 'ঢাকা',
    districts: [
      {name: 'Dhaka', nameBn: 'ঢাকা', upazilas: ['Banani', 'Gulshan', 'Dhanmondi', 'Mirpur', 'Uttara', 'Mohammadpur', 'Motijheel', 'Badda', 'Savar', 'Keraniganj']},
      {name: 'Gazipur', nameBn: 'গাজীপুর', upazilas: ['Gazipur Sadar', 'Tongi', 'Kaliakair', 'Kaliganj', 'Kapasia', 'Sreepur']},
      {name: 'Narayanganj', nameBn: 'নারায়ণগঞ্জ', upazilas: ['Narayanganj Sadar', 'Fatullah', 'Siddhirganj', 'Bandar', 'Rupganj', 'Sonargaon']},
      {name: 'Tangail', nameBn: 'টাঙ্গাইল', upazilas: ['Tangail Sadar', 'Mirzapur', 'Madhupur', 'Sakhipur', 'Kalihati']},
      {name: 'Narsingdi', nameBn: 'নরসিংদী', upazilas: ['Narsingdi Sadar', 'Palash', 'Raipura', 'Shibpur']},
      {name: 'Manikganj', nameBn: 'মানিকগঞ্জ', upazilas: ['Manikganj Sadar', 'Singair', 'Saturia']},
      {name: 'Munshiganj', nameBn: 'মুন্সিগঞ্জ', upazilas: ['Munshiganj Sadar', 'Sreenagar', 'Lohajang']},
      {name: 'Kishoreganj', nameBn: 'কিশোরগঞ্জ', upazilas: ['Kishoreganj Sadar', 'Bhairab', 'Bajitpur']},
      {name: 'Faridpur', nameBn: 'ফরিদপুর', upazilas: ['Faridpur Sadar', 'Bhanga', 'Boalmari']},
      {name: 'Gopalganj', nameBn: 'গোপালগঞ্জ', upazilas: ['Gopalganj Sadar', 'Tungipara', 'Kotalipara']},
      {name: 'Madaripur', nameBn: 'মাদারীপুর', upazilas: ['Madaripur Sadar', 'Shibchar', 'Kalkini']},
      {name: 'Rajbari', nameBn: 'রাজবাড়ী', upazilas: ['Rajbari Sadar', 'Pangsha', 'Goalanda']},
      {name: 'Shariatpur', nameBn: 'শরীয়তপুর', upazilas: ['Shariatpur Sadar', 'Naria', 'Zajira']},
    ],
  },
  {
    name: 'Chattogram',
    nameBn: 'চট্টগ্রাম',
    districts: [
      {name: 'Chattogram', nameBn: 'চট্টগ্রাম', upazilas: ['Panchlaish', 'Kotwali', 'Halishahar', 'Agrabad', 'Pahartali', 'Patenga', 'Sitakunda', 'Patiya']},
      {name: "Cox's Bazar", nameBn: 'কক্সবাজার', upazilas: ["Cox's Bazar Sadar", 'Teknaf', 'Ukhiya', 'Chakaria']},
      {name: 'Cumilla', nameBn: 'কুমিল্লা', upazilas: ['Cumilla Sadar', 'Daudkandi', 'Chandina', 'Laksam']},
      {name: 'Feni', nameBn: 'ফেনী', upazilas: ['Feni Sadar', 'Chhagalnaiya', 'Daganbhuiyan']},
      {name: 'Noakhali', nameBn: 'নোয়াখালী', upazilas: ['Maijdee', 'Begumganj', 'Companiganj']},
      {name: 'Brahmanbaria', nameBn: 'ব্রাহ্মণবাড়িয়া', upazilas: ['Brahmanbaria Sadar', 'Ashuganj', 'Kasba']},
      {name: 'Chandpur', nameBn: 'চাঁদপুর', upazilas: ['Chandpur Sadar', 'Hajiganj', 'Matlab']},
      {name: 'Lakshmipur', nameBn: 'লক্ষ্মীপুর', upazilas: ['Lakshmipur Sadar', 'Raipur', 'Ramganj']},
      {name: 'Rangamati', nameBn: 'রাঙ্গামাটি', upazilas: ['Rangamati Sadar', 'Kaptai']},
      {name: 'Bandarban', nameBn: 'বান্দরবান', upazilas: ['Bandarban Sadar', 'Lama']},
      {name: 'Khagrachari', nameBn: 'খাগড়াছড়ি', upazilas: ['Khagrachari Sadar', 'Dighinala']},
    ],
  },
  {
    name: 'Sylhet',
    nameBn: 'সিলেট',
    districts: [
      {name: 'Sylhet', nameBn: 'সিলেট', upazilas: ['Sylhet Sadar', 'Zindabazar', 'Amberkhana', 'Beanibazar', 'Golapganj']},
      {name: 'Moulvibazar', nameBn: 'মৌলভীবাজার', upazilas: ['Moulvibazar Sadar', 'Sreemangal', 'Kulaura']},
      {name: 'Habiganj', nameBn: 'হবিগঞ্জ', upazilas: ['Habiganj Sadar', 'Nabiganj', 'Bahubal']},
      {name: 'Sunamganj', nameBn: 'সুনামগঞ্জ', upazilas: ['Sunamganj Sadar', 'Chhatak', 'Jagannathpur']},
    ],
  },
  {
    name: 'Rajshahi',
    nameBn: 'রাজশাহী',
    districts: [
      {name: 'Rajshahi', nameBn: 'রাজশাহী', upazilas: ['Boalia', 'Motihar', 'Rajpara', 'Paba', 'Godagari']},
      {name: 'Bogura', nameBn: 'বগুড়া', upazilas: ['Bogura Sadar', 'Sherpur', 'Shibganj']},
      {name: 'Pabna', nameBn: 'পাবনা', upazilas: ['Pabna Sadar', 'Ishwardi', 'Bera']},
      {name: 'Sirajganj', nameBn: 'সিরাজগঞ্জ', upazilas: ['Sirajganj Sadar', 'Ullapara', 'Shahjadpur']},
      {name: 'Naogaon', nameBn: 'নওগাঁ', upazilas: ['Naogaon Sadar', 'Mohadevpur']},
      {name: 'Natore', nameBn: 'নাটোর', upazilas: ['Natore Sadar', 'Singra']},
      {name: 'Chapainawabganj', nameBn: 'চাঁপাইনবাবগঞ্জ', upazilas: ['Chapainawabganj Sadar', 'Shibganj']},
      {name: 'Joypurhat', nameBn: 'জয়পুরহাট', upazilas: ['Joypurhat Sadar', 'Kalai']},
    ],
  },
  {
    name: 'Khulna',
    nameBn: 'খুলনা',
    districts: [
      {name: 'Khulna', nameBn: 'খুলনা', upazilas: ['Khulna Sadar', 'Sonadanga', 'Khalishpur', 'Daulatpur']},
      {name: 'Jashore', nameBn: 'যশোর', upazilas: ['Jashore Sadar', 'Benapole', 'Jhikargacha']},
      {name: 'Kushtia', nameBn: 'কুষ্টিয়া', upazilas: ['Kushtia Sadar', 'Kumarkhali', 'Bheramara']},
      {name: 'Satkhira', nameBn: 'সাতক্ষীরা', upazilas: ['Satkhira Sadar', 'Tala', 'Kaliganj']},
      {name: 'Bagerhat', nameBn: 'বাগেরহাট', upazilas: ['Bagerhat Sadar', 'Mongla']},
      {name: 'Jhenaidah', nameBn: 'ঝিনাইদহ', upazilas: ['Jhenaidah Sadar', 'Kaliganj']},
      {name: 'Chuadanga', nameBn: 'চুয়াডাঙ্গা', upazilas: ['Chuadanga Sadar', 'Alamdanga']},
      {name: 'Magura', nameBn: 'মাগুরা', upazilas: ['Magura Sadar', 'Sreepur']},
      {name: 'Meherpur', nameBn: 'মেহেরপুর', upazilas: ['Meherpur Sadar', 'Gangni']},
      {name: 'Narail', nameBn: 'নড়াইল', upazilas: ['Narail Sadar', 'Lohagara']},
    ],
  },
  {
    name: 'Barishal',
    nameBn: 'বরিশাল',
    districts: [
      {name: 'Barishal', nameBn: 'বরিশাল', upazilas: ['Barishal Sadar', 'Bakerganj', 'Banaripara']},
      {name: 'Patuakhali', nameBn: 'পটুয়াখালী', upazilas: ['Patuakhali Sadar', 'Kalapara']},
      {name: 'Bhola', nameBn: 'ভোলা', upazilas: ['Bhola Sadar', 'Char Fasson']},
      {name: 'Pirojpur', nameBn: 'পিরোজপুর', upazilas: ['Pirojpur Sadar', 'Mathbaria']},
      {name: 'Jhalokati', nameBn: 'ঝালকাঠি', upazilas: ['Jhalokati Sadar', 'Nalchity']},
      {name: 'Barguna', nameBn: 'বরগুনা', upazilas: ['Barguna Sadar', 'Amtali']},
    ],
  },
  {
    name: 'Rangpur',
    nameBn: 'রংপুর',
    districts: [
      {name: 'Rangpur', nameBn: 'রংপুর', upazilas: ['Rangpur Sadar', 'Mithapukur', 'Pirganj']},
      {name: 'Dinajpur', nameBn: 'দিনাজপুর', upazilas: ['Dinajpur Sadar', 'Birampur', 'Parbatipur']},
      {name: 'Kurigram', nameBn: 'কুড়িগ্রাম', upazilas: ['Kurigram Sadar', 'Ulipur']},
      {name: 'Gaibandha', nameBn: 'গাইবান্ধা', upazilas: ['Gaibandha Sadar', 'Gobindaganj']},
      {name: 'Nilphamari', nameBn: 'নীলফামারী', upazilas: ['Nilphamari Sadar', 'Saidpur']},
      {name: 'Lalmonirhat', nameBn: 'লালমনিরহাট', upazilas: ['Lalmonirhat Sadar', 'Patgram']},
      {name: 'Thakurgaon', nameBn: 'ঠাকুরগাঁও', upazilas: ['Thakurgaon Sadar', 'Pirganj']},
      {name: 'Panchagarh', nameBn: 'পঞ্চগড়', upazilas: ['Panchagarh Sadar', 'Tetulia']},
    ],
  },
  {
    name: 'Mymensingh',
    nameBn: 'ময়মনসিংহ',
    districts: [
      {name: 'Mymensingh', nameBn: 'ময়মনসিংহ', upazilas: ['Mymensingh Sadar', 'Trishal', 'Bhaluka', 'Muktagacha']},
      {name: 'Jamalpur', nameBn: 'জামালপুর', upazilas: ['Jamalpur Sadar', 'Sarishabari']},
      {name: 'Netrokona', nameBn: 'নেত্রকোনা', upazilas: ['Netrokona Sadar', 'Kendua']},
      {name: 'Sherpur', nameBn: 'শেরপুর', upazilas: ['Sherpur Sadar', 'Nakla']},
    ],
  },
];

export const BD_PHONE_REGEX = /^(?:\+?880|0)1[3-9]\d{8}$/;

export function normalizeBdPhone(phone: string): string {
  const cleaned = phone.replace(/[\s-]/g, '');
  if (cleaned.startsWith('+880')) return cleaned;
  if (cleaned.startsWith('880')) return `+${cleaned}`;
  if (cleaned.startsWith('01')) return `+88${cleaned}`;
  return cleaned;
}

export function formatBDT(amount: number): string {
  const rounded = Math.round(amount);
  return `৳${rounded.toLocaleString('en-US')}`;
}

export function getWhatsAppUrl(phoneOrUrl?: string): string {
  const raw = (phoneOrUrl || '01996266204').trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('880')) return `https://wa.me/${digits}`;
  if (digits.startsWith('01')) return `https://wa.me/88${digits}`;
  return digits ? `https://wa.me/${digits}` : 'https://wa.me/8801996266204';
}

export function getInstagramUrl(handleOrUrl?: string): string {
  const raw = (handleOrUrl || '').trim();
  if (!raw) return 'https://www.instagram.com/';
  if (/^https?:\/\//i.test(raw)) return raw;
  const cleanHandle = raw.replace(/^@+/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/+$/, '');
  return cleanHandle ? `https://www.instagram.com/${cleanHandle}/` : 'https://www.instagram.com/';
}

export function formatDhakaDateTime(value: unknown): string {
  let date: Date;
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as {toDate: () => Date}).toDate === 'function') {
    date = (value as {toDate: () => Date}).toDate();
  } else if (typeof value === 'string' || typeof value === 'number') {
    date = new Date(value);
  } else {
    date = new Date();
  }
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-BD', {
    timeZone: 'Asia/Dhaka',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
