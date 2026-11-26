import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthService } from '../services/authService';
import {
  AdminOverview,
  AdminUserDetail,
  AdminUserSummary,
  AuthUser,
  SecurityEvent,
} from '../types/auth';
import { buildMotivationProfile, estimateSessionCalories } from '../utils/motivationEngine';
import {
  ArrowLeft,
  ShieldAlert,
  ShieldCheck,
  Users,
  RefreshCw,
  CheckCircle2,
  Lock,
  Unlock,
  Ban,
  KeyRound,
  Search,
  Activity,
  Zap,
  Flame,
  Eye,
  Database,
  UserCog,
} from 'lucide-react';

interface AdminDashboardPageProps {
  currentUser: AuthUser;
  onBack: () => void;
}

type AdminTab = 'THREATS' | 'USERS' | 'SHIELD';

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  currentUser,
  onBack,
}) => {
  const [tab, setTab] = useState<AdminTab>('THREATS');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [threats, setThreats] = useState<SecurityEvent[]>([]);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [selectedUserDetail, setSelectedUserDetail] = useState<AdminUserDetail | null>(null);

  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [showOpenOnly, setShowOpenOnly] = useState<boolean>(false);
  const [userSearch, setUserSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, th, us] = await Promise.all([
        AuthService.getAdminOverview(),
        AuthService.getAdminThreats({
          severity: severityFilter,
          resolved: showOpenOnly ? false : undefined,
        }),
        AuthService.getAdminUsers(),
      ]);
      setOverview(ov);
      setThreats(th);
      setUsers(us);
    } catch (err: any) {
      setActionMsg(err?.message || 'Failed to load admin telemetry');
    } finally {
      setLoading(false);
    }
  }, [severityFilter, showOpenOnly]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const notify = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(null), 3200);
  };

  const handleOpenUserDashboard = async (userId: number) => {
    try {
      const detail = await AuthService.getAdminUserDashboard(userId);
      setSelectedUserDetail(detail);
      setTab('USERS');
    } catch (err: any) {
      notify(err?.message || 'Could not load user dashboard');
    }
  };

  const handleResolveThreat = async (id: number) => {
    await AuthService.resolveThreat(id);
    notify(`Threat #${id} marked resolved`);
    loadAll();
  };

  const handleResolveAll = async () => {
    await AuthService.resolveAllThreats();
    notify('All open threats marked resolved');
    loadAll();
  };

  const handleToggleActive = async (u: AdminUserSummary) => {
    try {
      const res = await AuthService.toggleUserActive(u.id);
      notify(`User @${u.username} ${res.is_active ? 'reactivated' : 'suspended'}`);
      loadAll();
      if (selectedUserDetail?.user.id === u.id) {
        handleOpenUserDashboard(u.id);
      }
    } catch (err: any) {
      notify(err?.message || 'Failed to update status');
    }
  };

  const handleUnlock = async (u: AdminUserSummary) => {
    await AuthService.unlockUser(u.id);
    notify(`Unlocked @${u.username}`);
    loadAll();
    if (selectedUserDetail?.user.id === u.id) {
      handleOpenUserDashboard(u.id);
    }
  };

  const handleRevokeSessions = async (u: AdminUserSummary) => {
    await AuthService.revokeUserSessions(u.id);
    notify(`All active sessions invalidated for @${u.username}`);
    loadAll();
  };

  const handleToggleRole = async (u: AdminUserSummary) => {
    try {
      const res = await AuthService.toggleUserRole(u.id);
      notify(`Updated @${u.username} role to ${res.role.toUpperCase()}`);
      loadAll();
      if (selectedUserDetail?.user.id === u.id) {
        handleOpenUserDashboard(u.id);
      }
    } catch (err: any) {
      notify(err?.message || 'Role update failed');
    }
  };

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  const inspectedProfile = useMemo(() => {
    if (!selectedUserDetail) return null;
    return buildMotivationProfile(selectedUserDetail.recent_workouts);
  }, [selectedUserDetail]);

  const getSeverityStyle = (sev: SecurityEvent['severity']) => {
    switch (sev) {
      case 'CRITICAL':
        return { bg: 'rgba(240, 82, 82, 0.2)', border: 'rgba(240, 82, 82, 0.5)', color: '#F05252' };
      case 'HIGH':
        return { bg: 'rgba(249, 115, 22, 0.18)', border: 'rgba(249, 115, 22, 0.45)', color: '#FB923C' };
      case 'MEDIUM':
        return { bg: 'rgba(245, 185, 66, 0.16)', border: 'rgba(245, 185, 66, 0.4)', color: '#F5B942' };
      default:
        return { bg: 'rgba(57, 230, 107, 0.14)', border: 'rgba(57, 230, 107, 0.35)', color: '#39E66B' };
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#090B0D',
        color: '#FFFFFF',
        padding: '20px 18px 48px 18px',
        maxWidth: 760,
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          marginBottom: 18,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={onBack}
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              backgroundColor: '#161B20',
              border: '1px solid #232930',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArrowLeft size={19} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: 21, fontWeight: 900 }}>Admin Security &amp; Users</h1>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 10,
                  backgroundColor: 'rgba(168, 85, 247, 0.2)',
                  color: '#C084FC',
                }}
              >
                SOC PORTAL
              </span>
            </div>
            <p style={{ fontSize: 12, color: '#929BA3' }}>
              Signed in as @{currentUser.username} • Real-time threat &amp; user telemetry
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {overview && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 11,
                fontWeight: 700,
                padding: '7px 11px',
                borderRadius: 10,
                backgroundColor: '#14191F',
                border: '1px solid #232930',
                color: '#5E96FF',
              }}
            >
              <Database size={13} />
              <span>{overview.database_backend}</span>
            </span>
          )}
          <button
            onClick={loadAll}
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              backgroundColor: '#161B20',
              border: '1px solid #232930',
              color: '#39E66B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionMsg && (
        <div
          className="animate-pop"
          style={{
            backgroundColor: 'rgba(57, 230, 107, 0.14)',
            border: '1px solid rgba(57, 230, 107, 0.45)',
            color: '#39E66B',
            borderRadius: 12,
            padding: '10px 14px',
            fontSize: 13,
            fontWeight: 700,
            marginBottom: 16,
          }}
        >
          {actionMsg}
        </div>
      )}

      {/* Top 4 KPIs */}
      {overview && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 12,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              backgroundColor: '#12161A',
              border:
                overview.unresolved_high_threats > 0
                  ? '1px solid rgba(240, 82, 82, 0.45)'
                  : '1px solid #232930',
              borderRadius: 18,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: '#929BA3', marginBottom: 4 }}>
              OPEN HIGH / CRITICAL THREATS
            </div>
            <div
              className="tabular-nums"
              style={{
                fontSize: 30,
                fontWeight: 900,
                color: overview.unresolved_high_threats > 0 ? '#F05252' : '#39E66B',
              }}
            >
              {overview.unresolved_high_threats}
            </div>
            <div style={{ fontSize: 11, color: '#929BA3', marginTop: 2 }}>
              {overview.total_threats_24h} total threat events in 24h
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#12161A',
              border: '1px solid #232930',
              borderRadius: 18,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: '#929BA3', marginBottom: 4 }}>
              BLOCKED ATTACKS (24H)
            </div>
            <div className="tabular-nums" style={{ fontSize: 30, fontWeight: 900, color: '#FF9F0A' }}>
              {overview.blocked_attempts_24h}
            </div>
            <div style={{ fontSize: 11, color: '#929BA3', marginTop: 2 }}>
              Lockouts, IDOR, probes &amp; escalation blocks
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#12161A',
              border: '1px solid #232930',
              borderRadius: 18,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: '#929BA3', marginBottom: 4 }}>
              REGISTERED USERS
            </div>
            <div className="tabular-nums" style={{ fontSize: 30, fontWeight: 900, color: '#5E96FF' }}>
              {overview.total_users}
            </div>
            <div style={{ fontSize: 11, color: '#929BA3', marginTop: 2 }}>
              {overview.active_users} active • {overview.locked_users} locked • {overview.suspended_users} suspended
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#12161A',
              border: '1px solid #232930',
              borderRadius: 18,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: '#929BA3', marginBottom: 4 }}>
              PLATFORM VOLUME
            </div>
            <div className="tabular-nums" style={{ fontSize: 30, fontWeight: 900, color: '#39E66B' }}>
              {overview.total_workouts}
            </div>
            <div style={{ fontSize: 11, color: '#929BA3', marginTop: 2 }}>
              {overview.total_platform_jumps.toLocaleString()} jumps • {overview.total_platform_pushups.toLocaleString()} push-ups
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          backgroundColor: '#12161A',
          border: '1px solid #232930',
          borderRadius: 14,
          padding: 4,
          marginBottom: 18,
        }}
      >
        <button
          onClick={() => {
            setSelectedUserDetail(null);
            setTab('THREATS');
          }}
          style={{
            padding: '10px 8px',
            borderRadius: 10,
            backgroundColor: tab === 'THREATS' ? '#232930' : 'transparent',
            color: tab === 'THREATS' ? '#F05252' : '#929BA3',
            fontSize: 13,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <ShieldAlert size={15} />
          <span>Threats</span>
        </button>

        <button
          onClick={() => setTab('USERS')}
          style={{
            padding: '10px 8px',
            borderRadius: 10,
            backgroundColor: tab === 'USERS' ? '#232930' : 'transparent',
            color: tab === 'USERS' ? '#5E96FF' : '#929BA3',
            fontSize: 13,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Users size={15} />
          <span>User Dashboards</span>
        </button>

        <button
          onClick={() => {
            setSelectedUserDetail(null);
            setTab('SHIELD');
          }}
          style={{
            padding: '10px 8px',
            borderRadius: 10,
            backgroundColor: tab === 'SHIELD' ? '#232930' : 'transparent',
            color: tab === 'SHIELD' ? '#39E66B' : '#929BA3',
            fontSize: 13,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <ShieldCheck size={15} />
          <span>Security Shield</span>
        </button>
      </div>

      {/* TAB 1: THREATS LOG */}
      {tab === 'THREATS' && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
              marginBottom: 14,
            }}
          >
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
                <button
                  key={sev}
                  onClick={() => setSeverityFilter(sev)}
                  style={{
                    padding: '6px 11px',
                    borderRadius: 10,
                    fontSize: 11,
                    fontWeight: 800,
                    backgroundColor: severityFilter === sev ? '#232930' : '#12161A',
                    border: '1px solid #2A3139',
                    color: severityFilter === sev ? '#FFFFFF' : '#929BA3',
                  }}
                >
                  {sev}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowOpenOnly((v) => !v)}
                style={{
                  padding: '6px 11px',
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 700,
                  backgroundColor: showOpenOnly ? 'rgba(245, 185, 66, 0.2)' : '#12161A',
                  border: '1px solid #2A3139',
                  color: showOpenOnly ? '#F5B942' : '#929BA3',
                }}
              >
                {showOpenOnly ? 'Open Alerts Only' : 'All Events'}
              </button>

              <button
                onClick={handleResolveAll}
                style={{
                  padding: '6px 12px',
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 800,
                  backgroundColor: 'rgba(57, 230, 107, 0.16)',
                  border: '1px solid rgba(57, 230, 107, 0.4)',
                  color: '#39E66B',
                }}
              >
                Resolve All
              </button>
            </div>
          </div>

          {threats.length === 0 ? (
            <div
              style={{
                backgroundColor: '#12161A',
                border: '1px solid #232930',
                borderRadius: 18,
                padding: '44px 20px',
                textAlign: 'center',
                color: '#929BA3',
              }}
            >
              <ShieldCheck size={38} color="#39E66B" style={{ marginBottom: 10 }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: '#FFFFFF' }}>No Matching Security Events</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>All perimeter checks and auth guards are clean.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {threats.map((ev) => {
                const st = getSeverityStyle(ev.severity);
                return (
                  <div
                    key={ev.id}
                    style={{
                      backgroundColor: '#12161A',
                      border: ev.resolved ? '1px solid #20262C' : `1px solid ${st.border}`,
                      borderRadius: 16,
                      padding: 14,
                      opacity: ev.resolved ? 0.72 : 1,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 10,
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: 8,
                            backgroundColor: st.bg,
                            color: st.color,
                          }}
                        >
                          {ev.severity}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#FFFFFF' }}>
                          {ev.event_type}
                        </span>
                        {ev.resolved && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: '#39E66B',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                          >
                            <CheckCircle2 size={11} /> Resolved
                          </span>
                        )}
                      </div>

                      <span style={{ fontSize: 11, color: '#5E676F', whiteSpace: 'nowrap' }}>
                        {new Date(ev.created_at).toLocaleString()}
                      </span>
                    </div>

                    <p style={{ fontSize: 12.5, color: '#CBD5E1', marginBottom: 8, lineHeight: 1.4 }}>
                      {ev.details}
                    </p>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 8,
                        fontSize: 11,
                        color: '#929BA3',
                      }}
                    >
                      <div>
                        IP: <code style={{ color: '#FFFFFF' }}>{ev.ip_address}</code>
                        {ev.endpoint ? ` • ${ev.endpoint}` : ''}
                        {ev.target_email ? ` • ${ev.target_email}` : ''}
                      </div>

                      <div style={{ display: 'flex', gap: 6 }}>
                        {ev.target_user_id && (
                          <button
                            onClick={() => handleOpenUserDashboard(ev.target_user_id!)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 8,
                              backgroundColor: 'rgba(94, 150, 255, 0.16)',
                              color: '#5E96FF',
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            View User
                          </button>
                        )}
                        {!ev.resolved && (
                          <button
                            onClick={() => handleResolveThreat(ev.id)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 8,
                              backgroundColor: 'rgba(57, 230, 107, 0.16)',
                              color: '#39E66B',
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            Mark Resolved
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: USERS & INDIVIDUAL USER DASHBOARDS */}
      {tab === 'USERS' && !selectedUserDetail && (
        <div>
          {/* Search Input */}
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <Search
              size={16}
              color="#5E676F"
              style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search athletes by username or email..."
              style={{
                width: '100%',
                height: 44,
                backgroundColor: '#12161A',
                border: '1px solid #232930',
                borderRadius: 12,
                padding: '0 14px 0 40px',
                color: '#FFFFFF',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredUsers.map((u) => (
              <div
                key={u.id}
                style={{
                  backgroundColor: '#12161A',
                  border: u.is_locked
                    ? '1px solid rgba(240, 82, 82, 0.45)'
                    : !u.is_active
                    ? '1px solid rgba(245, 185, 66, 0.4)'
                    : '1px solid #232930',
                  borderRadius: 18,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: 10,
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: '#FFFFFF' }}>
                        @{u.username}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 8,
                          textTransform: 'uppercase',
                          backgroundColor: u.role === 'admin' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(57, 230, 107, 0.14)',
                          color: u.role === 'admin' ? '#C084FC' : '#39E66B',
                        }}
                      >
                        {u.role}
                      </span>
                      {u.is_locked && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: 8,
                            backgroundColor: 'rgba(240, 82, 82, 0.2)',
                            color: '#F05252',
                          }}
                        >
                          LOCKED ({u.failed_login_attempts} fails)
                        </span>
                      )}
                      {!u.is_active && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: 8,
                            backgroundColor: 'rgba(245, 185, 66, 0.2)',
                            color: '#F5B942',
                          }}
                        >
                          SUSPENDED
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#929BA3', marginTop: 2 }}>
                      {u.email}
                      {u.last_login_ip ? ` • Last IP: ${u.last_login_ip}` : ''}
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenUserDashboard(u.id)}
                    style={{
                      padding: '8px 13px',
                      borderRadius: 10,
                      backgroundColor: '#5E96FF',
                      color: '#FFFFFF',
                      fontSize: 12,
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <Eye size={14} />
                    <span>Open Dashboard</span>
                  </button>
                </div>

                {/* User Workout Metrics */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 8,
                    backgroundColor: '#171C21',
                    borderRadius: 12,
                    padding: '10px 12px',
                    marginBottom: 12,
                    textAlign: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 10, color: '#929BA3' }}>SESSIONS</div>
                    <div className="tabular-nums" style={{ fontSize: 16, fontWeight: 800 }}>
                      {u.total_sessions}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#929BA3' }}>JUMPS</div>
                    <div className="tabular-nums" style={{ fontSize: 16, fontWeight: 800, color: '#39E66B' }}>
                      {u.total_jumps.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#929BA3' }}>PUSH-UPS</div>
                    <div className="tabular-nums" style={{ fontSize: 16, fontWeight: 800, color: '#5E96FF' }}>
                      {u.total_pushups.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Security Admin Actions */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {u.is_locked && (
                    <button
                      onClick={() => handleUnlock(u)}
                      style={{
                        padding: '6px 11px',
                        borderRadius: 9,
                        backgroundColor: 'rgba(57, 230, 107, 0.16)',
                        color: '#39E66B',
                        fontSize: 11,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Unlock size={12} /> Unlock
                    </button>
                  )}

                  <button
                    onClick={() => handleRevokeSessions(u)}
                    style={{
                      padding: '6px 11px',
                      borderRadius: 9,
                      backgroundColor: '#1B2128',
                      color: '#CBD5E1',
                      fontSize: 11,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <KeyRound size={12} /> Force Sign Out
                  </button>

                  {u.id !== currentUser.id && (
                    <>
                      <button
                        onClick={() => handleToggleActive(u)}
                        style={{
                          padding: '6px 11px',
                          borderRadius: 9,
                          backgroundColor: u.is_active ? 'rgba(240, 82, 82, 0.14)' : 'rgba(57, 230, 107, 0.16)',
                          color: u.is_active ? '#F05252' : '#39E66B',
                          fontSize: 11,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Ban size={12} /> {u.is_active ? 'Suspend' : 'Activate'}
                      </button>

                      <button
                        onClick={() => handleToggleRole(u)}
                        style={{
                          padding: '6px 11px',
                          borderRadius: 9,
                          backgroundColor: 'rgba(168, 85, 247, 0.15)',
                          color: '#C084FC',
                          fontSize: 11,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <UserCog size={12} /> {u.role === 'admin' ? 'Demote to User' : 'Make Admin'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DRILL-DOWN: INSPECT INDIVIDUAL USER DASHBOARD */}
      {tab === 'USERS' && selectedUserDetail && inspectedProfile && (
        <div>
          <button
            onClick={() => setSelectedUserDetail(null)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: '#161B20',
              border: '1px solid #232930',
              color: '#FFFFFF',
              padding: '8px 14px',
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            <ArrowLeft size={14} />
            <span>Back to All Users</span>
          </button>

          {/* Inspected User Hero */}
          <div
            style={{
              backgroundColor: '#12161A',
              border: '1px solid rgba(94, 150, 255, 0.35)',
              borderRadius: 20,
              padding: 18,
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 900 }}>
                  @{selectedUserDetail.user.username}&apos;s Dashboard
                </h2>
                <div style={{ fontSize: 12, color: '#929BA3' }}>
                  {selectedUserDetail.user.email} • Rank: Lv.{inspectedProfile.rank.level}{' '}
                  {inspectedProfile.rank.title} ({inspectedProfile.totalXp} XP) •{' '}
                  {inspectedProfile.currentStreak}d Streak
                </div>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '4px 10px',
                  borderRadius: 10,
                  backgroundColor: selectedUserDetail.user.is_active
                    ? 'rgba(57, 230, 107, 0.16)'
                    : 'rgba(240, 82, 82, 0.16)',
                  color: selectedUserDetail.user.is_active ? '#39E66B' : '#F05252',
                }}
              >
                {selectedUserDetail.user.is_active ? 'ACTIVE' : 'SUSPENDED'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, textAlign: 'center' }}>
              <div style={{ backgroundColor: '#181E24', borderRadius: 12, padding: 10 }}>
                <div style={{ fontSize: 10, color: '#929BA3' }}>WORKOUTS</div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{selectedUserDetail.stats.total_sessions}</div>
              </div>
              <div style={{ backgroundColor: '#181E24', borderRadius: 12, padding: 10 }}>
                <div style={{ fontSize: 10, color: '#929BA3' }}>JUMPS</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#39E66B' }}>
                  {selectedUserDetail.stats.total_lifetime_jumps}
                </div>
              </div>
              <div style={{ backgroundColor: '#181E24', borderRadius: 12, padding: 10 }}>
                <div style={{ fontSize: 10, color: '#929BA3' }}>PUSH-UPS</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#5E96FF' }}>
                  {selectedUserDetail.stats.total_lifetime_pushups || 0}
                </div>
              </div>
              <div style={{ backgroundColor: '#181E24', borderRadius: 12, padding: 10 }}>
                <div style={{ fontSize: 10, color: '#929BA3' }}>BEST PACE</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#FF9F0A' }}>
                  {Math.round(selectedUserDetail.stats.best_record_pace)}
                </div>
              </div>
            </div>
          </div>

          {/* User Workouts */}
          <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>Recent Workouts</h3>
          {selectedUserDetail.recent_workouts.length === 0 ? (
            <div style={{ backgroundColor: '#12161A', borderRadius: 14, padding: 16, color: '#929BA3', fontSize: 13, marginBottom: 18 }}>
              No recorded workouts for this athlete yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {selectedUserDetail.recent_workouts.slice(0, 10).map((w) => {
                const isPushUp = w.exercise_type === 'push_up';
                const count = isPushUp ? w.completed_reps ?? w.total_jumps : w.total_jumps;
                return (
                  <div
                    key={w.id}
                    style={{
                      backgroundColor: '#12161A',
                      border: '1px solid #232930',
                      borderRadius: 14,
                      padding: '10px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {isPushUp ? <Flame size={16} color="#5E96FF" /> : <Zap size={16} color="#39E66B" />}
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>
                          {isPushUp ? `Push-Up (${w.workout_mode || 'standard'})` : 'Skipping'} • {w.session_date}
                        </div>
                        <div style={{ fontSize: 11, color: '#929BA3' }}>
                          {Math.round(w.active_duration_seconds)}s active • {Math.round(w.average_jumps_per_minute)}{' '}
                          {isPushUp ? 'RPM' : 'JPM'} • ~{Math.round(estimateSessionCalories(w))} kcal
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: isPushUp ? '#5E96FF' : '#39E66B' }}>
                      {count} {isPushUp ? 'reps' : 'jumps'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* User Security Audit Trail */}
          <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>Account Security Events</h3>
          {selectedUserDetail.recent_security_events.length === 0 ? (
            <div style={{ backgroundColor: '#12161A', borderRadius: 14, padding: 16, color: '#929BA3', fontSize: 13 }}>
              No security events recorded for this user.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedUserDetail.recent_security_events.map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    backgroundColor: '#12161A',
                    border: '1px solid #232930',
                    borderRadius: 12,
                    padding: '10px 14px',
                    fontSize: 12,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <strong style={{ color: getSeverityStyle(ev.severity).color }}>{ev.event_type}</strong>
                    <span style={{ color: '#5E676F' }}>{new Date(ev.created_at).toLocaleString()}</span>
                  </div>
                  <div style={{ color: '#CBD5E1' }}>
                    {ev.details} • IP: {ev.ip_address}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SECURITY SHIELD STATUS */}
      {tab === 'SHIELD' && overview && (
        <div
          style={{
            backgroundColor: '#12161A',
            border: '1px solid rgba(57, 230, 107, 0.3)',
            borderRadius: 20,
            padding: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                backgroundColor: 'rgba(57, 230, 107, 0.16)',
                color: '#39E66B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Lock size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 900 }}>Active Hardened Defenses</h2>
              <p style={{ fontSize: 12, color: '#929BA3' }}>
                Verified real-time defenses guarding API routes &amp; PostgreSQL/SQLite persistence
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {overview.security_controls.map((ctrl) => (
              <div
                key={ctrl}
                style={{
                  backgroundColor: '#181E24',
                  borderRadius: 12,
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
                  <CheckCircle2 size={16} color="#39E66B" />
                  <span>{ctrl}</span>
                </div>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#39E66B' }}>ENFORCED</span>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 16,
              backgroundColor: '#0E1216',
              borderRadius: 12,
              padding: 14,
              fontSize: 12,
              color: '#929BA3',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Activity size={16} color="#5E96FF" style={{ flexShrink: 0 }} />
            <span>
              Database Engine: <strong style={{ color: '#FFFFFF' }}>{overview.database_backend}</strong> •
              Serverless rate-limits and lockouts persist directly in the database across cold starts.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
