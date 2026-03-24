// SMS Parser — Artha Agent (Expanded)
// Reads ALL spending SMS: banks, UPI, credit cards, food apps, pharma, wallets
// Filters out fraud/spam/OTP/promo messages
// Legal: user grants READ_SMS permission explicitly

import { Platform, PermissionsAndroid } from 'react-native';
import SmsAndroid from 'react-native-get-sms-android';
import BACKEND_URL from './config';

// ========== KNOWN SENDERS ==========
// Banks, credit cards, UPI apps, wallets, food apps, pharma, subscriptions
const KNOWN_SENDERS = [
  // Banks
  'HDFCBK', 'HDFC', 'SBIINB', 'SBI', 'ICICIB', 'ICICI',
  'AXISBK', 'AXIS', 'KOTAKB', 'KOTAK', 'INDUSB', 'INDUS',
  'YESBNK', 'PNBSMS', 'PNB', 'BOIIND', 'BOI', 'CENTBK',
  'IDFCFB', 'IDFC', 'FEDERL', 'CANBNK', 'UNIONB', 'BOBSMS',
  'SCBL', 'CITI', 'AMEXIN', 'RBLBNK', 'AUBANK',
  // Credit Cards
  'HDFCCC', 'SBICARD', 'ICICIC', 'AXISCC', 'KOTAKCC',
  'AMEX', 'RUPAY', 'ONECARD',
  // UPI / Wallets
  'PAYTMB', 'PAYTM', 'PYTM1', 'PHONEPE', 'PHONPE',
  'GPAY', 'GOOGLEPAY', 'BFRUPE', // BharatPe
  'MOBIKW', 'FREECHARGE', 'AIRTEL', 'JIOMNY',
  // Food / Delivery
  'SWIGGY', 'ZOMATO', 'BLINKT', 'BLINKIT', 'ZEPTO',
  'DUNZO', 'BIGBSK', 'GROFERS', 'INMART', 'JIOMART',
  // E-commerce
  'AMAZON', 'AMZN', 'FLIPKRT', 'FLIPKART', 'MYNTRA',
  'MEESHO', 'NYKAA', 'AJIO', 'TATACLQ',
  // Subscriptions
  'NETFLIX', 'SPOTIFY', 'HOTSTR', 'PRIMEV',
  // Transport
  'UBER', 'OLACAB', 'RAPIDO', 'IRCTC', 'REDBUS',
  // Pharma / Health
  'PHARMEASY', 'ONEMG', '1MG', 'APOLLO', 'NETMED', 'MEDPLUS',
  'TATAHLTH', 'PRACTO',
  // Bills / Recharge
  'BESCOM', 'TATAPOW', 'JIOFIBER', 'AIRTELB',
  // Insurance / Finance
  'POLICYBZ', 'ZERODHA', 'GROWW', 'UPSTOX', 'KUVERA',
  'MUTUALFND', 'LICIND', 'STARHLTH',
];

// ========== FRAUD / SPAM FILTER ==========
// These patterns indicate SMS is NOT a real transaction
const FRAUD_PATTERNS = [
  /you have won/i,
  /lottery/i,
  /congratulations.*prize/i,
  /click here to claim/i,
  /your account.*blocked.*call/i,
  /KYC.*expire.*immediately/i,
  /update KYC.*link/i,
  /suspended.*verify/i,
  /loan approved.*click/i,
  /pre-?approved.*personal loan/i,
  /credit limit.*increased.*click/i,
  /bit\.ly|tinyurl|short\.link|cutt\.ly/i, // shortened URLs = suspicious
  /whatsapp.*\+91/i, // "contact on WhatsApp" = scam
];

// These are NOT transactions — skip them
const SKIP_PATTERNS = [
  /\bOTP\b/i,
  /one.?time.?password/i,
  /verification code/i,
  /login code/i,
  /\bPIN\b.*reset/i,
  /your code is/i,
  /offer|cashback.*flat|coupon|discount.*%|promo/i, // marketing
  /apply now|download app|install/i, // promos
  /EMI.*convert|convert.*EMI/i, // EMI conversion offers (not actual transactions)
  /credit limit.*enhanced/i,
  /reward points/i,
  /minimum amount due/i, // bill reminder, not transaction
  /payment due date/i,
  /thank you for.*payment/i, // confirmation, not debit
];

