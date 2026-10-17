// Mumbai place names in Devanagari. Riya writes them this way so the Hindi voice pronounces them properly
// (in English letters it said "Gorgaon"), and the search turns them back into English names before looking
// them up, because the listings and the knowledge base store English names.
export const HINDI_PLACE_NAMES = {
  // Areas (with their East/West forms where callers use them)
  'Lower Parel': 'लोअर परेल', 'Malabar Hill': 'मलबार हिल', 'Napean Sea Road': 'नेपियन सी रोड', 'Peddar Road': 'पेडर रोड', 'Breach Candy': 'ब्रीच कैंडी',
  'Grant Road': 'ग्रांट रोड', 'Marine Lines': 'मरीन लाइन्स', 'Marine Drive': 'मरीन ड्राइव', 'Cuffe Parade': 'कफ़ परेड', 'Nariman Point': 'नरीमन पॉइंट',
  'Mumbai Central': 'मुंबई सेंट्रल', 'Shivaji Park': 'शिवाजी पार्क', 'Vile Parle': 'विले पार्ले', 'Madh Island': 'मढ आइलैंड', 'Mira Road': 'मीरा रोड',
  'Thakur Village': 'ठाकुर विलेज', 'Ghodbunder Road': 'घोडबंदर रोड', 'Kolshet Road': 'कोलशेत रोड', 'Saki Naka': 'साकीनाका', 'Navi Mumbai': 'नवी मुंबई',
  'South Mumbai': 'साउथ मुंबई', 'Hiranandani Gardens': 'हीरानंदानी गार्डन्स', 'Four Bungalows': 'फोर बंगलोज़', 'Seven Bungalows': 'सेवन बंगलोज़',
  Colaba: 'कोलाबा', Churchgate: 'चर्चगेट', Tardeo: 'ताड़देव', Byculla: 'भायखला', Mahalaxmi: 'महालक्ष्मी', Worli: 'वरली', Prabhadevi: 'प्रभादेवी',
  Parel: 'परेल', Sewri: 'शिवड़ी', Wadala: 'वडाला', Dadar: 'दादर', Matunga: 'माटुंगा', Mahim: 'माहिम', Sion: 'सायन', Bandra: 'बांद्रा', Khar: 'खार',
  Santacruz: 'सांताक्रूज़', Kalina: 'कलीना', Juhu: 'जुहू', Andheri: 'अंधेरी', Lokhandwala: 'लोखंडवाला', Versova: 'वर्सोवा', Marol: 'मरोल',
  Chakala: 'चकाला', Jogeshwari: 'जोगेश्वरी', Goregaon: 'गोरेगांव', Malad: 'मालाड', Madh: 'मढ', Marve: 'मार्वे', Kandivali: 'कांदिवली',
  Borivali: 'बोरीवली', Gorai: 'गोराई', Dahisar: 'दहिसर', Bhayandar: 'भायंदर', Kurla: 'कुर्ला', Chembur: 'चेंबूर', Ghatkopar: 'घाटकोपर',
  Vikhroli: 'विक्रोली', Kanjurmarg: 'कांजुरमार्ग', Powai: 'पवई', Chandivali: 'चांदिवली', Bhandup: 'भांडुप', Mulund: 'मुलुंड', Thane: 'ठाणे',
  Majiwada: 'माजीवाड़ा', Kolshet: 'कोलशेत', Ghodbunder: 'घोडबंदर', Palava: 'पलावा', Dombivli: 'डोंबिवली', Vashi: 'वाशी', Airoli: 'ऐरोली',
  Nerul: 'नेरुल', Belapur: 'बेलापुर', Kharghar: 'खारघर', Panvel: 'पनवेल', Mumbai: 'मुंबई', Hiranandani: 'हीरानंदानी',
  // English words (East, West, consultant, options…) are left in English letters: the voices say them well,
  // and "ईस्ट" was misheard as "West" in a test.
};

// Spelling differences that don't change the name: ँ/ं, ी/ि, ू/ु, nukta, and the long ा ("मलाड" = "मालाड").
const loose = (s) => s.replace(/ँ/g, 'ं').replace(/ी/g, 'ि').replace(/ू/g, 'ु').replace(/़/g, '').replace(/ा/g, '');
const ENGLISH = Object.entries(HINDI_PLACE_NAMES)
  .map(([english, hindi]) => [loose(hindi), english])
  .sort((a, b) => b[0].length - a[0].length);

// "गोरेगांव ईस्ट" -> "Goregaon East". Text without Devanagari is returned as it is.
export function toEnglishPlaces(text) {
  const s = (text ?? '').toString();
  if (!/[ऀ-ॿ]/.test(s)) return s;
  let out = loose(s);
  for (const [hindi, english] of ENGLISH) out = out.split(hindi).join(english);
  return out.replace(/ईसट|ईस्ट/g, 'East').replace(/वेस्ट|वसट/g, 'West').replace(/\s+/g, ' ').trim();
}
