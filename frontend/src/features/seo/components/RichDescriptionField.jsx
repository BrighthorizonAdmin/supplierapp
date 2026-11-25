import { useEffect, useRef, useState } from 'react';
import { Controller } from 'react-hook-form';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

// Toolbar for page descriptions: fonts, sizes, headings, emphasis, colours, lists, alignment, links.
const DESCRIPTION_MODULES = {
  toolbar: [
    [{ font: [] }, { size: ['small', false, 'large', 'huge'] }],
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }, { align: [] }],
    ['link', 'clean'],
  ],
};

const DESCRIPTION_FORMATS = [
  'font', 'size', 'header', 'bold', 'italic', 'underline', 'strike',
  'color', 'background', 'list', 'align', 'link',
];

const MAX_LENGTH = 10000;

// Plain-text copy (website defaults) is shown as paragraphs, keeping its line breaks.
const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const toEditorValue = (value) => {
  const text = String(value || '');
  if (!text || /<\/?[a-z][^>]*>/i.test(text)) return text;
  return text.split(/\n{2,}/).map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`).join('');
};

// Quill 2 writes every list as <ol> with <li data-list="bullet|ordered">; store standard <ul>/<ol>.
const toSemanticLists = (html) => {
  if (!html.includes('data-list')) return html;
  const template = document.createElement('template');
  template.innerHTML = html;
  template.content.querySelectorAll('ol').forEach((list) => {
    const items = Array.from(list.children);
    const groups = [];
    items.forEach((item) => {
      const type = item.getAttribute('data-list') === 'bullet' ? 'ul' : 'ol';
      item.removeAttribute('data-list');
      item.querySelectorAll('.ql-ui').forEach((ui) => ui.remove());
      if (!groups.length || groups[groups.length - 1].type !== type) groups.push({ type, items: [] });
      groups[groups.length - 1].items.push(item);
    });
    const fragment = document.createDocumentFragment();
    groups.forEach(({ type, items: groupItems }) => {
      const element = document.createElement(type);
      groupItems.forEach((item) => element.appendChild(item));
      fragment.appendChild(element);
    });
    list.replaceWith(fragment);
  });
  return template.innerHTML;
};

/**
 * Rich text editor bound to a react-hook-form field. An empty editor stores '' so the website
 * falls back to its built-in text.
 */
export default function RichDescriptionField({ control, name, compact = false }) {
  return (
    <Controller
      name={name}
      control={control}
      rules={{
        validate: (value) => String(value || '').length <= MAX_LENGTH
          || `Keep this description under ${MAX_LENGTH.toLocaleString('en-IN')} characters (including formatting).`,
      }}
      render={({ field, fieldState }) => (
        <div>
          <DescriptionEditor field={field} compact={compact} />
          {fieldState.error && <p className="mt-1 text-xs text-red-600">{fieldState.error.message}</p>}
        </div>
      )}
    />
  );
}

function DescriptionEditor({ field, compact }) {
  // The editor keeps its own HTML; the form gets the cleaned-up version. Only a change that did
  // not come from this editor (form reset, record loaded, page switched) reloads the editor.
  const lastEmitted = useRef(field.value);
  const [editorValue, setEditorValue] = useState(() => toEditorValue(field.value));

  useEffect(() => {
    if (field.value === lastEmitted.current) return;
    lastEmitted.current = field.value;
    setEditorValue(toEditorValue(field.value));
  }, [field.value]);

  return (
    <ReactQuill
      theme="snow"
      value={editorValue}
      onChange={(html, _delta, source, editor) => {
        setEditorValue(html);
        if (source !== 'user') return; // ignore Quill normalising the loaded value
        const next = editor.getText().trim() ? toSemanticLists(html) : '';
        lastEmitted.current = next;
        field.onChange(next);
      }}
      onBlur={field.onBlur}
      modules={DESCRIPTION_MODULES}
      formats={DESCRIPTION_FORMATS}
      className={`bg-white text-sm [&_.ql-editor]:text-sm ${
        compact ? '[&_.ql-container]:min-h-[90px]' : '[&_.ql-container]:min-h-[130px]'
      }`}
    />
  );
}
