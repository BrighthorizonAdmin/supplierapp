const quoteService = require('./quote.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success, paginated } = require('../../utils/response');

const getQuotes    = asyncHandler(async (req, res) => {
  const { data, pagination } = await quoteService.getQuotes(req.query);
  return paginated(res, data, pagination, 'Quotes fetched');
});

const getQuoteById = asyncHandler(async (req, res) => {
  const q = await quoteService.getQuoteById(req.params.id);
  return success(res, q, 'Quote fetched');
});

const createQuote  = asyncHandler(async (req, res) => {
  const q = await quoteService.createQuote(req.body, req.user);
  return success(res, q, 'Quote created', 201);
});

const updateQuote  = asyncHandler(async (req, res) => {
  const q = await quoteService.updateQuote(req.params.id, req.body);
  return success(res, q, 'Quote updated');
});

const deleteQuote  = asyncHandler(async (req, res) => {
  await quoteService.deleteQuote(req.params.id);
  return success(res, null, 'Quote deleted');
});

module.exports = { getQuotes, getQuoteById, createQuote, updateQuote, deleteQuote };