// ========== DEBIT PATTERNS ==========
// Ordered by specificity — first match wins
const DEBIT_PATTERNS = [
  // HDFC Bank: "INR 2,450 debited from A/C **1234 at SWIGGY"
  { bank: 'HDFC', regex: /INR\s+([\d,]+(?:\.\d{1,2})?)\s+(?:debited|withdrawn|spent).*?(?:at|Info:|to|for)\s+([A-Za-z0-9 &._/-]+?)(?:\s*\.\s*Avl|\s+on\s+\d|\s+Ref|\s+Avl|$)/i },

  // SBI: "Rs.1840.50 debited ... Transaction: PhonePe SBI card"
  { bank: 'SBI', regex: /Rs\.?([\d,]+(?:\.\d{1,2})?)\s+debited.*?(?:Transaction:|Info:|Txn:)\s*([A-Za-z0-9 &._/-]+?)(?:\.\s*Avail|\.\s*Bal|\.\s*If|$)/i },

  // ICICI: "Rs 500.00 debited from Acct XX4567; ZOMATO"
  { bank: 'ICICI', regex: /Rs\.?\s*([\d,]+(?:\.\d{1,2})?)\s+debited.*?;\s*([A-Za-z0-9 &._/-]+?)(?:\s*\.\s*UPI|\s+on|\s+Ref|\.|$)/i },

  // Axis: "INR 350 debited from Axis Bank a/c for UBER INDIA"
  { bank: 'Axis', regex: /INR\s+([\d,]+(?:\.\d{1,2})?)\s+(?:debited|withdrawn).*?(?:for|at|to)\s+([A-Za-z0-9 &._/-]+?)(?:\s+on\s+\d|\s+Ref|\.\s|$)/i },

  // Kotak: "Rs.1299 debited from Kotak account at NETFLIX"
  { bank: 'Kotak', regex: /Rs\.?\s*([\d,]+(?:\.\d{1,2})?)\s+(?:has been\s+)?debited.*?(?:at|merchant:?|to|for)\s*([A-Za-z0-9 &._/-]+?)(?:\.\s*Bal|\.\s*Avail|\s*\.|$)/i },

  // Credit Card: "Rs 5,000 spent on HDFC Credit Card at AMAZON"
  { bank: 'CC', regex: /Rs\.?\s*([\d,]+(?:\.\d{1,2})?)\s+(?:spent|charged|debited).*?(?:card|CC).*?(?:at|on|for)\s+([A-Za-z0-9 &._/-]+?)(?:\s+on\s+\d|\.\s|$)/i },

  // Credit Card: "Thank you for spending Rs 1,500 at ZOMATO using HDFC Card"
  { bank: 'CC', regex: /spending\s+Rs\.?\s*([\d,]+(?:\.\d{1,2})?)\s+(?:at|on|for)\s+([A-Za-z0-9 &._/-]+?)(?:\s+using|\.\s|$)/i },

  // PhonePe/GPay: "Paid Rs.500 to SWIGGY" or "Sent Rs.200 to merchant"
  { bank: 'UPI', regex: /(?:paid|sent)\s+Rs\.?\s*([\d,]+(?:\.\d{1,2})?)\s+(?:to|for|at)\s+([A-Za-z0-9 &._/-]+?)(?:\s+via|\s+UPI|\s+Ref|\.|\s+on|$)/i },

  // UPI: "Debited Rs.150 from wallet/bank for AMAZON PAY"
  { bank: 'UPI', regex: /(?:debited)\s+Rs\.?\s*([\d,]+(?:\.\d{1,2})?)\s+.*?(?:to|for)\s+([A-Za-z0-9 &._/-]+?)(?:\s+via|\s+Ref|\.|\s+on|$)/i },

  // Wallet: "Rs 100 deducted from Paytm Wallet for UBER"
  { bank: 'Wallet', regex: /Rs\.?\s*([\d,]+(?:\.\d{1,2})?)\s+(?:deducted|debited).*?(?:wallet|balance).*?(?:for|at|to)\s+([A-Za-z0-9 &._/-]+?)(?:\.\s|\s+Ref|$)/i },

  // Swiggy/Zomato direct: "Your order of Rs.450 from BIRYANI HOUSE"
  { bank: 'App', regex: /order.*?Rs\.?\s*([\d,]+(?:\.\d{1,2})?)\s+.*?(?:from|at)\s+([A-Za-z0-9 &._/-]+?)(?:\s+has|\s+is|\.\s|$)/i },

  // EMI/Loan: "EMI of Rs 15,000 debited for HOME LOAN"
  { bank: 'EMI', regex: /EMI.*?Rs\.?\s*([\d,]+(?:\.\d{1,2})?)\s+(?:debited|deducted|paid).*?(?:for|towards)\s+([A-Za-z0-9 &._/-]+?)(?:\.\s|\s+Ref|$)/i },

  // Insurance: "Rs 5000 debited for STAR HEALTH premium"
  { bank: 'Insurance', regex: /Rs\.?\s*([\d,]+(?:\.\d{1,2})?)\s+(?:debited|paid|deducted).*?(?:premium|insurance).*?(?:for|to|of)\s+([A-Za-z0-9 &._/-]+?)(?:\.\s|$)/i },

  // Generic: any "debited/spent/paid INR/Rs amount ... at/for/to MERCHANT"
  { bank: 'Bank', regex: /(?:debited|withdrawn|spent|paid|charged)\s+(?:INR|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?).*?(?:at|for|to|merchant:?|Info:)\s*([A-Za-z0-9 &._/-]{2,}?)(?:\s*[.\s]|\s+on\s+\d|\s+Ref|$)/i },

  // Reverse: "MERCHANT ... Rs 500 ... debited/paid"
  { bank: 'Bank', regex: /(?:INR|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)\s+.*?(?:debited|withdrawn|spent|paid|charged).*?(?:at|for|to)\s+([A-Za-z0-9 &._/-]{2,}?)(?:\s*[.\s]|\s+Ref|$)/i },
];

