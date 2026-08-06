import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import toast from 'react-hot-toast';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { ArrowLeft, Loader2, Save, UploadCloud, X } from 'lucide-react';
import { fetchBlogById, createBlog, updateBlog, clearCurrentBlog } from '../blogSlice';

const CATEGORIES = ['Retail', 'Restaurant', 'Pharmacy', 'Hospitality', 'Cafe', 'Supermarket', 'Warehouse', 'General'];

const QUILL_MODULES = {
  toolbar: [
    [{ header: [2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link', 'image'],
    ['blockquote', 'code-block'],
    ['clean'],
  ],
};

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelCls = 'text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5';

export default function BlogFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { current, detailLoading, saving } = useSelector((s) => s.blog);

  const { register, handleSubmit, reset, control, watch } = useForm({
    defaultValues: {
      title: '', excerpt: '', category: 'General', author: 'BUVVAS Team',
      tags: '', content: '', status: 'draft',
    },
  });

  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [originalCoverImage, setOriginalCoverImage] = useState('');
  const [coverRemoved, setCoverRemoved] = useState(false);
  const coverInputRef = useRef(null);

  useEffect(() => {
    if (isEdit) dispatch(fetchBlogById(id));
    return () => dispatch(clearCurrentBlog());
  }, [id, isEdit, dispatch]);

  useEffect(() => {
    if (isEdit && current) {
      reset({
        title: current.title || '',
        excerpt: current.excerpt || '',
        category: current.category || 'General',
        author: current.author || 'BUVVAS Team',
        tags: (current.tags || []).join(', '),
        content: current.content || '',
        status: current.status || 'draft',
      });
      setCoverPreview(current.coverImage || '');
      setOriginalCoverImage(current.coverImage || '');
      setCoverRemoved(false);
    }
  }, [isEdit, current, reset]);

  const handleCoverChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setCoverRemoved(false);
  };

  const handleRemoveCover = () => {
    if (coverFile) {
      // Undo a not-yet-saved selection, revert to whatever was there before.
      setCoverFile(null);
      setCoverPreview(originalCoverImage);
    } else {
      // Delete the already-saved cover image.
      setCoverPreview('');
      setCoverRemoved(true);
    }
    if (coverInputRef.current) coverInputRef.current.value = '';
  };

  const onSubmit = async (data) => {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('excerpt', data.excerpt);
    formData.append('category', data.category);
    formData.append('author', data.author);
    formData.append('content', data.content);
    formData.append('status', data.status);
    formData.append('tags', JSON.stringify(data.tags.split(',').map((t) => t.trim()).filter(Boolean)));
    if (coverFile) formData.append('coverImage', coverFile);
    else if (isEdit && coverRemoved) formData.append('coverImage', '');

    try {
      if (isEdit) {
        await dispatch(updateBlog({ id, formData })).unwrap();
        toast.success('Blog post updated.');
      } else {
        await dispatch(createBlog(formData)).unwrap();
        toast.success('Blog post created.');
      }
      navigate('/blog');
    } catch (err) {
      toast.error(err?.message || 'Failed to save post.');
    }
  };

  if (isEdit && detailLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 size={24} className="animate-spin mr-2" /> Loading…
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <button onClick={() => navigate('/blog')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft size={16} /> Back to Blog Posts
      </button>

      <h1 className="text-2xl font-bold text-gray-900">{isEdit ? 'Edit Blog Post' : 'New Blog Post'}</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
          <div>
            <label className={labelCls}>Title *</label>
            <input {...register('title', { required: true })} placeholder="e.g. 5 Ways Modern POS Systems Boost Retail Sales" className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Category</label>
              <select {...register('category')} className={inputCls}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Author</label>
              <input {...register('author')} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Tags <span className="normal-case font-normal text-gray-400">(comma separated)</span></label>
            <input {...register('tags')} placeholder="retail, billing, pos" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Excerpt <span className="normal-case font-normal text-gray-400">(short summary shown on the blog listing card)</span></label>
            <textarea {...register('excerpt')} rows={2} className={inputCls + ' resize-none'} />
          </div>

          <div>
            <label className={labelCls}>Cover Image</label>
            <label className="flex items-center gap-3 border border-dashed border-gray-300 rounded-lg px-4 py-3 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors w-fit">
              <UploadCloud size={18} className="text-gray-400" />
              <span className="text-sm text-gray-600">{coverFile ? coverFile.name : 'Choose an image…'}</span>
              <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleCoverChange} />
            </label>
            {coverPreview && (
              <div className="relative mt-3 w-fit">
                <img src={coverPreview} alt="Cover preview" className="h-32 rounded-lg border border-gray-200 object-cover" />
                <button
                  type="button"
                  onClick={handleRemoveCover}
                  aria-label={coverFile ? 'Remove selected image' : 'Delete cover image'}
                  className="absolute -top-2 -right-2 bg-gray-900 text-white rounded-full p-1 shadow hover:bg-gray-700 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <label className={labelCls}>Content *</label>
          <Controller
            name="content"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <ReactQuill
                theme="snow"
                value={field.value}
                onChange={field.onChange}
                modules={QUILL_MODULES}
                className="bg-white [&_.ql-container]:min-h-[280px] [&_.ql-container]:text-sm"
              />
            )}
          />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-center justify-between">
          <div>
            <label className={labelCls}>Status</label>
            <select {...register('status')} className={inputCls}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Post'}
          </button>
        </div>
      </form>
    </div>
  );
}
