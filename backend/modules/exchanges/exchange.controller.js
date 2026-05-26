const { getExchanges, getExchangeById, updateExchangeStatus } = require('./exchange.service');

const listExchanges = async (req, res) => {
  const result = await getExchanges(req.query);
  res.json({ success: true, ...result });
};

const showExchange = async (req, res) => {
  const data = await getExchangeById(req.params.id);
  res.json({ success: true, data });
};

const patchExchangeStatus = async (req, res) => {
  const { status, supplierNotes } = req.body;
  if (!status) return res.status(400).json({ success: false, message: 'status required' });
  const data = await updateExchangeStatus(req.params.id, status, supplierNotes, req.user?._id);
  res.json({ success: true, data });
};

module.exports = { listExchanges, showExchange, patchExchangeStatus };
