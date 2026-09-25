// GST helpers — decide intra-state (CGST + SGST) vs inter-state (IGST) supply.
// The first two digits of a GSTIN are the registrant's state code.

export const GST_RATES = [0, 5, 12, 18, 28];

const STATE_CODES = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
  '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
  '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra', '29': 'Karnataka',
  '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh',
};

// Alternate spellings seen in addresses
const ALIASES = { orissa: '21', pondicherry: '34', 'new delhi': '07', uttaranchal: '05', 'daman and diu': '26', 'dadra and nagar haveli': '26', 'j&k': '01' };

const NAME_TO_CODE = [
  ...Object.entries(STATE_CODES).map(([code, name]) => [name.toLowerCase(), code]),
  ...Object.entries(ALIASES),
].sort((a, b) => b[0].length - a[0].length); // longest first so "West Bengal" wins over shorter matches

export const stateCodeFromGSTIN = (gstin) => {
  const m = String(gstin || '').trim().match(/^(\d{2})[A-Z0-9]/i);
  return m && STATE_CODES[m[1]] ? m[1] : null;
};

export const stateCodeFromText = (text) => {
  const t = ` ${String(text || '').toLowerCase().replace(/[^a-z&]+/g, ' ')} `;
  if (!t.trim()) return null;
  const hit = NAME_TO_CODE.find(([name]) => t.includes(` ${name} `));
  return hit ? hit[1] : null;
};

// First usable state code from a list of GSTINs / address strings / state names
export const resolveStateCode = ({ gstins = [], texts = [] }) => {
  for (const g of gstins) { const c = stateCodeFromGSTIN(g); if (c) return c; }
  for (const t of texts) { const c = stateCodeFromText(t); if (c) return c; }
  return null;
};

// Inter-state only when both sides are known and differ; unknown → intra-state
// (CGST + SGST), which matches how invoices were always shown before.
export const isInterState = (sellerCode, buyerCode) =>
  Boolean(sellerCode && buyerCode && sellerCode !== buyerCode);

// Dealer-app orders carry tax only at order level (items arrive without a
// taxRate) — derive the rate from tax/subtotal, snapped to a GST slab.
export const derivedGstRate = (subtotal, taxAmount) => {
  const sub = Number(subtotal) || 0, tax = Number(taxAmount) || 0;
  if (!sub || !tax) return 0;
  const raw = Math.round((tax / sub) * 100);
  return GST_RATES.reduce((prev, curr) => (Math.abs(curr - raw) < Math.abs(prev - raw) ? curr : prev));
};

// Rows for the summary: [{ label, amount }] — IGST at full rate, or CGST + SGST at half each
export const gstSummaryRows = (breakdown, interState) =>
  Object.entries(breakdown)
    .sort(([a], [b]) => Number(a) - Number(b))
    .flatMap(([rate, tax]) => (interState
      ? [{ label: `IGST @${+rate}%`, amount: tax }]
      : [
          { label: `CGST @${+rate / 2}%`, amount: tax / 2 },
          { label: `SGST @${+rate / 2}%`, amount: tax / 2 },
        ]));
