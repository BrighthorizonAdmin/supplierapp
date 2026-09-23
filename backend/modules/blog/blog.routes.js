const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');
const { uploadBlogImage } = require('../../config/multer');
const { getAll, getById, create, update, remove } = require('./blog.controller');

router.use(authenticate);
router.get('/',    authorize('blog:read'),  getAll);
router.get('/:id', authorize('blog:read'),  getById);
router.post('/',   authorize('blog:write'), uploadBlogImage.single('coverImage'), create);
router.put('/:id', authorize('blog:write'), uploadBlogImage.single('coverImage'), update);
router.delete('/:id', authorize('blog:write'), remove);

module.exports = router;
