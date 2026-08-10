const flashSaleService = require('./flashSale.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success, paginated } = require('../../utils/response');

const createFlashSale = asyncHandler(async (req, res) => {
  const flashSale = await flashSaleService.createFlashSale(req.body, req.user.id);
  return success(res, flashSale, 'Flash sale created', 201);
});

const getFlashSales = asyncHandler(async (req, res) => {
  const { data, pagination } = await flashSaleService.getFlashSales(req.query);
  return paginated(res, data, pagination, 'Flash sales fetched');
});

const getFlashSaleById = asyncHandler(async (req, res) => {
  const flashSale = await flashSaleService.getFlashSaleById(req.params.id);
  return success(res, flashSale, 'Flash sale fetched');
});

const updateFlashSale = asyncHandler(async (req, res) => {
  const flashSale = await flashSaleService.updateFlashSale(req.params.id, req.body, req.user.id);
  return success(res, flashSale, 'Flash sale updated');
});

const deleteFlashSale = asyncHandler(async (req, res) => {
  await flashSaleService.deleteFlashSale(req.params.id, req.user.id);
  return success(res, null, 'Flash sale deleted');
});

const getActiveFlashSale = asyncHandler(async (req, res) => {
  const flashSale = await flashSaleService.getActive();
  return success(res, flashSale, 'Active flash sale fetched');
});

module.exports = {
  createFlashSale, getFlashSales, getFlashSaleById, updateFlashSale, deleteFlashSale, getActiveFlashSale,
};
