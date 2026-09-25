const Invoice = require('../payments/model/Invoice.model');
const Dealer  = require('../dealer/model/Dealer.model');
const mongoose = require('mongoose');

const buildMatch = ({ startDate, endDate, invoiceType, status, dealerId, paymentMode, salesmanName, partyNames, dealerIds }) => {
  const match = {};
  if (startDate || endDate) {
    match.invoiceDate = {};
    if (startDate) match.invoiceDate.$gte = new Date(startDate);
    if (endDate)   match.invoiceDate.$lte = new Date(endDate);
  }
  if (invoiceType && invoiceType !== 'all') match.invoiceType = invoiceType;
  if (status && status !== 'all') match.status = status;
  if (dealerId && dealerId !== 'all') match.dealerId = new mongoose.Types.ObjectId(dealerId);
  if (paymentMode && paymentMode !== 'all') match.paymentMode = { $regex: new RegExp(paymentMode, 'i') };
  if (salesmanName && salesmanName !== 'all') match.salesmanName = salesmanName;

  // Customer filter: match by partyName (retail) OR dealerId (B2B) so both invoice types are included
  const hasPartyNames = partyNames && partyNames !== 'all';
  const hasDealerIds  = dealerIds  && dealerIds  !== 'all';
  if (hasPartyNames || hasDealerIds) {
    const conditions = [];
    if (hasPartyNames) {
      const names = partyNames.split(',').map(n => n.trim()).filter(Boolean);
      if (names.length === 1) conditions.push({ partyName: names[0] });
      else if (names.length > 1) conditions.push({ partyName: { $in: names } });
    }
    if (hasDealerIds) {
      const ids = dealerIds.split(',').map(id => {
        try { return new mongoose.Types.ObjectId(id.trim()); } catch { return null; }
      }).filter(Boolean);
      if (ids.length === 1) conditions.push({ dealerId: ids[0] });
      else if (ids.length > 1) conditions.push({ dealerId: { $in: ids } });
    }
    if (conditions.length === 1) Object.assign(match, conditions[0]);
    else if (conditions.length > 1) match.$or = conditions;
  }

  // Exclude drafts/cancelled unless a specific status is requested
  if (!status || status === 'all') match.status = { $nin: ['draft', 'cancelled'] };
  return match;
};

const getKPIs = async (filters) => {
  const match = buildMatch(filters);

  const [totalsResult, partyNamesArr, dealerIdsWithoutParty] = await Promise.all([
    Invoice.aggregate([
      { $match: match },
      { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' }, collected: { $sum: '$amountPaid' }, taxAmount: { $sum: '$taxAmount' }, invoiceCount: { $sum: 1 } } },
    ]),
    Invoice.distinct('partyName', { ...match, partyName: { $nin: [null, ''] } }),
    Invoice.distinct('dealerId', { ...match, partyName: { $in: [null, ''] }, dealerId: { $ne: null } }),
  ]);

  const dealerNames = dealerIdsWithoutParty.length > 0
    ? (await Dealer.find({ _id: { $in: dealerIdsWithoutParty } }, 'businessName').lean()).map(d => d.businessName).filter(Boolean)
    : [];

  const customerCount = new Set([...partyNamesArr, ...dealerNames]).size;

  const r = totalsResult[0] || {};
  return {
    totalRevenue:  r.totalRevenue  || 0,
    collected:     r.collected     || 0,
    outstanding:   Math.max(0, (r.totalRevenue || 0) - (r.collected || 0)),
    gstCollected:  r.taxAmount     || 0,
    invoiceCount:  r.invoiceCount  || 0,
    customerCount,
    collectionPct: r.totalRevenue > 0 ? Math.round((r.collected / r.totalRevenue) * 100) : 0,
  };
};

const getInvoiceTypeSplit = async (filters) => {
  const match = buildMatch(filters);
  return Invoice.aggregate([
    { $match: match },
    { $group: { _id: '$invoiceType', revenue: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    { $project: { type: '$_id', revenue: 1, count: 1, _id: 0 } },
  ]);
};

const getPaymentMethodMix = async (filters) => {
  const match = buildMatch(filters);
  return Invoice.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $toLower: { $ifNull: ['$paymentMode', 'unknown'] } },
        revenue: { $sum: '$totalAmount' },
        count:   { $sum: 1 },
      },
    },
    { $sort: { revenue: -1 } },
    { $project: { mode: '$_id', revenue: 1, count: 1, _id: 0 } },
  ]);
};

