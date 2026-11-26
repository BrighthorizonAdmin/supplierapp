const seoService = require('./seo.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success, paginated } = require('../../utils/response');

const listSeoPages = asyncHandler(async (req, res) => {
  const { data, pagination } = await seoService.listSeoPages(req.query);
  return paginated(res, data, pagination, 'SEO pages fetched');
});

const getSeoPage = asyncHandler(async (req, res) => {
  const page = await seoService.getSeoPage(req.params.id);
  return success(res, page, 'SEO page fetched');
});

const createSeoPage = asyncHandler(async (req, res) => {
  const page = await seoService.createSeoPage(req.body, req.user.id);
  return success(res, page, 'SEO page created', 201);
});

const updateSeoPage = asyncHandler(async (req, res) => {
  const page = await seoService.updateSeoPage(req.params.id, req.body, req.user.id);
  return success(res, page, 'SEO page updated');
});

const deleteSeoPage = asyncHandler(async (req, res) => {
  await seoService.deleteSeoPage(req.params.id);
  return success(res, null, 'SEO page deleted');
});

const getPublicSeoPage = asyncHandler(async (req, res) => {
  const page = await seoService.getPublicSeoPage(req.query.path);
  return success(res, page, 'SEO metadata fetched');
});

module.exports = {
  listSeoPages,
  getSeoPage,
  createSeoPage,
  updateSeoPage,
  deleteSeoPage,
  getPublicSeoPage,
};
