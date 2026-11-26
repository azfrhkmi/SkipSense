import React, { useEffect, useMemo, useState } from 'react';
import { AuthService } from '../services/authService';
import { AuthUser, BootstrapStatus } from '../types/auth';
import {
  Zap,
  ShieldCheck,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';

interface AuthPageProps {
  onAuthenticated: (user: AuthUser) => void;
}

type AuthTab = 'LOGIN' | 'REGISTER' | 'BOOTSTRAP';

export const AuthPage: React.FC<AuthPageProps> = ({ onAuthenticated }) => {
  const [tab, setTab] = useState<AuthTab>('LOGIN');
  const [bootstrapStatus, setBootstrapStatus] = useState<BootstrapStatus | null>(null);

  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [setupKey, setSetupKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    AuthService.getBootstrapStatus()
      .then((status) => {
        setBootstrapStatus(status);
        if (status.needs_admin_setup) {
          setTab('BOOTSTRAP');
        }
      })
      .catch(() => {
        // Ignore if backend unreachable on first paint
      });
  }, []);

  const passwordRules = useMemo(
    () => [
      { label: '8+ characters', met: password.length >= 8 },
      { label: 'Uppercase (A-Z)', met: /[A-Z]/.test(password) },
      { label: 'Lowercase (a-z)', met: /[a-z]/.test(password) },
      { label: 'Number (0-9)', met: /\d/.test(password) },
      { label: 'Symbol (!@#$)', met: /[^A-Za-z0-9]/.test(password) },
    ],
    [password]
  );

  const passwordScore = passwordRules.filter((r) => r.met).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (tab === 'LOGIN') {
        const res = await AuthService.login({ identifier, password });
        onAuthenticated(res.user);
      } else if (tab === 'REGISTER') {
        const res = await AuthService.register({ username, email, password });
        onAuthenticated(res.user);
      } else {
        const res = await AuthService.bootstrapAdmin({
          username,
          email,
          password,
          setupKey: setupKey || undefined,
        });
        onAuthenticated(res.user);
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (nextTab: AuthTab) => {
    setTab(nextTab);
    setError(null);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#090B0D',
        color: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 18px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 440 }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #39E66B 0%, #24B852 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#090B0D',
              margin: '0 auto 12px auto',
              boxShadow: '0 8px 26px rgba(57, 230, 107, 0.35)',
            }}
          >
            <Zap size={28} strokeWidth={2.8} />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: -0.6 }}>SkipSense</h1>
          <p style={{ fontSize: 13, color: '#929BA3', marginTop: 4 }}>
            AI Fitness Tracker • Skipping &amp; Push-Ups
          </p>
        </div>

        {/* Auth Card */}
        <div
          style={{
            backgroundColor: '#12161A',
            border: '1px solid #232930',
            borderRadius: 24,
            padding: 24,
            boxShadow: '0 18px 48px rgba(0, 0, 0, 0.55)',
          }}
        >
          {/* First-Time Admin Setup Callout */}
          {bootstrapStatus?.needs_admin_setup && (
            <div
              style={{
                backgroundColor: 'rgba(168, 85, 247, 0.14)',
                border: '1px solid rgba(168, 85, 247, 0.45)',
                borderRadius: 14,
                padding: '10px 14px',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <ShieldAlert size={18} color="#C084FC" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: 12, color: '#E9D5FF', lineHeight: 1.35 }}>
                <strong>Initial Admin Setup Required:</strong> Create your primary administrator
                account to manage users and threat logs.
              </div>
            </div>
          )}

          {/* Mode Tabs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: bootstrapStatus?.needs_admin_setup
                ? 'repeat(3, 1fr)'
                : 'repeat(2, 1fr)',
              backgroundColor: '#0C0F12',
              padding: 4,
              borderRadius: 14,
              border: '1px solid #20262C',
              marginBottom: 20,
            }}
          >
            <button
              type="button"
              onClick={() => switchTab('LOGIN')}
              style={{
                padding: '9px 8px',
                borderRadius: 10,
                backgroundColor: tab === 'LOGIN' ? '#20262C' : 'transparent',
                color: tab === 'LOGIN' ? '#FFFFFF' : '#929BA3',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchTab('REGISTER')}
              style={{
                padding: '9px 8px',
                borderRadius: 10,
                backgroundColor: tab === 'REGISTER' ? '#20262C' : 'transparent',
                color: tab === 'REGISTER' ? '#39E66B' : '#929BA3',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              Create Account
            </button>
            {bootstrapStatus?.needs_admin_setup && (
              <button
                type="button"
                onClick={() => switchTab('BOOTSTRAP')}
                style={{
                  padding: '9px 8px',
                  borderRadius: 10,
                  backgroundColor: tab === 'BOOTSTRAP' ? '#2B1F3D' : 'transparent',
                  color: tab === 'BOOTSTRAP' ? '#C084FC' : '#929BA3',
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                Admin Setup
              </button>
            )}
          </div>

          {/* Error Alert */}
          {error && (
            <div
              className="animate-pop"
              style={{
                backgroundColor: 'rgba(240, 82, 82, 0.14)',
                border: '1px solid rgba(240, 82, 82, 0.45)',
                borderRadius: 12,
                padding: '10px 12px',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                fontSize: 13,
                color: '#FCA5A5',
              }}
            >
              <AlertCircle size={16} color="#F05252" style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {tab === 'LOGIN' ? (
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#929BA3',
                    marginBottom: 6,
                  }}
                >
                  Username or Email
                </label>
                <div style={{ position: 'relative' }}>
                  <User
                    size={16}
                    color="#5E676F"
                    style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}
                  />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="athlete@example.com"
                    autoComplete="username"
                    style={{
                      width: '100%',
                      height: 46,
                      backgroundColor: '#0C0F12',
                      border: '1px solid #252C33',
                      borderRadius: 12,
                      padding: '0 14px 0 40px',
                      color: '#FFFFFF',
                      fontSize: 14,
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#929BA3',
                      marginBottom: 6,
                    }}
                  >
                    Username
                  </label>
                  <div style={{ position: 'relative' }}>
                    <User
                      size={16}
                      color="#5E676F"
                      style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}
                    />
                    <input
                      type="text"
                      required
                      minLength={3}
                      maxLength={30}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="azfar_fitness"
                      autoComplete="username"
                      style={{
                        width: '100%',
                        height: 46,
                        backgroundColor: '#0C0F12',
                        border: '1px solid #252C33',
                        borderRadius: 12,
                        padding: '0 14px 0 40px',
                        color: '#FFFFFF',
                        fontSize: 14,
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#929BA3',
                      marginBottom: 6,
                    }}
                  >
                    Email Address
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail
                      size={16}
                      color="#5E676F"
                      style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}
                    />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      style={{
                        width: '100%',
                        height: 46,
                        backgroundColor: '#0C0F12',
                        border: '1px solid #252C33',
                        borderRadius: 12,
                        padding: '0 14px 0 40px',
                        color: '#FFFFFF',
                        fontSize: 14,
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Password Input */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#929BA3',
                  marginBottom: 6,
                }}
              >
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={16}
                  color="#5E676F"
                  style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={tab === 'LOGIN' ? 'current-password' : 'new-password'}
                  style={{
                    width: '100%',
                    height: 46,
                    backgroundColor: '#0C0F12',
                    border: '1px solid #252C33',
                    borderRadius: 12,
                    padding: '0 44px 0 40px',
                    color: '#FFFFFF',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    color: '#929BA3',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Optional Setup Key for Bootstrap on Vercel */}
            {tab === 'BOOTSTRAP' && (
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#929BA3',
                    marginBottom: 6,
                  }}
                >
                  Setup Key (Optional — only if ADMIN_SETUP_KEY is set on Vercel)
                </label>
                <input
                  type="password"
                  value={setupKey}
                  onChange={(e) => setSetupKey(e.target.value)}
                  placeholder="Leave blank if unset"
                  style={{
                    width: '100%',
                    height: 42,
                    backgroundColor: '#0C0F12',
                    border: '1px solid #252C33',
                    borderRadius: 12,
                    padding: '0 14px',
                    color: '#FFFFFF',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
              </div>
            )}

            {/* Password Strength Checklist for Register / Bootstrap */}
            {tab !== 'LOGIN' && (
              <div
                style={{
                  backgroundColor: '#0C0F12',
                  border: '1px solid #20262C',
                  borderRadius: 12,
                  padding: '10px 12px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 11,
                    fontWeight: 700,
                    marginBottom: 6,
                    color: passwordScore === 5 ? '#39E66B' : '#929BA3',
                  }}
                >
                  <span>Password Security Strength</span>
                  <span>{passwordScore}/5 checks</span>
                </div>
                <div
                  style={{
                    height: 4,
                    backgroundColor: '#1B2024',
                    borderRadius: 2,
                    marginBottom: 8,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${(passwordScore / 5) * 100}%`,
                      height: '100%',
                      backgroundColor:
                        passwordScore <= 2 ? '#F05252' : passwordScore < 5 ? '#F5B942' : '#39E66B',
                      transition: 'width 0.25s ease',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px' }}>
                  {passwordRules.map((rule) => (
                    <div
                      key={rule.label}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 11,
                        color: rule.met ? '#39E66B' : '#5E676F',
                      }}
                    >
                      <CheckCircle2 size={11} />
                      <span>{rule.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || (tab !== 'LOGIN' && passwordScore < 5)}
              style={{
                width: '100%',
                height: 50,
                borderRadius: 14,
                backgroundColor:
                  tab === 'BOOTSTRAP'
                    ? '#A855F7'
                    : loading || (tab !== 'LOGIN' && passwordScore < 5)
                    ? '#1E252C'
                    : '#39E66B',
                color:
                  tab === 'BOOTSTRAP'
                    ? '#FFFFFF'
                    : loading || (tab !== 'LOGIN' && passwordScore < 5)
                    ? '#5E676F'
                    : '#090B0D',
                fontSize: 15,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginTop: 4,
                cursor:
                  loading || (tab !== 'LOGIN' && passwordScore < 5) ? 'not-allowed' : 'pointer',
              }}
            >
              <span>
                {loading
                  ? 'Verifying...'
                  : tab === 'LOGIN'
                  ? 'Sign In'
                  : tab === 'REGISTER'
                  ? 'Create Athlete Account'
                  : 'Create Admin Account'}
              </span>
              {!loading && <ArrowRight size={17} strokeWidth={2.5} />}
            </button>
          </form>
        </div>

        {/* Security Assurance Footer */}
        <div
          style={{
            marginTop: 18,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 700,
              color: '#39E66B',
            }}
          >
            <ShieldCheck size={14} />
            <span>Argon2id Encrypted • HttpOnly CSRF Sessions • Brute-Force Lockout</span>
          </div>
          <p style={{ fontSize: 11, color: '#5E676F' }}>
            Camera AI runs locally on your phone. No video frames ever leave your device.
            {bootstrapStatus ? ` • DB: ${bootstrapStatus.database_backend}` : ''}
          </p>
        </div>
      </div>
    </div>
  );
};
