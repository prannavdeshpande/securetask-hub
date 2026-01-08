import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

const Login = () => {
  const navigate = useNavigate();
  const { signIn, signInWithGoogle, sendEmailOtp, verifyEmailOtp, sendPhoneOtp, verifyPhoneOtp, user } = useAuth();
  const [formData, setFormData] = useState<LoginForm>({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof LoginForm, string>>>({});
  const [isLoading, setIsLoading] = useState(false);
  // OTP state
  const [useOtp, setUseOtp] = useState(false);
  const [otpMethod, setOtpMethod] = useState<'email' | 'phone'>('email');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpPhone, setOtpPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error for this field when user starts typing
    if (errors[name as keyof LoginForm]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      loginSchema.parse(formData);
      setIsLoading(true);
      
      const { error } = await signIn(formData.email, formData.password);
      
      if (!error) {
        navigate('/dashboard');
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Partial<Record<keyof LoginForm, string>> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as keyof LoginForm] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
          <CardDescription>Enter your credentials to login</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => signInWithGoogle('user')}
                disabled={isLoading}
              >
                Continue with Google (User)
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => signInWithGoogle('admin', adminPassword)}
                disabled={isLoading}
              >
                Continue with Google (Admin)
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminPassword">Admin password (for Admin Google sign-in)</Label>
              <Input
                id="adminPassword"
                type="password"
                placeholder="Enter admin verification password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">Only required if you click the Admin Google button.</p>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>
            {/* Toggle between password and OTP login */}
            <div className="flex items-center justify-between">
              <Label className="text-sm">Use OTP login</Label>
              <button
                type="button"
                className="text-sm text-primary hover:underline"
                onClick={() => {
                  setUseOtp((prev) => !prev);
                  // reset OTP state when toggling
                  setOtpSent(false);
                  setOtpCode('');
                }}
              >
                {useOtp ? 'Use password instead' : 'Use OTP instead'}
              </button>
            </div>

            {!useOtp && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={isLoading}
                    className={errors.email ? 'border-destructive' : ''}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={isLoading}
                    className={errors.password ? 'border-destructive' : ''}
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  )}
                </div>
              </>
            )}

            {useOtp && (
              <>
                <div className="space-y-2">
                  <Label>OTP Method</Label>
                  <div className="flex gap-2">
                    <Button type="button" variant={otpMethod === 'email' ? 'default' : 'outline'} onClick={() => setOtpMethod('email')} disabled={otpLoading}>
                      Email
                    </Button>
                    <Button type="button" variant={otpMethod === 'phone' ? 'default' : 'outline'} onClick={() => setOtpMethod('phone')} disabled={otpLoading}>
                      Phone
                    </Button>
                  </div>
                </div>

                {otpMethod === 'email' ? (
                  <div className="space-y-2">
                    <Label htmlFor="otpEmail">Email</Label>
                    <Input
                      id="otpEmail"
                      type="email"
                      placeholder="john@example.com"
                      value={otpEmail}
                      onChange={(e) => setOtpEmail(e.target.value)}
                      disabled={otpLoading}
                    />
                    <Button
                      type="button"
                      className="w-full"
                      disabled={otpLoading || !otpEmail}
                      onClick={async () => {
                        setOtpLoading(true);
                        const { error } = await sendEmailOtp(otpEmail);
                        setOtpSent(!error);
                        setOtpLoading(false);
                      }}
                    >
                      {otpLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Send Email OTP
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="otpPhone">Phone (India supported)</Label>
                    <Input
                      id="otpPhone"
                      type="tel"
                      placeholder="10-digit or +91XXXXXXXXXX"
                      value={otpPhone}
                      onChange={(e) => setOtpPhone(e.target.value)}
                      disabled={otpLoading}
                    />
                    <p className="text-xs text-muted-foreground">10-digit Indian numbers are auto-formatted to +91.</p>
                    <Button
                      type="button"
                      className="w-full"
                      disabled={otpLoading || !otpPhone}
                      onClick={async () => {
                        setOtpLoading(true);
                        const { error } = await sendPhoneOtp(otpPhone);
                        setOtpSent(!error);
                        setOtpLoading(false);
                      }}
                    >
                      {otpLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Send SMS OTP
                    </Button>
                  </div>
                )}

                {otpSent && (
                  <div className="space-y-2">
                    <Label htmlFor="otpCode">Enter 6-digit code</Label>
                    <Input
                      id="otpCode"
                      type="text"
                      placeholder="123456"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      disabled={otpLoading}
                    />
                    <Button
                      type="button"
                      className="w-full"
                      disabled={otpLoading || otpCode.length === 0}
                      onClick={async () => {
                        setOtpLoading(true);
                        const result = otpMethod === 'email'
                          ? await verifyEmailOtp(otpEmail, otpCode)
                          : await verifyPhoneOtp(otpPhone, otpCode);
                        setOtpLoading(false);
                        if (!result.error) {
                          navigate('/dashboard');
                        }
                      }}
                    >
                      {otpLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Verify & Sign In
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            {!useOtp && (
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Login
              </Button>
            )}
            <p className="text-sm text-center text-muted-foreground">
              Don't have an account?{' '}
              <Link to="/register" className="text-primary hover:underline">
                Register
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default Login;
