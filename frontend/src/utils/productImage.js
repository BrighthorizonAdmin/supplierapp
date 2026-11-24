import api from '../services/api';

const getApiOrigin = () => new URL(api.defaults.baseURL || '/api', window.location.origin).origin;

const getUploadPath = (value) => {
  const normalized = value.replace(/\\/g, '/').replace(/^\.\//, '');
  const uploadsIndex = normalized.toLowerCase().lastIndexOf('uploads/');
  if (uploadsIndex >= 0) return normalized.slice(uploadsIndex);
  return null;
};

export const getProductImageUrl = (image) => {
  if (!image) return null;
  if (image.preview?.startsWith('data:')) return image.preview;

  const apiOrigin = getApiOrigin();
  const uploadPath = getUploadPath(image.filePath || '');
  if (uploadPath) return `${apiOrigin}/${uploadPath}`;

  if (image.url) {
    if (/^https?:\/\//i.test(image.url)) {
      const url = new URL(image.url);
      const browserIsLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
      const urlIsLocal = ['localhost', '127.0.0.1'].includes(url.hostname);
      return urlIsLocal && !browserIsLocal ? `${apiOrigin}${url.pathname}` : image.url;
    }

    const urlPath = getUploadPath(image.url);
    if (urlPath) return `${apiOrigin}/${urlPath}`;
  }

  if (image.fileName) {
    return `${apiOrigin}/uploads/products/${encodeURIComponent(image.fileName)}`;
  }
  return null;
};
