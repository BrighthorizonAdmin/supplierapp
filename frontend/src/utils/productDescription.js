export const productDescriptionText = (description) => {
  if (typeof description !== 'string' || !description) return '';
  if (!/<[a-z][\s\S]*>/i.test(description)) return description.trim();

  const document = new DOMParser().parseFromString(description, 'text/html');
  document.querySelectorAll('script, style').forEach((element) => element.remove());
  document.querySelectorAll('br, li, p').forEach((element) => {
    element.appendChild(document.createTextNode(' '));
  });
  return (document.body.textContent || '').replace(/\s+/g, ' ').trim();
};
