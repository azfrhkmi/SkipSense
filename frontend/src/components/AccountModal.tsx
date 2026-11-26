import React, { useState } from 'react';
import { AuthUser } from '../types/auth';
import { AuthService } from '../services/authService';
import { X, LogOut, KeyRound, ShieldCheck, CheckCircle2, AlertCircle, User } from 'lucide-react';

interface AccountModalProps {
  user: AuthUser;
  onClose: () => void;
  onUserUpdated: (user: AuthUser) => void;
  onLogout: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  user,
  onClose,
  onUserUpdated,
  onLogout,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);
    setLoading(true);
    try {
      const res = await AuthService.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      onUserUpdated(res.user);
      setCurrentPassword('');
      setNewPassword('');
      setStatusMsg('Password updated & all prior sessions revoked.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
      }}
    >
      <div
        className="animate-pop"
        style={{
          backgroundColor: '#12161A',
          border: '1px solid #232930',
          borderRadius: 24,
          maxWidth: 440,
          width: '100%',
          padding: 22,
          boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 18,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: user.role === 'admin' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(57, 230, 107, 0.16)',
                color: user.role === 'admin' ? '#C084FC' : '#39E66B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <User size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 17, fontWeight: 800, color: '#FFFFFF' }}>
                  @{user.username}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 10,
                    textTransform: 'uppercase',
                    backgroundColor: user.role === 'admin' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(57, 230, 107, 0.15)',
                    color: user.role === 'admin' ? '#C084FC' : '#39E66B',
                  }}
                >
                  {user.role}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#929BA3' }}>{user.email}</div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              backgroundColor: '#1B2026',
              color: '#929BA3',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Security Status Bar */}
        <div
          style={{
            backgroundColor: '#181E24',
            borderRadius: 14,
            padding: '10px 14px',
            marginBottom: 18,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: '#CBD5E1',
          }}
        >
          <ShieldCheck size={16} color="#39E66B" />
          <span>
            Session secured via HttpOnly JWT &amp; CSRF token
            {user.last_login_at
              ? ` • Signed in ${new Date(user.last_login_at).toLocaleDateString()}`
              : ''}
          </span>
        </div>

        {/* Change Password Form */}
        <form
          onSubmit={handlePasswordChange}
          style={{
            backgroundColor: '#0E1216',
            border: '1px solid #20262C',
            borderRadius: 16,
            padding: 16,
            marginBottom: 18,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800, marginBottom: 12 }}>
            <KeyRound size={15} color="#5E96FF" />
            <span>Update Password</span>
          </div>

          {errorMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#FCA5A5', fontSize: 12, marginBottom: 10 }}>
              <AlertCircle size={14} color="#F05252" />
              <span>{errorMsg}</span>
            </div>
          )}

          {statusMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#39E66B', fontSize: 12, marginBottom: 10 }}>
              <CheckCircle2 size={14} />
              <span>{statusMsg}</span>
            </div>
          )}

          <input
            type="password"
            required
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            style={{
              width: '100%',
              height: 40,
              backgroundColor: '#14191E',
              border: '1px solid #252C33',
              borderRadius: 10,
              padding: '0 12px',
              color: '#FFFFFF',
              fontSize: 13,
              marginBottom: 8,
              outline: 'none',
            }}
          />
          <input
            type="password"
            required
            minLength={8}
            placeholder="New strong password (8+ chars, A-Z, 0-9, !@#)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={{
              width: '100%',
              height: 40,
              backgroundColor: '#14191E',
              border: '1px solid #252C33',
              borderRadius: 10,
              padding: '0 12px',
              color: '#FFFFFF',
              fontSize: 13,
              marginBottom: 10,
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              height: 40,
              borderRadius: 10,
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              color: '#FFFFFF',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {loading ? 'Updating...' : 'Rotate Password & Sessions'}
          </button>
        </form>

        {/* Sign Out */}
        <button
          onClick={onLogout}
          style={{
            width: '100%',
            height: 46,
            borderRadius: 14,
            backgroundColor: 'rgba(240, 82, 82, 0.14)',
            border: '1px solid rgba(240, 82, 82, 0.4)',
            color: '#F05252',
            fontSize: 14,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <LogOut size={16} />
          <span>Sign Out Safely</span>
        </button>
      </div>
    </div>
  );
};
