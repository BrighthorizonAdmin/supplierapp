const express = require('express');
const Category = require('./model/Category.model');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = express.Router();
router.use(authenticate);

// GET /api/categories
router.get('/', authorize('products:read'), async (req, res, next) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json({ success: true, data: categories });
  } catch (err) { next(err); }
});

// POST /api/categories
router.post('/', authorize('products:write'), async (req, res, next) => {
  try {
    const { name, hsnCode } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Category name is required' });

    const dupName = await Category.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
    if (dupName) return res.status(409).json({ success: false, message: 'Category name already exists' });

    if (hsnCode?.trim()) {
      const dupHsn = await Category.findOne({ hsnCode: hsnCode.trim() });
      if (dupHsn) return res.status(409).json({ success: false, message: `HSN code ${hsnCode.trim()} is already assigned to "${dupHsn.name}"` });
    }

    const category = await Category.create({ name: name.trim(), hsnCode: hsnCode?.trim() || '' });
    res.status(201).json({ success: true, data: category });
  } catch (err) { next(err); }
});

// PUT /api/categories/:id
router.put('/:id', authorize('products:write'), async (req, res, next) => {
  try {
    const { hsnCode } = req.body;

    if (hsnCode?.trim()) {
      const dupHsn = await Category.findOne({ hsnCode: hsnCode.trim(), _id: { $ne: req.params.id } });
      if (dupHsn) return res.status(409).json({ success: false, message: `HSN code ${hsnCode.trim()} is already assigned to "${dupHsn.name}"` });
    }

    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { $set: { hsnCode: hsnCode?.trim() || '' } },
      { new: true, runValidators: true }
    );
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
    res.json({ success: true, data: category });
  } catch (err) { next(err); }
});

module.exports = router;
