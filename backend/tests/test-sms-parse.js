// Quick test: shows how SMS parsing works with real Indian bank SMS examples
// Run: node test-sms-parse.js

const DEBIT_PATTERNS = [
  { bank: 'HDFC', regex: /INR\s+([\d,]+(?:\.\d{1,2})?)\s+(?:debited|withdrawn).*?(?:at|Info:)\s+([A-Za-z0-9 ._/-]+?)(?:\s*\.\s*Avl|\s+on|\s+Ref|\s+Avl|$)/i },
  { bank: 'SBI', regex: /Rs\.?([\d,]+(?:\.\d{1,2})?)\s+debited.*?(?:Transaction:|Info:)\s*([A-Za-z0-9 ._/-]+?)(?:\.\s*Avail|\.\s*Bal|$)/i },
  { bank: 'ICICI', regex: /Rs\.?\s*([\d,]+(?:\.\d{1,2})?)\s+debited.*?;\s*([A-Za-z0-9 ._/-]+?)(?:\s*\.\s*UPI|\s+on|\s+Ref|\.)/i },
  { bank: 'Axis', regex: /INR\s+([\d,]+(?:\.\d{1,2})?)\s+(?:debited|withdrawn).*?(?:for|at|to)\s+([A-Za-z0-9 ._/-]+?)(?:\s+on\s+\d|\s+Ref|\.\s|$)/i },
  { bank: 'Kotak', regex: /Rs\.?\s*([\d,]+(?:\.\d{1,2})?)\s+(?:has been\s+)?debited.*?(?:at|merchant:?)\s*([A-Za-z0-9 ._/-]+?)(?:\.\s*Bal|\.\s*Avail|\s*\.|$)/i },
  { bank: 'UPI', regex: /(?:paid|sent)\s+Rs\.?\s*([\d,]+(?:\.\d{1,2})?)\s+(?:to|for|at)\s+([A-Za-z0-9 ._/-]+?)(?:\s+via|\s+UPI|\s+Ref|\.)/i },
  { bank: 'UPI', regex: /(?:debited)\s+Rs\.?\s*([\d,]+(?:\.\d{1,2})?)\s+.*?(?:to|for)\s+([A-Za-z0-9 ._/-]+?)(?:\s+via|\s+Ref|\.|\s+on|$)/i },
  { bank: 'Bank', regex: /(?:debited|withdrawn|spent)\s+(?:INR|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?).*?(?:merchant:?|at|Info:|for|to)\s*([A-Za-z0-9 ._/-]{2,}?)(?:\s*[.\s]|\s+on|\s+Ref|$)/i },
];

const SAMPLE_SMS = [
  { from: 'HDFCBK', body: 'INR 2,450.00 debited from A/C **1234 on 23-03-26 at SWIGGY. Avl Bal: INR 45,230.50. Not you? Call 18002586161' },
  { from: 'SBIINB', body: 'Rs.1840.50 debited from your A/c ***5518 on 21Mar26. Transaction: PhonePe SBI card SELECT BLACK. Available Balance: Rs.12,450.00' },
  { from: 'ICICIB', body: 'Rs 500.00 debited from Acct XX4567 on 23-03-2026; ZOMATO. UPI Ref: 308712345678' },
  { from: 'AXISBK', body: 'INR 350 debited from your Axis Bank a/c ****7890 for UBER INDIA on 23-03-26. Ref No 12345' },
  { from: 'KOTAKB', body: 'Rs.1299 has been debited from your Kotak Bank account XX1111 at NETFLIX. Balance: Rs 8,500' },
  { from: 'HDFCBK', body: 'You have paid Rs.200 to SWIGGY via UPI. UPI Ref: 308745678901' },
  { from: 'PAYTMB', body: 'Debited Rs.150 from your Paytm Payments Bank A/c for AMAZON PAY. UPI Ref 309112345678' },
  { from: 'SBIINB', body: 'Rs.1,81,487.00 credited to your A/c ***5518 on 23Mar26. Available Balance: Rs.1,82,899.26' },
];

console.log('=== SMS PARSING — HOW CLUTCH READS YOUR BANK SMS ===\n');

let parsed = 0, skipped = 0, failed = 0;

for (const sms of SAMPLE_SMS) {
  const isCredit = /credited|received|deposited/i.test(sms.body) && !/debited/i.test(sms.body);

  console.log(`FROM: ${sms.from}`);
  console.log(`SMS:  ${sms.body}`);

  if (isCredit) {
    console.log(`  → SKIPPED (salary/credit — only debits tracked)`);
    skipped++;
    console.log('');
    continue;
  }

  let result = null;
  for (const { bank, regex } of DEBIT_PATTERNS) {
    const match = sms.body.match(regex);
    if (match) {
      result = {
        bank,
        amount: parseFloat(match[1].replace(/,/g, '')),
        merchant: match[2].trim(),
      };
      break;
    }
  }

  if (result) {
    console.log(`  → STORED: ₹${result.amount} → ${result.merchant} (${result.bank})`);
    parsed++;
  } else {
    console.log(`  → MISSED (no pattern matched)`);
    failed++;
  }
  console.log('');
}

console.log(`=== RESULTS: ${parsed} parsed | ${skipped} skipped (credits) | ${failed} missed ===`);
console.log('\nThis happens silently when you open the app.');
console.log('Ask AI: "What did I spend this month?" → Artha agent pulls this data.');
