const FlashSale = require('./model/FlashSale.model');
const { AppError } = require('../../middlewares/error.middleware');
const { getPagination, buildMeta } = require('../../utils/pagination');
const auditService = require('../audit/audit.service');

const createFlashSale = async (data, userId) => {
  const flashSale = await FlashSale.create({ ...data, createdBy: userId });
  if (flashSale.isEnabled) await disableOthers(flashSale._id);
  await auditService.log('flashSale', flashSale._id, 'create', userId, { after: { title: flashSale.title, discountPercent: flashSale.discountPercent } });
  return flashSale;
};

const getFlashSales = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const [data, total] = await Promise.all([
    FlashSale.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    FlashSale.countDocuments({}),
  ]);
  return { data, pagination: buildMeta(total, page, limit) };
};

const getFlashSaleById = async (id) => {
  const flashSale = await FlashSale.findById(id).lean();
  if (!flashSale) throw new AppError('Flash sale not found', 404);
  return flashSale;
};

// Only one flash sale may be live at a time, so checkout never has to choose
// between competing campaigns — enabling one turns the rest off.
const disableOthers = async (exceptId) => {
  await FlashSale.updateMany({ _id: { $ne: exceptId }, isEnabled: true }, { isEnabled: false });
};

const updateFlashSale = async (id, updates, userId) => {
  const flashSale = await FlashSale.findById(id);
  if (!flashSale) throw new AppError('Flash sale not found', 404);

  const before = { isEnabled: flashSale.isEnabled, discountPercent: flashSale.discountPercent };
  Object.assign(flashSale, updates);
  await flashSale.save();
  if (flashSale.isEnabled) await disableOthers(flashSale._id);

  await auditService.log('flashSale', id, 'update', userId, { before, after: updates });
  return flashSale;
};

const deleteFlashSale = async (id, userId) => {
  const flashSale = await FlashSale.findById(id);
  if (!flashSale) throw new AppError('Flash sale not found', 404);
  await flashSale.deleteOne();
  await auditService.log('flashSale', id, 'delete', userId, {});
};

const getActive = async () => {
  const now = new Date();
  return FlashSale.findOne({
    isEnabled: true,
    startDate: { $lte: now },
    $or: [{ endDate: null }, { endDate: { $exists: false } }, { endDate: { $gte: now } }],
  }).lean();
};

module.exports = {
  createFlashSale, getFlashSales, getFlashSaleById, updateFlashSale, deleteFlashSale, getActive,
};
