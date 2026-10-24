using System;
using System.Collections.Concurrent;
using BoldAdhocEmbed.Server.Models;
using Microsoft.Extensions.Logging;

namespace BoldAdhocEmbed.Server.Services.QuickEdit
{
    /// <summary>
    /// In-memory store for Quick Edit sessions. Held as a process-wide
    /// singleton so the dictionary survives across HTTP requests — a
    /// scoped store would be rebuilt every request and the sessionId
    /// minted by /load would be unknown to /save a few seconds later.
    ///
    /// Sessions expire after 20 minutes. Expired sessions are evicted
    /// lazily on access (TryGet) so we don't need a background timer.
    ///
    /// Survives single-instance deploys only. Phase 2: move to
    /// <see cref="ICacheService"/> or Redis for cross-instance support.
    /// </summary>
    public interface IQuickEditSessionStore
    {
        string Add(QuickEditSession session);
        bool TryGet(string sessionId, out QuickEditSession session);
        bool Remove(string sessionId);
    }

    public class QuickEditSessionStore : IQuickEditSessionStore
    {
        private static readonly TimeSpan SessionTtl = TimeSpan.FromMinutes(20);

        private readonly ConcurrentDictionary<string, QuickEditSession> _sessions = new();
        private readonly ILogger<QuickEditSessionStore> _logger;

        public QuickEditSessionStore(ILogger<QuickEditSessionStore> logger)
        {
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public string Add(QuickEditSession session)
        {
            if (session == null) throw new ArgumentNullException(nameof(session));
            if (string.IsNullOrEmpty(session.SessionId))
                session.SessionId = Guid.NewGuid().ToString("N");
            if (session.ExpiresAt == default)
                session.ExpiresAt = DateTime.UtcNow.Add(SessionTtl);
            _sessions[session.SessionId] = session;
            _logger.LogDebug("QuickEdit session {Sid} added (ttl={Ttl}m)",
                session.SessionId, SessionTtl.TotalMinutes);
            return session.SessionId;
        }

        public bool TryGet(string sessionId, out QuickEditSession session)
        {
            session = null!;
            if (string.IsNullOrEmpty(sessionId)) return false;
            if (!_sessions.TryGetValue(sessionId, out var s) || s == null) return false;

            if (s.ExpiresAt < DateTime.UtcNow)
            {
                _sessions.TryRemove(sessionId, out _);
                _logger.LogDebug("QuickEdit session {Sid} expired and evicted", sessionId);
                return false;
            }
            session = s;
            return true;
        }

        public bool Remove(string sessionId)
        {
            if (string.IsNullOrEmpty(sessionId)) return false;
            var removed = _sessions.TryRemove(sessionId, out _);
            if (removed) _logger.LogDebug("QuickEdit session {Sid} removed", sessionId);
            return removed;
        }
    }
}
