// react-select styles matching the design system's `.input` (rounded, hairline border, blue focus ring).
export const SELECT_STYLES = {
  control: (base, state) => ({
    ...base,
    minHeight: 38,
    borderRadius: 12,
    borderColor: state.isFocused ? '#3f6cf1' : '#e2e8f0',
    boxShadow: state.isFocused ? '0 0 0 4px #dde8ff' : '0 1px 2px rgba(16,24,40,0.04)',
    '&:hover': { borderColor: state.isFocused ? '#3f6cf1' : '#cbd5e1' },
    fontSize: 14,
  }),
  placeholder: (base) => ({ ...base, color: '#94a3b8' }),
  menu: (base) => ({ ...base, borderRadius: 12, overflow: 'hidden', boxShadow: '0 12px 32px -8px rgba(16,24,40,0.18)', zIndex: 40 }),
  option: (base, state) => ({
    ...base,
    fontSize: 14,
    backgroundColor: state.isSelected ? '#2853e0' : state.isFocused ? '#eff5ff' : 'white',
    color: state.isSelected ? 'white' : '#0f172a',
  }),
  multiValue: (base) => ({ ...base, borderRadius: 6, backgroundColor: '#eff5ff' }),
  multiValueLabel: (base) => ({ ...base, color: '#1f45c4', fontWeight: 600, fontSize: 12 }),
  multiValueRemove: (base) => ({ ...base, color: '#1f45c4', ':hover': { backgroundColor: '#dde8ff', color: '#1e357d' } }),
};
