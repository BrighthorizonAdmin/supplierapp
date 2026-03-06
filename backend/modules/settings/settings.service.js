const Settings = require('./model/Settings.model');

const getSettings = async () => {
  let settings = await Settings.findOne({ key: 'global' }).lean();
  if (!settings) {
    settings = await Settings.create({ key: 'global' });
    settings = settings.toObject();
  }
  return settings;
};

const updateSettings = async (updates) => {
  const settings = await Settings.findOneAndUpdate(
    { key: 'global' },
    { ...updates },
    { new: true, upsert: true, runValidators: true }
  ).lean();
  return settings;
};

module.exports = { getSettings, updateSettings };
