const InvoiceHistory = require('./model/InvoiceHistory.model');
const logger = require('../../utils/logger');
const { getPagination, buildMeta } = require('../../utils/pagination');

// ── Formatting ──────────────────────────────────────────────────────────────
const fmt = {
  text:   (v) => (v === undefined || v === null ? '' : String(v).trim()),
  money:  (v) => (v === undefined || v === null || v === '' ? '' : (Number(v) || 0).toFixed(2)),
  number: (v) => (v === undefined || v === null || v === '' ? '' : String(Number(v) || 0)),
  date:   (v) => {
    if (!v) return '';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  },
  bool:    (v) => (v ? 'Yes' : 'No'),
  address: (a) => (a ? [a.label, a.street, a.city, a.state, a.pincode].filter(Boolean).join(', ') : ''),
  bank:    (b) => (b ? [b.label, b.holderName, b.accountNumber, b.ifscCode, b.bankBranchName, b.upiId].filter(Boolean).join(', ') : ''),
  party:   (p) => (p ? [p.name, p.address, p.gstin, p.phone].filter(Boolean).join(', ') : ''),
};

// Invoice fields tracked for history: [field, label, formatter, kind shown in the UI]
const FIELDS = [
  ['invoiceNumber',      'Invoice Number',     fmt.text,    'text'],
  ['invoiceDate',        'Invoice Date',       fmt.date,    'date'],
  ['dueDate',            'Due Date',           fmt.date,    'date'],
  ['status',             'Status',             fmt.text,    'text'],
  ['partyName',          'Customer / Dealer',  fmt.text,    'text'],
  ['partyAddress',       'Billing Address',    fmt.text,    'text'],
  ['partyGST',           'GSTIN',              fmt.text,    'text'],
  ['partyPhone',         'Phone',              fmt.text,    'text'],
  ['shippingAddress',    'Shipping Address',   fmt.address, 'text'],
  ['billedFrom',         'Billed From',        fmt.party,   'text'],
  ['paymentMode',        'Payment Mode',       fmt.text,    'text'],
  ['paymentReceivedIn',  'Payment Received In', fmt.text,   'text'],
  ['paymentTerms',       'Payment Terms',      fmt.text,    'text'],
  ['bankDetails',        'Bank Details',       fmt.bank,    'text'],
  ['salesmanName',       'Salesman',           fmt.text,    'text'],
  ['warrantyPeriod',     'Warranty Period',    fmt.text,    'text'],
  ['notes',              'Notes',              fmt.text,    'text'],
  ['termsAndConditions', 'Terms & Conditions', fmt.text,    'text'],
  ['additionalLabel',    'Additional Charges Label', fmt.text, 'text'],
  ['additionalCharges',  'Additional Charges', fmt.money,   'money'],
  ['discountAmt',        'Invoice Discount',   fmt.money,   'money'],
  ['roundOff',           'Round Off',          fmt.bool,    'text'],
  ['roundOffAmt',        'Round Off Amount',   fmt.money,   'money'],
  ['subtotal',           'Subtotal',           fmt.money,   'money'],
  ['taxAmount',          'Tax Amount',         fmt.money,   'money'],
  ['totalAmount',        'Total Amount',       fmt.money,   'money'],
  ['amountPaid',         'Amount Paid',        fmt.money,   'money'],
  ['balance',            'Balance',            fmt.money,   'money'],
];

// Line item fields compared between matching lines
const LINE_FIELDS = [
  ['quantity',      'Quantity',       fmt.number, 'number'],
  ['unitPrice',     'Unit Price',     fmt.money,  'money'],
  ['discount',      'Discount',       (li) => (Number(li.discountValue ?? li.discount) ? `${Number(li.discountValue ?? li.discount)}${li.discountType || '%'}` : ''), 'text'],
  ['taxRate',       'GST %',          fmt.number, 'number'],
  ['hsnCode',       'HSN Code',       fmt.text,   'text'],
  ['unit',          'Unit',           fmt.text,   'text'],
  ['description',   'Description',    fmt.text,   'text'],
  ['lineTotal',     'Line Total',     fmt.money,  'money'],
  ['serialNumbers', 'Serial Numbers', (v) => (v || []).map(s => String(s).toUpperCase()).join(', '), 'text'],
];

// Plain copy of an invoice, taken before a change so it can be compared afterwards
const snapshot = (invoice) => {
  if (!invoice) return null;
  const obj = typeof invoice.toObject === 'function' ? invoice.toObject() : invoice;
  return JSON.parse(JSON.stringify(obj));
};

const lineSummary = (li) => {
  const parts = [`Qty ${fmt.number(li.quantity)} × ₹${fmt.money(li.unitPrice)}`];
  const serials = (li.serialNumbers || []).join(', ');
  if (serials) parts.push(`SN: ${serials}`);
  return parts.join(' | ');
};

