import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../../../services/api';
import { KeyRound } from 'lucide-react';

const ResetPasswordPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.newPassword || !form.confirmPassword) {
      setError('All fields are required');
      return;
    }
    if (form.newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await api.post(`/auth/reset-password/${token}`, { newPassword: form.newPassword });
      navigate('/login', { state: { message: 'Password reset successfully. Please sign in.' } });
    } catch (err) {
      setError(err.response?.data?.message || 'Reset link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-primary-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4">
            <KeyRound className="text-white" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-white">Set New Password</h1>
          <p className="text-slate-400 mt-1">Choose a strong password for your account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">New Password</label>
              <input
                type="password"
                className="input"
                placeholder="Min. 8 characters"
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
                  Resetting...
                </span>
              ) : (
                'Reset Password'
              )}
            </button>

            <div className="text-center">
              <Link to="/login" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
                Back to Sign In
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
