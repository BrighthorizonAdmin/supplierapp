import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { changePassword } from '../userSlice';
import { KeyRound } from 'lucide-react';

const ChangePassword = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { loading } = useSelector((s) => s.users);
  const { isFirstLogin } = useSelector((s) => s.auth);

  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [error, setError] = useState('');

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      setError('All fields are required');
      return;
    }

    if (form.newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }

    if (form.currentPassword === form.newPassword) {
      setError('New password must be different from the current password');
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const res = await dispatch(
      changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      })
    );

    if (res.meta.requestStatus === 'fulfilled') {
      navigate('/dashboard');
    } else {
      setError(res.payload || 'Password change failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-primary-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4">
            <KeyRound className="text-white" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-white">
            {isFirstLogin ? 'Set Your Password' : 'Change Password'}
          </h1>
          <p className="text-slate-400 mt-1">
            {isFirstLogin
              ? 'Please set a new password before continuing'
              : 'Update your account password'}
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Current Password</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={form.currentPassword}
                onChange={handleChange('currentPassword')}
              />
            </div>

            <div>
              <label className="label">New Password</label>
              <input
                type="password"
                className="input"
                placeholder="Min. 6 characters"
                value={form.newPassword}
                onChange={handleChange('newPassword')}
              />
            </div>

            <div>
              <label className="label">Confirm New Password</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={form.confirmPassword}
                onChange={handleChange('confirmPassword')}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Updating...
                </span>
              ) : (
                'Update Password'
              )}
            </button>

            {!isFirstLogin && (
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="w-full py-3 text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancel
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;
