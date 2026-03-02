const success = (res, data, message = 'Success', statusCode = 200, meta = {}) => {
  const payload = { success: true, message, data };
  if (Object.keys(meta).length) payload.meta = meta;
  return res.status(statusCode).json(payload);
};

const error = (res, message = 'An error occurred', statusCode = 400, errors = []) => {
  const payload = { success: false, message };
  if (errors.length) payload.errors = errors;
  return res.status(statusCode).json(payload);
};

const paginated = (res, data, pagination, message = 'Success') => {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination,
  });
};

module.exports = { success, error, paginated };
