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
    console.log('[AzureLoginCallback] Component mounted');
    
    const token = searchParams.get('token');
    const email = searchParams.get('email');

    console.log('[AzureLoginCallback] Token:', token ? `${token.substring(0, 20)}...` : 'null');
    console.log('[AzureLoginCallback] Email:', email);

    if (token && email) {
      try {
        console.log('[AzureLoginCallback] Step 1: Storing token...');
        // Store the token and user info
        authService.setToken(token);
        console.log('[AzureLoginCallback] Step 1: Token stored successfully');
        
        console.log('[AzureLoginCallback] Step 2: Creating user object...');
        const user = {
          email,
          name: searchParams.get('name') || email,
          tenant: searchParams.get('tenant') || 'AlphaCorp'
        };
        console.log('[AzureLoginCallback] Step 2: User object created:', user);
        
        console.log('[AzureLoginCallback] Step 3: Storing user in localStorage...');
        localStorage.setItem('boldreports_user', JSON.stringify(user));
        console.log('[AzureLoginCallback] Step 3: User stored successfully');
        
        console.log('[AzureLoginCallback] Step 4: Verifying token was stored...');
        const storedToken = authService.getToken();
        console.log('[AzureLoginCallback] Step 4: Verified token:', storedToken ? `${storedToken.substring(0, 20)}...` : 'null');
        
        console.log('[AzureLoginCallback] All steps completed successfully, redirecting to dashboard...');
        
        // Redirect to home/dashboard after a brief delay
        setTimeout(() => {
          console.log('[AzureLoginCallback] Redirecting to home...');
          navigate('/');
        }, 500);
      } catch (error) {
        console.error('[AzureLoginCallback] ERROR occurred:', error);
        console.error('[AzureLoginCallback] Error stack:', error.stack);
        console.error('[AzureLoginCallback] Error message:', error.message);
        navigate('/login?error=processing_failed');
      }
    } else {
      const error = searchParams.get('error');
      console.error('[AzureLoginCallback] Missing token or email');
      console.error('[AzureLoginCallback] URL params:', {
        token: token ? `${token.substring(0, 20)}...` : 'null',
        email,
        error
      });
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
