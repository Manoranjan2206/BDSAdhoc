using System.Security.Claims;
using BoldAdhocEmbed.Server.Models;
using Microsoft.AspNetCore.Http;

namespace BoldAdhocEmbed.Server.Services
{
    /// <summary>
    /// Resolves the authenticated user from JWT claims (case-insensitive
    /// claim lookups across Keycloak/OIDC conventions). All HTTP handlers
    /// that need RLS context must go through <see cref="GetAuthContext"/>
    /// instead of trusting client-supplied headers.
    /// </summary>
    public interface IAuthenticatedUser
    {
        AuthUserContext? GetAuthContext();
    }

    public sealed class AuthUserContext
    {
        public required string Email { get; init; }
        public required string Role { get; init; }
        public required string Region { get; init; }
        public required string TenantName { get; init; }
        public int TenantId { get; init; }
    }

    public class AuthenticatedUser : IAuthenticatedUser
    {
        private readonly IHttpContextAccessor _accessor;
        private readonly IUserStore _userStore;
        private readonly IConfiguration _config;
        private readonly ILogger<AuthenticatedUser> _logger;

        public AuthenticatedUser(
            IHttpContextAccessor accessor,
            IUserStore userStore,
            IConfiguration config,
            ILogger<AuthenticatedUser> logger)
        {
            _accessor = accessor ?? throw new ArgumentNullException(nameof(accessor));
            _userStore = userStore ?? throw new ArgumentNullException(nameof(userStore));
            _config = config ?? throw new ArgumentNullException(nameof(config));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public AuthUserContext? GetAuthContext()
        {
            var principal = _accessor.HttpContext?.User;
            if (principal?.Identity?.IsAuthenticated != true)
            {
                return null;
            }

            string? email = FindClaim(principal,
                "email", ClaimTypes.Email, "preferred_username", "sub", "user_name");
            string? role = FindClaim(principal,
                "role", ClaimTypes.Role, "roles", "realm_access.roles", "user_role");
            string? region = FindClaim(principal,
                "region", "Region", "user_region");
            string? tenant = FindClaim(principal,
                "tenant", "tenant_name", "org_id", "organization");
            string? tenantIdRaw = FindClaim(principal,"tenant_id", "tenantId");
            int parsedTenantId = int.TryParse(tenantIdRaw, out var parsed) ? parsed : 0;

            // Missing claims cannot be silently filled in by the server. The
            // caller must choose [AllowAnonymous] or fail-closed here.
            if (string.IsNullOrWhiteSpace(email)) return null;

            // Prefer the persisted user record (so password resets, role
            // changes, deactivations take effect immediately). Fall back to
            // the claim-derived context only if the store has no record —
            // admin tools or JIT-provisioned SSO users.
            var stored = _userStore.Get(email);
            if (stored != null && stored.IsActive)
            {
                return new AuthUserContext
                {
                    Email = stored.Email ?? email,
                    Role = !string.IsNullOrWhiteSpace(role) ? role! : (stored.Role ?? "User"),
                    Region = !string.IsNullOrWhiteSpace(region) ? region! : (stored.Region ?? ResolveDefaultRegion(stored.TenantName)),
                    TenantName = !string.IsNullOrWhiteSpace(tenant) ? tenant! : (stored.TenantName ?? "AlphaCorp"),
                    TenantId = parsedTenantId != 0 ? parsedTenantId : stored.TenantId,
                };
            }

            if (string.IsNullOrWhiteSpace(role) || string.IsNullOrWhiteSpace(region) || string.IsNullOrWhiteSpace(tenant))
            {
                _logger.LogWarning(
                    "JWT for {Email} missing required claims (role/region/tenant). Rejecting.", email);
                return null;
            }

            return new AuthUserContext
            {
                Email = email!,
                Role = role!,
                Region = region!,
                TenantName = tenant!,
                TenantId = parsedTenantId,
            };
        }

        private static string? FindClaim(ClaimsPrincipal principal, params string[] types)
        {
            foreach (var type in types)
            {
                var v = principal.FindFirstValue(type);
                if (!string.IsNullOrWhiteSpace(v)) return v;
            }
            return null;
        }

        private string ResolveDefaultRegion(string? tenantName)
        {
            if (string.IsNullOrWhiteSpace(tenantName)) return "North America";
            return _config.GetSection("TenantMappings")
                          .GetSection(tenantName)
                          .GetValue<string>("Region") ?? "North America";
        }
    }
}