const getWeeklyRevenue = async (filters) => {
  const match = buildMatch(filters);
  return Invoice.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          year: { $isoWeekYear: '$invoiceDate' },
          week: { $isoWeek: '$invoiceDate' },
        },
        revenue: { $sum: '$totalAmount' },
        count:   { $sum: 1 },
        weekStart: { $min: '$invoiceDate' },
      },
    },
    { $sort: { '_id.year': 1, '_id.week': 1 } },
    {
      $project: {
        _id: 0,
        week: { $concat: [{ $toString: '$_id.year' }, '-W', { $toString: '$_id.week' }] },
        weekStart: 1,
        revenue: 1,
        count: 1,
      },
    },
  ]);
};

const getHeatmap = async (filters) => {
  const match = buildMatch(filters);
  return Invoice.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          dayOfWeek: { $dayOfWeek: '$invoiceDate' },
          hour:      { $hour: '$invoiceDate' },
        },
        revenue: { $sum: '$totalAmount' },
        count:   { $sum: 1 },
      },
    },
    { $project: { _id: 0, dayOfWeek: '$_id.dayOfWeek', hour: '$_id.hour', revenue: 1, count: 1 } },
  ]);
};

const getTopProducts = async (filters) => {
  const match = buildMatch(filters);
  const results = await Invoice.aggregate([
    { $match: match },
    { $unwind: '$lineItems' },
    {
      $group: {
        _id:        '$lineItems.productName',
        revenue:    { $sum: '$lineItems.lineTotal' },
        quantity:   { $sum: '$lineItems.quantity' },
        invoiceIds: { $addToSet: '$_id' },
      },
    },
    { $sort: { revenue: -1 } },
    {
      $project: {
        _id: 0,
        name:         '$_id',
        revenue:      1,
        quantity:     1,
        invoiceCount: { $size: '$invoiceIds' },
      },
    },
  ]);
  const totalRevenue = results.reduce((s, p) => s + p.revenue, 0);
  return results.map(p => ({
    ...p,
    avgPerUnit: p.quantity > 0 ? Math.round(p.revenue / p.quantity) : 0,
    share:      totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0,
  }));
};

