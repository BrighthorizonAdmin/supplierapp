import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { changePassword } from '../userSlice';
import { KeyRound } from 'lucide-react';
import AuthLayout from '../../auth/components/AuthLayout';

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
    <AuthLayout
      icon={KeyRound}
      title={isFirstLogin ? 'Set your password' : 'Change password'}
      subtitle={isFirstLogin ? 'Please set a new password before continuing' : 'Update your account password'}
    >
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
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
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
    </AuthLayout>
  );
};

export default ChangePassword;
