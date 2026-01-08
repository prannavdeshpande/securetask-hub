import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Shield, User } from 'lucide-react';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';

const registerSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(100, 'Name must be less than 100 characters'),
  email: z.string().trim().email('Invalid email address').max(255, 'Email must be less than 255 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  role: z.enum(['user', 'admin'], { required_error: 'Please select a role' }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterForm = z.infer<typeof registerSchema>;

const Register = () => {
  const navigate = useNavigate();
  const { signUp, signInWithGoogle, sendEmailOtp, verifyEmailOtp, sendPhoneOtp, verifyPhoneOtp, user } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState<RegisterForm>({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'user',
  });
  const [adminPassword, setAdminPassword] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterForm, string>>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [useOtp, setUseOtp] = useState(false);
  const [otpMethod, setOtpMethod] = useState<'email' | 'phone'>('email');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpPhone, setOtpPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error for this field when user starts typing
    if (errors[name as keyof RegisterForm]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      registerSchema.parse(formData);
      
      // Verify admin password if registering as admin
      if (formData.role === 'admin') {
        if (!adminPassword) {
          toast({
            title: 'Admin Password Required',
            description: 'Please enter the admin verification password',
            variant: 'destructive',
          });
          return;
        }
        
        setIsLoading(true);
        
        try {
          const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-admin', {
            body: { password: adminPassword }
          });

          if (verifyError || !verifyData?.valid) {
            toast({
              title: 'Invalid Admin Password',
              description: 'The admin password you entered is incorrect',
              variant: 'destructive',
            });
            setIsLoading(false);
            return;
          }
        } catch (error) {
          console.error('Admin verification error:', error);
          toast({
            title: 'Error',
            description: 'Failed to verify admin password',
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }
      } else {
        setIsLoading(true);
      }
      
      const { error } = await signUp(formData.email, formData.password, formData.fullName, formData.role);
      
      if (!error) {
        // If the user was auto-signed-in, a session will exist and we can navigate to dashboard.
        // Otherwise, inform the user to confirm their email.
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          navigate('/dashboard');
        } else {
          toast({
            title: 'Registration successful',
            description: 'Please check your email to confirm your account before signing in.',
          });
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Partial<Record<keyof RegisterForm, string>> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as keyof RegisterForm] = err.message;
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
          <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
          <CardDescription>Enter your details to register</CardDescription>
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

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm">Use OTP registration</Label>
              <button
                type="button"
                className="text-sm text-primary hover:underline"
                onClick={() => {
                  setUseOtp((prev) => !prev);
                  setOtpSent(false);
                  setOtpCode('');
                }}
              >
                {useOtp ? 'Use email/password' : 'Use OTP'}
              </button>
            </div>

            {!useOtp && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    type="text"
                    placeholder="John Doe"
                    value={formData.fullName}
                    onChange={handleChange}
                    disabled={isLoading}
                    className={errors.fullName ? 'border-destructive' : ''}
                  />
                  {errors.fullName && (
                    <p className="text-sm text-destructive">{errors.fullName}</p>
                  )}
                </div>
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
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    disabled={isLoading}
                    className={errors.confirmPassword ? 'border-destructive' : ''}
                  />
                  {errors.confirmPassword && (
                    <p className="text-sm text-destructive">{errors.confirmPassword}</p>
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
                      disabled={otpLoading || !otpEmail || (formData.role === 'admin' && !adminPassword)}
                      onClick={async () => {
                        if (formData.role === 'admin') {
                          try {
                            const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-admin', {
                              body: { password: adminPassword }
                            });
                            if (verifyError || !verifyData?.valid) {
                              toast({ title: 'Invalid Admin Password', description: 'The admin password you entered is incorrect', variant: 'destructive' });
                              return;
                            }
                          } catch (error) {
                            toast({ title: 'Error', description: 'Failed to verify admin password', variant: 'destructive' });
                            return;
                          }
                        }
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
                      disabled={otpLoading || !otpPhone || (formData.role === 'admin' && !adminPassword)}
                      onClick={async () => {
                        if (formData.role === 'admin') {
                          try {
                            const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-admin', {
                              body: { password: adminPassword }
                            });
                            if (verifyError || !verifyData?.valid) {
                              toast({ title: 'Invalid Admin Password', description: 'The admin password you entered is incorrect', variant: 'destructive' });
                              return;
                            }
                          } catch (error) {
                            toast({ title: 'Error', description: 'Failed to verify admin password', variant: 'destructive' });
                            return;
                          }
                        }
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
                          const { data: { session } } = await supabase.auth.getSession();
                          const userId = session?.user?.id;
                          if (userId) {
                            await supabase.from('user_roles').upsert({ user_id: userId, role: formData.role });
                            if (formData.fullName) {
                              await supabase.from('profiles').upsert({ id: userId, full_name: formData.fullName });
                            }
                          }
                          navigate('/dashboard');
                        }
                      }}
                    >
                      {otpLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Verify & Create Account
                    </Button>
                  </div>
                )}
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select 
                value={formData.role} 
                onValueChange={(value) => {
                  setFormData(prev => ({ ...prev, role: value as 'user' | 'admin' }));
                  if (value === 'user') {
                    setAdminPassword('');
                  }
                }}
                disabled={isLoading}
              >
                <SelectTrigger id="role" className={errors.role ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>User - Can manage own tasks</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      <span>Admin - Can manage all tasks</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {errors.role && (
                <p className="text-sm text-destructive">{errors.role}</p>
              )}
            </div>

            {formData.role === 'admin' && (
              <div className="space-y-2">
                <Label htmlFor="adminPassword">Admin Verification Password</Label>
                <Input
                  id="adminPassword"
                  type="password"
                  placeholder="Enter admin verification password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  Contact your administrator for the admin password
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            {!useOtp && (
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Register
              </Button>
            )}
            <p className="text-sm text-center text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-primary hover:underline">
                Login
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default Register;
