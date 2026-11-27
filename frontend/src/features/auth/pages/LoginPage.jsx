import { useEffect } from 'react';
import AuthLayout from '../components/AuthLayout';
import { LogIn } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useDispatch, useSelector } from 'react-redux';
import { login } from '../authSlice';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';

const LoginPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { loading, error } = useSelector((s) => s.auth);
  const { register, handleSubmit, formState: { errors } } = useForm();

  useEffect(() => {
    if (location.state?.message) {
      toast.success(location.state.message);
    }
  }, []);

  // const onSubmit = (data) => dispatch(login(data));

  const onSubmit = async (data) => {
  const res = await dispatch(login(data));

  if (res.meta.requestStatus === 'fulfilled') {
    const { permissions } = res.payload;
   
    if (permissions.includes('*') || permissions.includes('dashboard:read')) {
      navigate('/dashboard');
    } else if (permissions.includes('audit:read')) {
      navigate('/audit');
    } else if (permissions.includes('orders:read')) {
      navigate('/orders');
    } else if (permissions.includes('marketing:read')) {
      navigate('/marketing-leads');
    } else if (permissions.includes('finance:read')) {
      navigate('/finance');
    } else {
      navigate('/unauthorized');
    }
  }
};

  return (
    <AuthLayout icon={LogIn} title="Welcome back" subtitle="Sign in to your supplier account">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="label">Email address</label>
              <input
                type="email"
                className="input"
                placeholder="admin@example.com"
                {...register('email', { required: 'Email is required' })}
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label">Password</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                {...register('password', { required: 'Password is required' })}
              />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <div className="flex justify-end text-sm mt-2">
              <Link
                to="/forgot-password"
                className="text-blue-600 hover:underline"
              >
                Reset Password?
              </Link>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
    </AuthLayout>
  );
};

export default LoginPage;
