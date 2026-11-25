import React from 'react';
import {
  AchievementBadge,
  ATHLETE_RANKS,
  MotivationProfile,
} from '../utils/motivationEngine';
import {
  X,
  Trophy,
  Zap,
  Flame,
  Gauge,
  Target,
  Crown,
  Heart,
  Sparkles,
  Lock,
} from 'lucide-react';

interface TrophyCaseModalProps {
  profile: MotivationProfile;
  onClose: () => void;
}

export const renderBadgeIcon = (icon: AchievementBadge['icon'], size = 20, color = '#39E66B') => {
  switch (icon) {
    case 'zap':
      return <Zap size={size} color={color} />;
    case 'flame':
      return <Flame size={size} color={color} />;
    case 'gauge':
      return <Gauge size={size} color={color} />;
    case 'target':
      return <Target size={size} color={color} />;
    case 'crown':
      return <Crown size={size} color={color} />;
    case 'heart':
      return <Heart size={size} color={color} />;
    case 'sparkles':
      return <Sparkles size={size} color={color} />;
    case 'trophy':
    default:
      return <Trophy size={size} color={color} />;
  }
};

export const TrophyCaseModal: React.FC<TrophyCaseModalProps> = ({ profile, onClose }) => {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(10px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        className="animate-pop"
        style={{
          backgroundColor: '#12161A',
          border: '1px solid #232930',
          borderRadius: 24,
          maxWidth: 500,
          width: '100%',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.75)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 22px 16px 22px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: '#FFFFFF' }}>
              Athlete Rank & Trophies
            </h2>
            <p style={{ fontSize: 12, color: '#929BA3' }}>
              {profile.unlockedBadgesCount} of {profile.badges.length} achievements unlocked •{' '}
              {profile.totalXp.toLocaleString()} Total XP
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              backgroundColor: '#1B2026',
              color: '#929BA3',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: 20, overflowY: 'auto' }}>
          {/* Rank Progression Card */}
          <div
            style={{
              backgroundColor: '#181E24',
              border: `1px solid ${profile.rank.color}44`,
              borderRadius: 18,
              padding: 16,
              marginBottom: 20,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: profile.rank.color,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}
                >
                  Level {profile.rank.level} Rank
                </span>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#FFFFFF' }}>
                  {profile.rank.title}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="tabular-nums" style={{ fontSize: 18, fontWeight: 900, color: profile.rank.color }}>
                  {profile.totalXp.toLocaleString()} XP
                </div>
                <div style={{ fontSize: 11, color: '#929BA3' }}>
                  {profile.rank.nextLevelXp !== null
                    ? `${profile.xpForNextLevel.toLocaleString()} XP to Lv.${profile.rank.level + 1}`
                    : 'Max Rank Achieved'}
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div
              style={{
                width: '100%',
                height: 8,
                backgroundColor: '#0E1216',
                borderRadius: 4,
                overflow: 'hidden',
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  width: `${profile.levelProgressPct}%`,
                  height: '100%',
                  backgroundColor: profile.rank.color,
                  borderRadius: 4,
                }}
              />
            </div>

            <div style={{ fontSize: 11, color: '#929BA3' }}>
              Earn XP: 1 XP per Jump • 5 XP per Push-Up • +50 XP per Completed Session
            </div>

            {/* Tier Pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {ATHLETE_RANKS.map((r) => {
                const isReached = profile.rank.level >= r.level;
                return (
                  <span
                    key={r.level}
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 10,
                      backgroundColor: isReached ? `${r.color}22` : '#111519',
                      border: `1px solid ${isReached ? `${r.color}66` : '#232930'}`,
                      color: isReached ? r.color : '#5E676F',
                    }}
                  >
                    Lv.{r.level} {r.title}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Achievements Grid */}
          <div style={{ fontSize: 12, fontWeight: 800, color: '#929BA3', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
            Achievement Badges
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {profile.badges.map((badge) => {
              const pct = Math.min(100, Math.round((badge.progress / badge.target) * 100));
              return (
                <div
                  key={badge.id}
                  style={{
                    backgroundColor: badge.unlocked ? '#182026' : '#111519',
                    border: `1px solid ${badge.unlocked ? `${badge.color}55` : '#232930'}`,
                    borderRadius: 16,
                    padding: 14,
                    opacity: badge.unlocked ? 1 : 0.78,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          backgroundColor: badge.unlocked ? `${badge.color}22` : '#1B2026',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {badge.unlocked ? (
                          renderBadgeIcon(badge.icon, 18, badge.color)
                        ) : (
                          <Lock size={15} color="#5E676F" />
                        )}
                      </div>
                      {badge.unlocked && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 800,
                            padding: '2px 7px',
                            borderRadius: 8,
                            backgroundColor: `${badge.color}22`,
                            color: badge.color,
                            textTransform: 'uppercase',
                          }}
                        >
                          Earned
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 13, fontWeight: 800, color: '#FFFFFF', marginBottom: 3 }}>
                      {badge.title}
                    </div>
                    <p style={{ fontSize: 11, color: '#929BA3', lineHeight: 1.35, marginBottom: 10 }}>
                      {badge.description}
                    </p>
                  </div>

                  {/* Progress footer */}
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 10,
                        fontWeight: 700,
                        color: badge.unlocked ? badge.color : '#5E676F',
                        marginBottom: 4,
                      }}
                    >
                      <span>{badge.unlocked ? 'Unlocked' : 'Progress'}</span>
                      <span className="tabular-nums">
                        {badge.progress}/{badge.target}
                      </span>
                    </div>
                    <div
                      style={{
                        width: '100%',
                        height: 4,
                        backgroundColor: '#0E1216',
                        borderRadius: 2,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          backgroundColor: badge.unlocked ? badge.color : '#5E676F',
                          borderRadius: 2,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