const getTopChannels = async (filters) => {
  const match = buildMatch(filters);
  return Invoice.aggregate([
    { $match: match },
    { $group: { _id: '$invoiceType', revenue: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    { $sort: { revenue: -1 } },
    { $project: { _id: 0, channel: '$_id', revenue: 1, count: 1 } },
  ]);
};

const getStatusSplit = async (filters) => {
  const match = buildMatch({ ...filters, status: 'all' });
  return Invoice.aggregate([
    { $match: match },
    { $group: { _id: '$status', revenue: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    { $sort: { revenue: -1 } },
    { $project: { _id: 0, status: '$_id', revenue: 1, count: 1 } },
  ]);
};

const getTopSalespeople = async (filters) => {
  const match = buildMatch(filters);
  return Invoice.aggregate([
    { $match: { ...match, salesmanName: { $nin: [null, ''] } } },
    { $group: { _id: '$salesmanName', revenue: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    { $sort: { revenue: -1 } },
    { $limit: 10 },
    { $project: { _id: 0, name: '$_id', revenue: 1, count: 1 } },
  ]);
};

const getCustomerRevenue = async (filters) => {
  const match = buildMatch(filters);

  const [byPartyName, byDealerId] = await Promise.all([
    Invoice.aggregate([
      { $match: { $and: [match, { partyName: { $nin: [null, ''] } }] } },
      {
        $group: {
          _id: '$partyName',
          invoiceCount: { $sum: 1 },
          revenue:      { $sum: '$totalAmount' },
          collected:    { $sum: '$amountPaid' },
        },
      },
      { $project: { _id: 0, name: '$_id', invoiceCount: 1, revenue: 1, collected: 1 } },
    ]),
    Invoice.aggregate([
      { $match: { $and: [match, { $or: [{ partyName: null }, { partyName: '' }] }] } },
      {
        $group: {
          _id:          '$dealerId',
          invoiceCount: { $sum: 1 },
          revenue:      { $sum: '$totalAmount' },
          collected:    { $sum: '$amountPaid' },
        },
      },
    ]),
  ]);

  const dealerIds = byDealerId.map(d => d._id).filter(Boolean);
  const dealers = dealerIds.length > 0
    ? await Dealer.find({ _id: { $in: dealerIds } }, 'businessName').lean()
    : [];
  const dealerMap = {};
  dealers.forEach(d => { dealerMap[d._id.toString()] = d.businessName || null; });

  const dealerGroups = byDealerId.map(d => ({
    name:         d._id ? (dealerMap[d._id.toString()] || 'Unknown') : 'Unknown',
    invoiceCount: d.invoiceCount,
    revenue:      d.revenue,
    collected:    d.collected,
  }));

  const merged = {};
  [...byPartyName, ...dealerGroups].forEach(c => {
    const key = c.name || 'Unknown';
    if (merged[key]) {
      merged[key].invoiceCount += c.invoiceCount;
      merged[key].revenue      += c.revenue;
      merged[key].collected    += c.collected;
    } else {
      merged[key] = { name: key, invoiceCount: c.invoiceCount, revenue: c.revenue, collected: c.collected };
    }
  });

  const results = Object.values(merged).sort((a, b) => b.revenue - a.revenue);
  const totalRevenue = results.reduce((s, c) => s + c.revenue, 0);

  return results.map(c => ({
    ...c,
    collectionPct: c.revenue > 0 ? Math.round((c.collected / c.revenue) * 100) : 0,
    share:         totalRevenue > 0 ? (c.revenue / totalRevenue) * 100 : 0,
  }));
};

const getInvoiceList = async (filters, { page = 1, limit = 20 } = {}) => {
  const match = buildMatch(filters);
  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    Invoice.find(match)
      .sort({ invoiceDate: -1 })
      .skip(skip)
      .limit(limit)
      .populate('dealerId', 'businessName name')
      .lean(),
    Invoice.countDocuments(match),
  ]);
  return { data, total, page, totalPages: Math.ceil(total / limit) };
};

const getFilterOptions = async () => {
  const [salesmen, invoicePartyNames, dealers] = await Promise.all([
    Invoice.distinct('salesmanName', { salesmanName: { $nin: ['', null] } }),
    Invoice.distinct('partyName', { partyName: { $nin: ['', null] }, status: { $nin: ['draft', 'cancelled'] } }),
    Dealer.find({}, 'businessName _id').lean(),
  ]);

  const dealerIdMap = {};
  dealers.forEach(d => { if (d.businessName) dealerIdMap[d.businessName] = d._id.toString(); });

  const allNames = [...new Set([...dealers.map(d => d.businessName).filter(Boolean), ...invoicePartyNames])]
    .sort((a, b) => a.localeCompare(b));

  const customers = allNames.map(name => ({ name, dealerId: dealerIdMap[name] || null }));

  return { salesmen, customers };
};

const getDailyStats = async (filters) => {
  const match = buildMatch(filters);
  const [r] = await Invoice.aggregate([
    { $match: match },
    {
      $facet: {
        daily: [
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$invoiceDate' } },
              revenue: { $sum: '$totalAmount' },
              count:   { $sum: 1 },
              date:    { $min: '$invoiceDate' },
            },
          },
          { $sort: { _id: 1 } },
          { $project: { _id: 0, date: 1, revenue: 1, count: 1 } },
        ],
        monthly: [
          {
            $group: {
              _id: { y: { $year: '$invoiceDate' }, m: { $month: '$invoiceDate' } },
              revenue: { $sum: '$totalAmount' },
              count:   { $sum: 1 },
            },
          },
          { $sort: { '_id.y': 1, '_id.m': 1 } },
          { $project: { _id: 0, year: '$_id.y', month: '$_id.m', revenue: 1, count: 1 } },
        ],
        byDayOfWeek: [
          {
            $group: {
              _id: {
                dow: { $dayOfWeek: '$invoiceDate' },
                day: { $dateToString: { format: '%Y-%m-%d', date: '$invoiceDate' } },
              },
              dayRevenue: { $sum: '$totalAmount' },
              dayCount:   { $sum: 1 },
            },
          },
          {
            $group: {
              _id: '$_id.dow',
              revenue:    { $sum: '$dayRevenue' },
              count:      { $sum: '$dayCount' },
              activeDays: { $sum: 1 },
            },
          },
          {
            $project: {
              _id: 0,
              dayOfWeek:  '$_id',
              revenue: 1, count: 1, activeDays: 1,
              avgPerDay: { $divide: ['$revenue', '$activeDays'] },
            },
          },
          { $sort: { dayOfWeek: 1 } },
        ],
      },
    },
  ]);

  const daily       = r?.daily       || [];
  const monthly     = r?.monthly     || [];
  const byDayOfWeek = r?.byDayOfWeek || [];
  const top10       = [...daily].sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  return { daily, monthly, byDayOfWeek, top10 };
};

const getDateRange = async () => {
  const result = await Invoice.aggregate([
    { $match: { status: { $nin: ['draft', 'cancelled'] } } },
    { $group: { _id: null, min: { $min: '$invoiceDate' }, max: { $max: '$invoiceDate' } } },
  ]);
  return result[0] ? { minDate: result[0].min, maxDate: result[0].max } : { minDate: null, maxDate: null };
};

module.exports = { getKPIs, getInvoiceTypeSplit, getPaymentMethodMix, getWeeklyRevenue, getHeatmap, getTopProducts, getTopChannels, getInvoiceList, getFilterOptions, getDateRange, getDailyStats, getStatusSplit, getTopSalespeople, getCustomerRevenue };
