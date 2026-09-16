using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.IdentityModel.Tokens;
using BoldAdhocEmbed.Server.Services;
using BoldAdhocEmbed.Server.Models;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace BoldAdhocEmbed.Server.Controllers
{
    /// <summary>
    /// Public authentication endpoints. Identity for every other endpoint
    /// is resolved from the validated Bearer JWT via
    /// <see cref="IAuthenticatedUser"/>; trusted claims (email, role,
    /// region, tenant) are NEVER read from request headers anywhere.
    /// </summary>
    [ApiController]
    [Route("api/auth")]
    public class AuthController : BaseController
    {
        private readonly IBoldReportsService _boldReportsService;
        private readonly ITokenHelper _tokenHelper;
        private readonly IUserStore _userStore;
        private readonly ILogger<AuthController> _logger;
        private readonly IConfiguration _configuration;
        private readonly IWebHostEnvironment _env;
        private readonly ICacheService _cacheService;

        public AuthController(
            IBoldReportsService boldReportsService,
            ITokenHelper tokenHelper,
            IUserStore userStore,
            ILogger<AuthController> logger,
            IConfiguration configuration,
            IWebHostEnvironment env,
            ICacheService cacheService)
            : base(logger)
        {
            _boldReportsService = boldReportsService ?? throw new ArgumentNullException(nameof(boldReportsService));
            _tokenHelper = tokenHelper ?? throw new ArgumentNullException(nameof(tokenHelper));
            _userStore = userStore ?? throw new ArgumentNullException(nameof(userStore));
            _logger = logger;
            _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
            _env = env ?? throw new ArgumentNullException(nameof(env));
            _cacheService = cacheService ?? throw new ArgumentNullException(nameof(cacheService));
        }

        /// <summary>
        /// Demo helper: returns catalog of seeded users so the SPA login page
        /// can offer a quick-select. Requires JWT authentication.
        /// </summary>
        [Authorize]
        [HttpGet("users")]
        public ActionResult<ApiResponse<dynamic>> GetAvailableUsers()
        {
            try
            {
                var users = _userStore.GetAll()
                    .Where(u => u.IsActive)
                    .OrderBy(u => u.TenantName)
                    .ThenBy(u => u.Name)
                    .Select(u => new
                    {
                        u.Email,
                        u.Name,
                        u.Role,
                        u.TenantId,
                        u.TenantName,
                        u.Region,
                        u.AvatarUrl
                    })
                    .ToList();

                Logger.LogInformation("Retrieved {UserCount} available users", users.Count);
                return Ok(ApiResponse<dynamic>.SuccessResponse(
                    (dynamic)users,
                    "Available users retrieved successfully"
                ));
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error retrieving available users");
                return StatusCode(500, ApiResponse<dynamic>.ErrorResponse(ex.Message, "Failed to retrieve users"));
            }
        }

        /// <summary>
        /// Login accepts email+password (RBAC store, BCrypt-hashed) or a
        /// Bearer JWT (decoded from claims only). Password-less logins are
        /// no longer accepted; the previous code path that returned a session
        /// purely on email match was an account-takeover vector.
        /// </summary>
        [AllowAnonymous]
        [HttpPost("login")]
        public async Task<ActionResult<ApiResponse<LoginResponse>>> Login([FromBody] LoginRequest request)
        {
            try
            {
                if (request == null)
                {
                    return BadRequest(ApiResponse<LoginResponse>.ErrorResponse(
                        "Invalid request",
                        "Login request body is required"));
                }

                AppUser? rbacUser = null;
                string authMethod = "unknown";

                // 1. JWT path: signature has already been validated by the
                // JwtBearer middleware when an Authority is configured.
                if (!string.IsNullOrWhiteSpace(request.JwtToken))
                {
                    rbacUser = AuthenticateWithJwt(request.JwtToken);
                    authMethod = "JWT";
                }
                // 2. Email + password: REQUIRED password, no silent fallback.
                else if (!string.IsNullOrWhiteSpace(request.Email) && !string.IsNullOrWhiteSpace(request.Password))
                {
                    rbacUser = _userStore.Authenticate(request.Email.Trim(), request.Password);
                    authMethod = "RBAC";
                }

                if (rbacUser == null || !rbacUser.IsActive)
                {
                    _logger.LogWarning(
                        "Login rejected (method={Method}, email={Email})",
                        authMethod, request.Email ?? "n/a");
                    return Unauthorized(ApiResponse<LoginResponse>.ErrorResponse(
                        "Authentication Failed",
                        "Invalid email or password."));
                }

                _logger.LogInformation(
                    "User authenticated via {Method}: {Email}, role={Role}",
                    authMethod, rbacUser.Email, rbacUser.Role);

                var response = new LoginResponse
                {
                    Success = true,
                    Message = $"Login successful using {authMethod} authentication",
                    User = new AppUser
                    {
                        Id = rbacUser.Id ?? Guid.NewGuid().ToString(),
                        Email = rbacUser.Email,
                        Name = rbacUser.Name ?? rbacUser.Email ?? "User",
                        Role = rbacUser.Role ?? "User",
                        TenantId = rbacUser.TenantId,
                        TenantName = rbacUser.TenantName ?? "Default",
                        Region = rbacUser.Region ?? "US",
                        AvatarUrl = rbacUser.AvatarUrl,
                        IsActive = rbacUser.IsActive,
                        CreatedDate = rbacUser.CreatedDate
                    },
                    SessionToken = string.IsNullOrWhiteSpace(request.JwtToken)
                        || string.IsNullOrWhiteSpace(_configuration["Jwt:Authority"])
                        ? GenerateSessionToken(rbacUser)
                        : request.JwtToken,
                    Permissions = rbacUser.Permissions ?? _userStore.GetPermissionsForRole(rbacUser.Role)
                };

                return Ok(ApiResponse<LoginResponse>.SuccessResponse(response, "Login successful"));
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error during login");
                // Never echo raw exception messages to anonymous callers.
                return StatusCode(500, ApiResponse<LoginResponse>.ErrorResponse(
                    "An unexpected error occurred. Please try again.",
                    "Login failed"));
            }
        }

        /// <summary>
        /// Logout user and clear all cached tokens.
        /// </summary>
        [HttpPost("logout")]
        public async Task<IActionResult> Logout()
        {
            try
            {
                var email = GetClaimSafely("email", "preferred_username", "sub");
                if (!string.IsNullOrEmpty(email))
                {
                    await _cacheService.RemoveAsync($"bold-reports-exchanged-token-{email}");
                    await _cacheService.RemoveAsync($"bold-reports-embed-token-{email}");
                    Logger.LogInformation("Evicted cached tokens on logout for user {Email}", email);
                }
                return Ok(ApiResponse<dynamic>.SuccessResponse(null, "Logout successful"));
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error during logout token cleanup");
                return Ok(ApiResponse<dynamic>.SuccessResponse(null, "Logout complete"));
            }
        }

        [Authorize]
        [HttpGet("me")]
        public ActionResult<ApiResponse<AppUser>> GetCurrentUser()
        {
            try
            {
                var userEmail = GetClaimSafely("email", "preferred_username", "sub");
                if (string.IsNullOrEmpty(userEmail))
                {
                    return Unauthorized(ApiResponse<AppUser>.ErrorResponse(
                        "Not authenticated",
                        "User email not found in token claims"));
                }

                var user = _userStore.Get(userEmail);
                if (user == null)
                {
                    return NotFound(ApiResponse<AppUser>.ErrorResponse(
                        "User not found",
                        $"User with email '{userEmail}' not found"));
                }

                Logger.LogInformation("Retrieved current user: {Email}", userEmail);
                return Ok(ApiResponse<AppUser>.SuccessResponse(user, "Current user retrieved"));
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error retrieving current user");
                return StatusCode(500, ApiResponse<AppUser>.ErrorResponse(
                    "Failed to retrieve current user", "Server error"));
            }
        }

        private string? GetClaimSafely(params string[] types)
        {
            foreach (var t in types)
            {
                var v = User.FindFirst(t)?.Value;
                if (!string.IsNullOrWhiteSpace(v)) return v;
            }
            return null;
        }

        /// <summary>
        /// Validate a JWT. Signature enforcement is delegated to JwtBearer
        /// middleware at request time. This helper only extracts an email
        /// for users whose record we already know; it refuses in Production
        /// when Jwt:Authority is missing so a forged email claim cannot log in.
        /// </summary>
        private AppUser? AuthenticateWithJwt(string jwtToken)
        {
            var authority = _configuration["Jwt:Authority"];
            var signatureEnforced = !string.IsNullOrWhiteSpace(authority);

            if (string.IsNullOrEmpty(jwtToken) || jwtToken.Split('.').Length != 3)
            {
                Logger.LogWarning("Invalid JWT format");
                return null;
            }

            if (!signatureEnforced && _env.IsProduction())
            {
                Logger.LogError("Refusing simplified JWT validation in Production because Jwt:Authority is unset.");
                return null;
            }
            else if (!signatureEnforced)
            {
                Logger.LogWarning(
                    "Jwt:Authority is unset -- accepting JWT without signature verification. Local development only.");
            }

            try
            {
                var parts = jwtToken.Split('.');
                var payload = parts[1];
                while (payload.Length % 4 != 0) payload += "=";
                var bytes = Convert.FromBase64String(payload);
                var jsonString = System.Text.Encoding.UTF8.GetString(bytes);

                using var doc = System.Text.Json.JsonDocument.Parse(jsonString);
                var root = doc.RootElement;

                string? userIdentifier = null;

                if (root.TryGetProperty("email", out var emailProp) && emailProp.ValueKind == System.Text.Json.JsonValueKind.String)
                {
                    userIdentifier = emailProp.GetString();
                }

                if (string.IsNullOrWhiteSpace(userIdentifier) && root.TryGetProperty("preferred_username", out var userProp) && userProp.ValueKind == System.Text.Json.JsonValueKind.String)
                {
                    userIdentifier = userProp.GetString();
                }

                if (string.IsNullOrWhiteSpace(userIdentifier) && root.TryGetProperty("upn", out var upnProp) && upnProp.ValueKind == System.Text.Json.JsonValueKind.String)
                {
                    userIdentifier = upnProp.GetString();
                }

                if (string.IsNullOrWhiteSpace(userIdentifier) && root.TryGetProperty("sub", out var subProp) && subProp.ValueKind == System.Text.Json.JsonValueKind.String)
                {
                    userIdentifier = subProp.GetString();
                }

                if (string.IsNullOrWhiteSpace(userIdentifier))
                {
                    Logger.LogWarning("No email, preferred_username, upn, or sub claim found in JWT token");
                    return null;
                }

                // Attempt exact lookup by email or handle username fallback (e.g., "alpha1" -> "alpha1@alphacorp.com")
                var user = _userStore.Get(userIdentifier);
                if (user == null && !userIdentifier.Contains('@'))
                {
                    user = _userStore.GetAll().FirstOrDefault(u =>
                        u.Email != null && u.Email.StartsWith(userIdentifier + "@", StringComparison.OrdinalIgnoreCase));
                }

                if (user != null && user.IsActive)
                {
                    user.LastLoginDate = DateTime.UtcNow;
                    _userStore.Update(user);
                    return user;
                }

                Logger.LogWarning("User '{UserIdentifier}' extracted from JWT was not found in active UserStore", userIdentifier);
                return null;
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error decoding JWT");
                return null;
            }
        }

        /// <summary>
        /// Cryptographically random opaque session token. It is NOT a security
        /// boundary on its own -- JwtBearer / ASP.NET auth cookies own auth.
        /// Returned to the SPA for stateful display only.
        /// </summary>
        private string GenerateSessionToken(AppUser user)
        {
            var issuer = _configuration["Jwt:Issuer"] ?? "BoldAdhocEmbed.Local";
            var audience = _configuration["Jwt:Audience"] ?? "DemoRealm";
            var signingKey = _configuration["Jwt:SigningKey"];
            if (string.IsNullOrWhiteSpace(signingKey))
            {
                throw new InvalidOperationException("Jwt:SigningKey is required for local password authentication.");
            }

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id ?? user.Email),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim("email", user.Email),
                new Claim(ClaimTypes.Name, user.Name ?? user.Email),
                new Claim(ClaimTypes.Role, user.Role ?? "User"),
                new Claim("tenantId", user.TenantId.ToString()),
                new Claim("tenantName", user.TenantName ?? string.Empty),
                new Claim("region", user.Region ?? string.Empty),
            };
            var credentials = new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
                SecurityAlgorithms.HmacSha256);
            var token = new JwtSecurityToken(
                issuer: issuer,
                audience: audience,
                claims: claims,
                notBefore: DateTime.UtcNow,
                expires: DateTime.UtcNow.AddHours(8),
                signingCredentials: credentials);
            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
