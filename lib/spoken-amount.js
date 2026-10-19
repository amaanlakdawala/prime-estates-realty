// Prices and sizes written out as English words, the way Mumbai brokers say them on a Hinglish call:
// 18500000 -> "one crore eighty-five lakh", 85000000 -> "eight and a half crore", 55000 -> "fifty-five thousand",
// 780 -> "seven hundred eighty". The voice agent reads them exactly as written: converting digits itself, it
// mixed up amounts ("पचास पाँच हज़ार" for 55,000, a 38,000 flat quoted at 48,000).

const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

// 0..999 in words: 85 -> "eighty-five", 780 -> "seven hundred eighty".
export function englishNumber(n) {
  n = Math.floor(Number(n) || 0);
  if (n === 0) return 'zero';
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '');
  const rest = n % 100;
  return `${ONES[Math.floor(n / 100)]} hundred${rest ? ` ${englishNumber(rest)}` : ''}`;
}

// Bigger whole numbers, Indian style (lakh, crore) where they come up in prices.
function words(n) {
  if (n < 1000) return englishNumber(n);
  if (n < 100000) return `${englishNumber(Math.floor(n / 1000))} thousand${n % 1000 ? ` ${englishNumber(n % 1000)}` : ''}`;
  return String(n);
}

export function englishAmount(rupees) {
  const p = Math.round(Number(rupees) || 0);
  const crore = Math.floor(p / 1e7);
  const lakh = Math.floor((p % 1e7) / 1e5);
  const thousand = Math.floor((p % 1e5) / 1e3);
  if (crore) {
    if (!lakh) return `${words(crore)} crore`;
    if (lakh === 50 && !thousand) return `${words(crore)} and a half crore`;
    return `${words(crore)} crore ${englishNumber(lakh)} lakh`;
  }
  if (lakh) {
    if (!thousand) return `${englishNumber(lakh)} lakh`;
    if (thousand === 50) return `${englishNumber(lakh)} and a half lakh`;
    return `${englishNumber(lakh)} lakh ${englishNumber(thousand)} thousand`;
  }
  if (thousand) return words(p - (p % 100));
  return `${englishNumber(p)} rupees`;
}

// Sizes the way people say them: 780 -> "seven hundred eighty", 1150 -> "eleven hundred fifty",
// 2400 -> "twenty-four hundred"; from 10,000 up in thousands.
export function englishSize(n) {
  n = Math.round(Number(n) || 0);
  if (n >= 1000 && n < 10000 && n % 100 === 0 && n % 1000 !== 0) return `${englishNumber(n / 100)} hundred`;
  if (n >= 1000 && n < 10000 && n % 1000 !== 0) return `${englishNumber(Math.floor(n / 100))} hundred${n % 100 ? ` ${englishNumber(n % 100)}` : ''}`;
  return words(n);
}