// Pair old and new line items by product (in order, so repeated products line up)
const diffLines = (oldLines = [], newLines = []) => {
  const changes = [];
  const keyOf = (li) => String(li.productId || li.productName || '').toLowerCase();
  const pool = new Map();
  oldLines.forEach((li) => {
    const k = keyOf(li);
    if (!pool.has(k)) pool.set(k, []);
    pool.get(k).push(li);
  });

  for (const nl of newLines) {
    const ol = (pool.get(keyOf(nl)) || []).shift();
    const name = nl.productName || ol?.productName || 'Item';
    if (!ol) {
      changes.push({ field: `lineItems.${name}`, label: `${name} — Item added`, kind: 'text', from: '', to: lineSummary(nl) });
      continue;
    }
    for (const [field, label, f, kind] of LINE_FIELDS) {
      const src = field === 'discount' ? [ol, nl] : [ol[field], nl[field]];
      const from = f(src[0]), to = f(src[1]);
      if (from !== to) changes.push({ field: `lineItems.${name}.${field}`, label: `${name} — ${label}`, kind, from, to });
    }
  }
  for (const rest of pool.values()) {
    for (const ol of rest) {
      const name = ol.productName || 'Item';
      changes.push({ field: `lineItems.${name}`, label: `${name} — Item removed`, kind: 'text', from: lineSummary(ol), to: '' });
    }
  }
  return changes;
};

// Every field that differs between two snapshots
const diff = (before, after) => {
  if (!before || !after) return [];
  const changes = [];
  for (const [field, label, f, kind] of FIELDS) {
    const from = f(before[field]), to = f(after[field]);
    if (from !== to) changes.push({ field, label, kind, from, to });
  }
  return changes.concat(diffLines(before.lineItems, after.lineItems));
};

const actorOf = (user) => (user ? {
  id: String(user.id || user._id || ''),
  name: user.name || '',
  email: user.email || '',
  role: user.role,
} : undefined);

// Save one history entry. Never throws: a history problem must not undo or block the edit.
const record = async ({ action, source, before, after, user, changes }) => {
  try {
    const list = changes || diff(before, after);
    if (action === 'edit' || action === 'serials') {
      if (!list.length) return null; // saved with nothing changed
    }
    const ref = after || before || {};
    return await InvoiceHistory.create({
      invoiceId: ref._id,
      invoiceNumber: ref.invoiceNumber || '',
      invoiceType: ref.invoiceType || '',
      partyName: ref.partyName || '',
      action,
      source,
      changes: list,
      performedBy: actorOf(user),
    });
  } catch (err) {
    logger.error(`Invoice history could not be saved: ${err.message}`);
    return null;
  }
};

// Fields the invoice screens fill in for display when an older invoice left them empty
// (from the dealer, order or product). The edit form saves those displayed values, so
// "empty → value" on these is the form filling them in, not a change the user made.
const DISPLAY_FILLED = new Set([
  'partyName', 'partyAddress', 'partyGST', 'partyPhone', 'shippingAddress', 'billedFrom',
  'paymentTerms', 'warrantyPeriod', 'dueDate',
]);

// Mark changes the edit form makes by itself, so the page can show the user's own
// changes first. Done when reading, so entries saved earlier are sorted the same way.
const markAutomatic = (entry) => {
  if (entry.action !== 'edit' || !entry.changes?.length) return entry;
  const changes = entry.changes;
  // Order invoices keep GST at invoice level (0% per line); the form moves it onto the
  // lines without changing the invoice's tax or total
  const totalsUnchanged = !changes.some((c) => c.field === 'taxAmount' || c.field === 'totalAmount');
  const taxMovedOn = new Set();
  if (totalsUnchanged) {
    changes.forEach((c) => {
      const m = /^lineItems\.(.+)\.taxRate$/.exec(c.field || '');
      if (m && (!c.from || Number(c.from) === 0)) taxMovedOn.add(m[1]);
    });
  }
  return {
    ...entry,
    changes: changes.map((c) => {
      const field = c.field || '';
      const line = /^lineItems\.(.+)\.(taxRate|lineTotal|hsnCode)$/.exec(field);
      const auto = (DISPLAY_FILLED.has(field) && !c.from)
        || (line && line[2] === 'hsnCode' && !c.from)
        || (line && line[2] !== 'hsnCode' && taxMovedOn.has(line[1]));
      return auto ? { ...c, auto: true } : c;
    }),
  };
};

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const list = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const match = {};
  if (query.invoiceId) match.invoiceId = query.invoiceId;
  if (query.action) match.action = query.action;
  if (query.invoiceType) match.invoiceType = query.invoiceType;
  if (query.search) {
    const re = new RegExp(escapeRegex(query.search.trim()), 'i');
    match.$or = [{ invoiceNumber: re }, { partyName: re }, { 'performedBy.name': re }];
  }
  if (query.startDate || query.endDate) {
    match.createdAt = {};
    if (query.startDate) match.createdAt.$gte = new Date(`${query.startDate}T00:00:00`);
    if (query.endDate) match.createdAt.$lte = new Date(`${query.endDate}T23:59:59.999`);
  }

  const [data, total] = await Promise.all([
    InvoiceHistory.find(match).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    InvoiceHistory.countDocuments(match),
  ]);
  return { data: data.map(markAutomatic), pagination: buildMeta(total, page, limit) };
};

module.exports = { snapshot, diff, record, list };
