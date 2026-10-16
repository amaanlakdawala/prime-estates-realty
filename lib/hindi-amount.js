// Rupee amounts as they are said in Hindi, in Devanagari, for the voice agent to read out as written:
// 5500000 -> "पचपन लाख", 12500000 -> "सवा करोड़", 85000000 -> "साढ़े आठ करोड़", 26000000 -> "दो करोड़ साठ लाख".
// The agent got these wrong when converting digits itself (55,000 as "पचास पाँच हज़ार").

const WORDS = ['', 'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात', 'आठ', 'नौ', 'दस',
  'ग्यारह', 'बारह', 'तेरह', 'चौदह', 'पंद्रह', 'सोलह', 'सत्रह', 'अठारह', 'उन्नीस', 'बीस',
  'इक्कीस', 'बाईस', 'तेईस', 'चौबीस', 'पच्चीस', 'छब्बीस', 'सत्ताईस', 'अट्ठाईस', 'उनतीस', 'तीस',
  'इकतीस', 'बत्तीस', 'तैंतीस', 'चौंतीस', 'पैंतीस', 'छत्तीस', 'सैंतीस', 'अड़तीस', 'उनतालीस', 'चालीस',
  'इकतालीस', 'बयालीस', 'तैंतालीस', 'चवालीस', 'पैंतालीस', 'छियालीस', 'सैंतालीस', 'अड़तालीस', 'उनचास', 'पचास',
  'इक्यावन', 'बावन', 'तिरेपन', 'चौवन', 'पचपन', 'छप्पन', 'सत्तावन', 'अट्ठावन', 'उनसठ', 'साठ',
  'इकसठ', 'बासठ', 'तिरेसठ', 'चौंसठ', 'पैंसठ', 'छियासठ', 'सड़सठ', 'अड़सठ', 'उनहत्तर', 'सत्तर',
  'इकहत्तर', 'बहत्तर', 'तिहत्तर', 'चौहत्तर', 'पचहत्तर', 'छिहत्तर', 'सतहत्तर', 'अठहत्तर', 'उन्यासी', 'अस्सी',
  'इक्यासी', 'बयासी', 'तिरासी', 'चौरासी', 'पचासी', 'छियासी', 'सत्तासी', 'अट्ठासी', 'नवासी', 'नब्बे',
  'इक्यानबे', 'बानबे', 'तिरानबे', 'चौरानबे', 'पचानबे', 'छियानबे', 'सत्तानबे', 'अट्ठानबे', 'निन्यानबे'];

// 1..99 in words; 100..999 as "<n> सौ <rest>".
export function hindiNumber(n) {
  n = Math.floor(n);
  if (n < 100) return WORDS[n];
  const rest = n % 100;
  return `${WORDS[Math.floor(n / 100)]} सौ${rest ? ` ${WORDS[rest]}` : ''}`;
}

// n and a quarter, a half or three quarters of a unit, the way people say it:
// (1, 50) -> "डेढ़", (2, 50) -> "ढाई", (8, 50) -> "साढ़े आठ", (1, 25) -> "सवा", (1, 75) -> "पौने दो".
function withFraction(n, part) {
  if (part === 50) return n === 1 ? 'डेढ़' : n === 2 ? 'ढाई' : `साढ़े ${hindiNumber(n)}`;
  if (part === 25) return n === 1 ? 'सवा' : `सवा ${hindiNumber(n)}`;
  return `पौने ${hindiNumber(n + 1)}`; // 75
}

export function hindiAmount(rupees) {
  const p = Math.round(Number(rupees) || 0);
  const crore = Math.floor(p / 1e7);
  const lakh = Math.floor((p % 1e7) / 1e5);
  const thousand = Math.floor((p % 1e5) / 1e3);
  if (crore) {
    if (!lakh) return `${hindiNumber(crore)} करोड़`;
    if ([25, 50, 75].includes(lakh) && !thousand && crore < 100) return `${withFraction(crore, lakh)} करोड़`;
    return `${hindiNumber(crore)} करोड़ ${hindiNumber(lakh)} लाख`;
  }
  if (lakh) {
    if (!thousand) return `${hindiNumber(lakh)} लाख`;
    if ([25, 50, 75].includes(thousand)) return `${withFraction(lakh, thousand)} लाख`;
    return `${hindiNumber(lakh)} लाख ${hindiNumber(thousand)} हज़ार`;
  }
  if (thousand) {
    const hundred = Math.floor((p % 1e3) / 100);
    return hundred === 5 ? `साढ़े ${hindiNumber(thousand)} हज़ार` : `${hindiNumber(thousand)} हज़ार`;
  }
  return `${hindiNumber(p)} रुपये`;
}