// ========== EXPANDED CATEGORIZATION ==========
function categorize(merchant) {
  const m = merchant.toLowerCase();

  // Food delivery
  if (/swiggy|zomato|uber eats|faasos|box8|dunzo|eatsure|eatclub/.test(m)) return 'food_delivery';
  // Quick commerce / Grocery
  if (/blinkit|zepto|bigbasket|grofers|jiomart|instamart|dmart|nature.?basket/.test(m)) return 'groceries';
  // Dining out
  if (/restaurant|cafe|hotel|biryani|pizza|burger|dhaba|kfc|mcdonald|domino|starbucks|chaayos/.test(m)) return 'dining_out';
  // Shopping
  if (/amazon|flipkart|myntra|ajio|meesho|nykaa|jiomart|tatacliq|croma|reliance/.test(m)) return 'shopping';
  // Fuel
  if (/petrol|fuel|hp\s|bpcl|iocl|shell|indian.?oil/.test(m)) return 'fuel';
  // Transport
  if (/uber|ola|rapido|metro|irctc|redbus|makemytrip|goibibo|yatra|indigo|spicejet|vistara/.test(m)) return 'transport';
  // Subscriptions
  if (/netflix|hotstar|spotify|youtube|prime|jiocinema|zee5|sonyliv|apple|google play|icloud/.test(m)) return 'subscriptions';
  // Health / Pharma
  if (/hospital|pharmacy|pharmeasy|1mg|netmeds|medplus|apollo|practo|tata.*health|dr\./.test(m)) return 'health';
  // Bills / Utilities
  if (/electricity|bescom|tata power|water|gas|broadband|jio|airtel|bsnl|act\s|wifi|internet/.test(m)) return 'bills';
  // Investments
  if (/sip|mutual fund|zerodha|groww|angel|upstox|kuvera|coin|smallcase/.test(m)) return 'investments';
  // EMI / Loan
  if (/emi|loan|hdfc bank|sbi|icici|axis bank|kotak bank|bajaj fin|manappuram/.test(m)) return 'emi_loan';
  // Insurance
  if (/insurance|lic|star health|hdfc ergo|icici lombard|policy.?bazaar/.test(m)) return 'insurance';
  // Education
  if (/school|college|university|course|udemy|coursera|unacademy|byju|upgrad/.test(m)) return 'education';
  // Rent
  if (/rent|landlord|housing|pg\s|hostel|nobroker|magicbricks/.test(m)) return 'rent';

  return 'others';
}

// ========== HELPERS ==========

function parseAmount(raw) {
  return parseFloat(raw.replace(/,/g, ''));
}

function extractDate(smsBody, smsDate) {
  const patterns = [
    /(\d{2}[-/]\d{2}[-/]\d{2,4})/,
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*\d{2,4})/i,
    /(\d{2}(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\d{2,4})/i,
  ];
  for (const p of patterns) {
    const match = smsBody.match(p);
    if (match) {
      try {
        const d = new Date(match[1]);
        if (!isNaN(d)) return d.toISOString().slice(0, 10);
      } catch {}
    }
  }
  return new Date(smsDate || Date.now()).toISOString().slice(0, 10);
}

