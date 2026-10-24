import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../services/authService';

/**
 * Azure AD Login Callback Page
 * Handles the redirect from /login-success?token=...&email=...
 * Extracts the JWT token, stores it, and redirects to dashboard.
 */
export default function AzureLoginCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const email = searchParams.get('email');

    if (token && email) {
      try {
        // Store the token and user info
        authService.setToken(token);
        const user = {
          email,
          name: searchParams.get('name') || email,
          tenant: searchParams.get('tenant') || 'AlphaCorp'
        };
        localStorage.setItem('user', JSON.stringify(user));

        console.log('Azure AD login successful, redirecting to dashboard...');
        
        // Redirect to home/dashboard after a brief delay
        setTimeout(() => {
          navigate('/');
        }, 500);
      } catch (error) {
        console.error('Error processing Azure AD login:', error);
        navigate('/login?error=processing_failed');
      }
    } else {
      const error = searchParams.get('error');
      console.error('Azure AD callback missing token or email. Error:', error);
      navigate(`/login?error=${error || 'missing_credentials'}`);
    }
  }, [searchParams, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-canvas">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center font-bold text-2xl text-white shadow-xl mx-auto mb-6">
          A
        </div>
        <div className="w-10 h-10 border-4 border-gray-200 border-t-primary rounded-full animate-spin mx-auto" />
        <p className="mt-4 text-sm font-medium text-on-surface-variant">
          Completing Azure AD login...
        </p>
      </div>
    </div>
  );
}
