const { format } = require('date-fns');

/**
 * Generates a unique code like DLR-202503-0001
 * @param {Model} Model - Mongoose model to count from
 * @param {string} prefix - e.g. 'DLR', 'ORD', 'INV'
 * @param {string} field - the field name to query e.g. 'dealerCode'
 * @param {string} dateFormat - date part format e.g. 'yyyyMM' or 'yyyyMMdd'
 */
const generateCode = async (Model, prefix, field, dateFormat = 'yyyyMM') => {
  const datePart = format(new Date(), dateFormat);
  const pattern = new RegExp(`^${prefix}-${datePart}-`);
  const count = await Model.countDocuments({ [field]: pattern });
  const seq = String(count + 1).padStart(4, '0');
  return `${prefix}-${datePart}-${seq}`;
};

module.exports = { generateCode };