function buildTxnHash(amount, date, merchant) {
  const normalized = `${amount}_${date}_${(merchant || '').toLowerCase().replace(/\s+/g, '').slice(0, 12)}`;
  let h = 0;
  for (let i = 0; i < normalized.length; i++) {
    h = ((h << 5) - h) + normalized.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(16);
}

function detectBank(address) {
  const a = address.toUpperCase();
  if (a.includes('HDFC')) return 'HDFC';
  if (a.includes('SBI')) return 'SBI';
  if (a.includes('ICICI')) return 'ICICI';
  if (a.includes('AXIS')) return 'Axis';
  if (a.includes('KOTAK')) return 'Kotak';
  if (a.includes('PAYTM')) return 'Paytm';
  if (a.includes('PHONEPE') || a.includes('PHONPE')) return 'PhonePe';
  if (a.includes('GPAY') || a.includes('GOOGLE')) return 'GPay';
  if (a.includes('IDFC')) return 'IDFC';
  if (a.includes('INDUS')) return 'IndusInd';
  if (a.includes('YES')) return 'Yes Bank';
  if (a.includes('CITI')) return 'Citi';
  if (a.includes('AMEX')) return 'Amex';
  if (a.includes('RBL')) return 'RBL';
  if (a.includes('AU')) return 'AU Bank';
  return 'Bank';
}

// ========== MAIN PARSER ==========

function parseSms(sms) {
  const body = sms.body || '';
  const address = (sms.address || '').toUpperCase();

  // Step 1: Check if from a known sender
  const isKnown = KNOWN_SENDERS.some(s => address.includes(s));
  if (!isKnown) return null;

  // Step 2: Fraud filter — reject scam/phishing SMS
  for (const pattern of FRAUD_PATTERNS) {
    if (pattern.test(body)) return null;
  }

  // Step 3: Skip non-transaction SMS (OTP, promos, reminders)
  for (const pattern of SKIP_PATTERNS) {
    if (pattern.test(body)) return null;
  }

  // Step 4: Skip credits (salary, refunds) — only track spending
  const isCredit = /credited|received|deposited|refund.*processed/i.test(body) && !/debited|spent|paid|charged/i.test(body);
  if (isCredit) return null;

  // Step 5: Try each debit pattern
  for (const { bank, regex } of DEBIT_PATTERNS) {
    const match = body.match(regex);
    if (match) {
      const amount = parseAmount(match[1]);
      if (isNaN(amount) || amount <= 0 || amount > 1000000) continue;

      const merchant = match[2]
        .trim()
        .replace(/[^A-Za-z0-9 &._/-]/g, '')
        .replace(/\s+/g, ' ')
        .slice(0, 50);

      if (!merchant || merchant.length < 2) continue;

      const date = extractDate(body, sms.date || Date.now());
      const detectedBank = (bank === 'Bank' || bank === 'UPI' || bank === 'CC' || bank === 'App' || bank === 'Wallet')
        ? detectBank(address)
        : bank;

      return {
        amount,
        merchant,
        bank: detectedBank,
        type: 'debit',
        category: categorize(merchant),
        date,
        hash: buildTxnHash(amount, date, merchant),
      };
    }
  }

  return null;
}

// ========== EXPORTS ==========

export async function requestSmsPermission() {
  if (Platform.OS !== 'android') return false;
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.READ_SMS,
    {
      title: 'Clutch needs SMS access',
      message:
        'Clutch reads bank & payment SMS to auto-track your spending. ' +
        'Only transaction details are stored — never raw SMS content.',
      buttonPositive: 'Allow',
      buttonNegative: 'Not Now',
    }
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

export async function syncSmsTransactions(userId = 'default_user') {
  if (Platform.OS !== 'android') return { synced: 0 };

  const hasPermission = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.READ_SMS
  );
  if (!hasPermission) return { error: 'SMS permission not granted' };

  // Read last 1000 SMS (covers ~3-4 months)
  const filter = { box: 'inbox', maxCount: 1000 };

  return new Promise((resolve) => {
    SmsAndroid.list(
      JSON.stringify(filter),
      (fail) => resolve({ error: fail }),
      async (count, smsList) => {
        const allSms = JSON.parse(smsList);
        const transactions = allSms
          .map(parseSms)
          .filter(Boolean);

        if (transactions.length === 0) {
          return resolve({ synced: 0, total_sms: allSms.length, message: 'No spending transactions found' });
        }

        try {
          const res = await fetch(`${BACKEND_URL}/api/sms/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactions, userId }),
          });
          const data = await res.json();
          resolve({
            synced: data.saved || 0,
            total_sms: allSms.length,
            parsed: transactions.length,
          });
        } catch (err) {
          resolve({ error: err.message });
        }
      }
    );
  });
}

// Debug: returns parsed transactions without sending to backend
// Used by the debug endpoint to show user what's being captured
export async function getLocalTransactions() {
  if (Platform.OS !== 'android') return [];

  const hasPermission = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.READ_SMS
  );
  if (!hasPermission) return [];

  const filter = { box: 'inbox', maxCount: 1000 };

  return new Promise((resolve) => {
    SmsAndroid.list(
      JSON.stringify(filter),
      () => resolve([]),
      (count, smsList) => {
        const allSms = JSON.parse(smsList);
        const transactions = allSms
          .map(parseSms)
          .filter(Boolean);
        resolve(transactions);
      }
    );
  });
}
