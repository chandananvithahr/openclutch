// Indian merchant categorizer — expense-tracker TransactionCategorizer.kt pattern
// Priority: income keywords → transfer detection → merchant map → pattern fallback

'use strict';

// 150+ Indian merchants pre-mapped by category
const MERCHANT_CATEGORY_MAP = {
  // Food delivery
  zomato: 'food_delivery', swiggy: 'food_delivery', dunzo: 'food_delivery',
  zepto: 'food_delivery', blinkit: 'food_delivery', bigbasket: 'food_delivery',
  grofers: 'food_delivery', jiomart: 'food_delivery', instamart: 'food_delivery',

  // Dining
  mcdonalds: 'dining_out', kfc: 'dining_out', dominos: 'dining_out',
  'pizza hut': 'dining_out', 'burger king': 'dining_out', subway: 'dining_out',
  starbucks: 'dining_out', 'cafe coffee day': 'dining_out', ccd: 'dining_out',

  // Shopping
  amazon: 'shopping', flipkart: 'shopping', myntra: 'shopping',
  meesho: 'shopping', ajio: 'shopping', snapdeal: 'shopping',
  nykaa: 'shopping', croma: 'shopping', reliance: 'shopping',
  tatacliq: 'shopping', shopsy: 'shopping',

  // Transport
  uber: 'transport', ola: 'transport', rapido: 'transport',
  meru: 'transport', yulu: 'transport', bounce: 'transport',
  irctc: 'transport', makemytrip: 'transport', goibibo: 'transport',
  cleartrip: 'transport', redbus: 'transport', abhibus: 'transport',

  // Fuel
  iocl: 'fuel', 'indian oil': 'fuel', bpcl: 'fuel',
  'bharat petroleum': 'fuel', hpcl: 'fuel', 'hindustan petroleum': 'fuel',
  petronas: 'fuel', shell: 'fuel', essar: 'fuel',

  // Subscriptions
  netflix: 'subscriptions', hotstar: 'subscriptions', amazon_prime: 'subscriptions',
  prime: 'subscriptions', spotify: 'subscriptions', youtube: 'subscriptions',
  apple: 'subscriptions', jio: 'subscriptions', airtel: 'subscriptions',
  vodafone: 'subscriptions', bsnl: 'subscriptions', tata_play: 'subscriptions',
  zee5: 'subscriptions', sonyliv: 'subscriptions', voot: 'subscriptions',
  mxplayer: 'subscriptions', bookmyshow: 'subscriptions',

  // Health
  pharmeasy: 'health', '1mg': 'health', medplus: 'health',
  netmeds: 'health', apollo: 'health', fortis: 'health',
  manipal: 'health', max: 'health', care: 'health',

  // Bills / Utilities
  bescom: 'bills', mseb: 'bills', bses: 'bills',
  tata_power: 'bills', torrent: 'bills', adani: 'bills',
  mahanagar: 'bills', cesc: 'bills',

  // Investments
  zerodha: 'investments', zerodha_fund: 'investments',
  'angel one': 'investments', angelbroking: 'investments',
  motilaloswal: 'investments', groww: 'investments', upstox: 'investments',
  kuvera: 'investments', etmoney: 'investments', paytm_money: 'investments',
  nse: 'investments', bse: 'investments', cdsl: 'investments',
  nsdl: 'investments', amfi: 'investments',

  // EMI / Loans
  hdfc_bank: 'emi_loan', sbi: 'emi_loan', icici: 'emi_loan',
  axis: 'emi_loan', kotak: 'emi_loan', bajaj: 'emi_loan',
  fullerton: 'emi_loan', muthoot: 'emi_loan', mahindra_fin: 'emi_loan',
  indusind: 'emi_loan', yes_bank: 'emi_loan',
};

// Keywords for income detection (CREDIT type)
const INCOME_KEYWORDS = [
  'salary', 'sal ', 'sal/', 'payroll', 'stipend',
  'bonus', 'incentive', 'arrear', 'da ', 'hra ',
  'reimbursement', 'refund', 'cashback', 'interest credit',
  'dividend', 'maturity',
];

// Keywords for self-transfer detection
const TRANSFER_KEYWORDS = [
  'self', 'own account', 'neft to self', 'imps to self',
  'transfer to', 'trf to', 'fd ', 'rd ', 'sweep',
];

// Pattern-based fallback categories (keyword → category)
const PATTERN_KEYWORDS = [
  { keywords: ['food', 'restaurant', 'cafe', 'hotel', 'dine', 'eat'], category: 'dining_out' },
  { keywords: ['grocery', 'supermarket', 'mart', 'kirana'], category: 'food_delivery' },
  { keywords: ['petrol', 'diesel', 'fuel', 'gas station'], category: 'fuel' },
  { keywords: ['cab', 'taxi', 'auto', 'metro', 'bus', 'flight', 'train'], category: 'transport' },
  { keywords: ['medical', 'hospital', 'clinic', 'doctor', 'pharmacy', 'medicine'], category: 'health' },
  { keywords: ['electricity', 'water bill', 'gas bill', 'broadband', 'dth', 'recharge'], category: 'bills' },
  { keywords: ['emi', 'loan', 'finance', 'equated'], category: 'emi_loan' },
  { keywords: ['mutual fund', 'sip', 'equity', 'stock', 'demat', 'invest'], category: 'investments' },
  { keywords: ['subscription', 'plan', 'pack', 'membership'], category: 'subscriptions' },
  { keywords: ['amazon', 'flipkart', 'myntra', 'order', 'purchase', 'buy'], category: 'shopping' },
];

function normalize(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

function categorize(merchant, message, txnType) {
  const normMerchant = normalize(merchant);
  const normMessage = normalize(message || '');

  // 1. Income detection (CREDIT + income keywords)
  if (txnType === 'credit') {
    for (const kw of INCOME_KEYWORDS) {
      if (normMerchant.includes(kw) || normMessage.includes(kw)) {
        return 'salary';
      }
    }
  }

  // 2. Transfer detection
  for (const kw of TRANSFER_KEYWORDS) {
    if (normMerchant.includes(kw) || normMessage.includes(kw)) {
      return 'transfer';
    }
  }

  // 3. Merchant map lookup (substring match — expense-tracker approach)
  for (const [key, category] of Object.entries(MERCHANT_CATEGORY_MAP)) {
    if (normMerchant.includes(key) || normMessage.includes(key)) {
      return category;
    }
  }

  // 4. Pattern-based keyword fallback
  for (const { keywords, category } of PATTERN_KEYWORDS) {
    for (const kw of keywords) {
      if (normMerchant.includes(kw) || normMessage.includes(kw)) {
        return category;
      }
    }
  }

  return 'others';
}

module.exports = { categorize };
