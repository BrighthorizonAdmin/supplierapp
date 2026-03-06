const settingsService = require('./settings.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/response');

const getSettings = asyncHandler(async (req, res) => {
  const settings = await settingsService.getSettings();
  return success(res, settings, 'Settings fetched');
});

const updateSettings = asyncHandler(async (req, res) => {
  const settings = await settingsService.updateSettings(req.body);
  return success(res, settings, 'Settings saved');
});

module.exports = { getSettings, updateSettings };
