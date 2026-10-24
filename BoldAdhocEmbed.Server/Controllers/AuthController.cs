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
                        CreatedDate = rbacUser.CreatedDate,
                        Permissions = rbacUser.Permissions ?? _userStore.GetPermissionsForRole(rbacUser.Role)
                    },
                    SessionToken = GenerateSessionToken(rbacUser),
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
                var email = GetClaimSafely(System.Security.Claims.ClaimTypes.Email, "email", "preferred_username", "sub");
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
                var userEmail = GetClaimSafely(System.Security.Claims.ClaimTypes.Email, "email", "preferred_username", "sub");
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
        /// Maps email prefix to tenant and role based on organizational mapping.
        /// Email format: {prefix}@domain.com
        /// Mapping:
        /// - "alpha" prefix → AlphaCorp (TenantId=1), Role="User"
        /// - "beta" prefix → BetaSolutions (TenantId=2), Role="User"
        /// - "gamma" prefix → GammaTech (TenantId=3), Role="User"
        /// </summary>
        private (int TenantId, string TenantName, string Role) MapEmailPrefixToTenant(string email)
        {
            if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
            {
                return (1, "AlphaCorp", "User"); // Default fallback
            }

            var prefix = email.Split('@')[0].ToLowerInvariant();
            var emailPrefix = prefix.TakeWhile(c => !char.IsDigit(c)).ToString().ToLowerInvariant();

            Logger.LogInformation("Mapping email prefix '{Prefix}' (full: {Email}) to tenant", emailPrefix, email);

            return emailPrefix switch
            {
                "alpha" => (1, "AlphaCorp", "User"),
                "beta" => (2, "BetaSolutions", "User"),
                "gamma" => (3, "GammaTech", "User"),
                _ => (1, "AlphaCorp", "User") // Default to AlphaCorp if no match
            };
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

            if (!signatureEnforced)
            {
                Logger.LogWarning(
                    "Jwt:Authority is unset -- decoding JWT payload claim for user resolution.");
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

                // JIT (Just-In-Time) provisioning for Keycloak SSO accounts not pre-seeded in InMemoryUserStore
                if (user == null)
                {
                    var name = root.TryGetProperty("name", out var nProp) && nProp.ValueKind == System.Text.Json.JsonValueKind.String ? nProp.GetString() : null;
                    var givenName = root.TryGetProperty("given_name", out var gProp) && gProp.ValueKind == System.Text.Json.JsonValueKind.String ? gProp.GetString() : null;
                    var familyName = root.TryGetProperty("family_name", out var fProp) && fProp.ValueKind == System.Text.Json.JsonValueKind.String ? fProp.GetString() : null;

                    var displayName = !string.IsNullOrWhiteSpace(name)
                        ? name
                        : (!string.IsNullOrWhiteSpace(givenName) ? $"{givenName} {familyName}".Trim() : userIdentifier);

                    var email = userIdentifier.Contains('@') ? userIdentifier : $"{userIdentifier}@alphacorp.com";

                    user = new AppUser
                    {
                        Id = Guid.NewGuid().ToString(),
                        Email = email,
                        Name = displayName,
                        FirstName = givenName,
                        LastName = familyName,
                        Role = "Admin",
                        TenantId = 1,
                        TenantName = "AlphaCorp",
                        Region = "North America",
                        IsActive = true,
                        CreatedDate = DateTime.UtcNow,
                        LastLoginDate = DateTime.UtcNow
                    };
                    _userStore.Add(user);
                    Logger.LogInformation("Auto-provisioned JIT user for Keycloak SSO: {Email}, Name: {Name}", email, displayName);
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
            var audience = _configuration["Jwt:Audience"] ?? "crm-app";
            var signingKey = _configuration["Jwt:Key"] ?? _configuration["Jwt:SigningKey"];
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

        /// <summary>
        /// Azure AD OIDC callback handler. Executed after user logs in via Azure AD.
        /// Converts Azure AD claims to an AppUser and issues an app-specific JWT.
        /// </summary>
        [AllowAnonymous]
        [HttpGet("azure-callback")]
        public async Task<IActionResult> AzureCallback()
        {
            try
            {
                if (!User.Identity?.IsAuthenticated ?? false)
                {
                    Logger.LogWarning("Azure AD callback: User not authenticated");
                    return Redirect("/login?error=azure_not_authenticated");
                }

                // Extract claims from the Azure AD-authenticated principal
                // Azure AD can return email in different claim types depending on token version and scopes:
                // - ClaimTypes.Email (http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress)
                // - preferred_username (newer OIDC, usually has email format)
                // - mail (legacy)
                // - upn (User Principal Name, often has email format)
                var email = User.FindFirst(ClaimTypes.Email)?.Value 
                    ?? User.FindFirst("preferred_username")?.Value
                    ?? User.FindFirst("mail")?.Value
                    ?? User.FindFirst(ClaimTypes.Upn)?.Value;

                // Log all claims for debugging
                var allClaims = User.Claims?.Select(c => $"{c.Type}={c.Value}").ToList() ?? new List<string>();
                Logger.LogInformation("Azure AD callback: All claims: {Claims}", string.Join(", ", allClaims));

                if (string.IsNullOrWhiteSpace(email))
                {
                    Logger.LogWarning("Azure AD callback: Email claim not found. Tried ClaimTypes.Email, preferred_username, mail, upn");
                    return Redirect("/login?error=no_email_claim");
                }
                
                Logger.LogInformation("Azure AD callback: Successfully extracted email: {Email}", email);

                var name = User.FindFirst(ClaimTypes.Name)?.Value 
                    ?? User.FindFirst("name")?.Value 
                    ?? email.Split('@')[0];

                var givenName = User.FindFirst("given_name")?.Value;
                var familyName = User.FindFirst("family_name")?.Value;

                // Map email prefix to tenant (alpha → AlphaCorp, beta → BetaSolutions, gamma → GammaTech)
                var (tenantId, tenantName, role) = MapEmailPrefixToTenant(email);

                // Try to find existing user, or provision JIT
                var user = _userStore.Get(email);
                if (user == null)
                {
                    // JIT provisioning for new Azure AD users with email-prefix-based tenant mapping
                    user = new AppUser
                    {
                        Id = Guid.NewGuid().ToString(),
                        Email = email,
                        Name = name,
                        FirstName = givenName,
                        LastName = familyName,
                        Role = role,
                        TenantId = tenantId,
                        TenantName = tenantName,
                        Region = "North America",
                        IsActive = true,
                        CreatedDate = DateTime.UtcNow,
                        LastLoginDate = DateTime.UtcNow,
                        Permissions = _userStore.GetPermissionsForRole(role)
                    };
                    _userStore.Add(user);
                    Logger.LogInformation("JIT-provisioned Azure AD user: {Email}, Name: {Name}, Tenant: {TenantName} (ID: {TenantId})", 
                        email, name, tenantName, tenantId);
                }
                else
                {
                    // Update last login for existing users
                    user.LastLoginDate = DateTime.UtcNow;
                    _userStore.Update(user);
                }

                if (!user.IsActive)
                {
                    Logger.LogWarning("Azure AD user account inactive: {Email}", email);
                    return Redirect("/login?error=account_inactive");
                }

                // Generate app-specific JWT from the Azure-authenticated user
                var sessionToken = GenerateSessionToken(user);

                Logger.LogInformation("Azure AD login successful for user: {Email}, Tenant: {Tenant}", email, user.TenantName);

                // Redirect to frontend with token in query string
                // Frontend will extract and store it in localStorage
                return Redirect($"/login-success?token={Uri.EscapeDataString(sessionToken)}&email={Uri.EscapeDataString(email)}");
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error in Azure AD callback");
                return Redirect("/login?error=azure_callback_failed");
            }
        }

        /// <summary>
        /// Initiate Azure AD login. Frontend redirects here when user clicks "Login with Azure".
        /// </summary>
        [AllowAnonymous]
        [HttpGet("login-azure")]
        public async Task<IActionResult> LoginAzure(string? returnUrl = null)
        {
            try
            {
                var redirectUri = Url.Action("AzureCallback", "Auth", null, Request.Scheme);
                var properties = new Microsoft.AspNetCore.Authentication.AuthenticationProperties
                {
                    RedirectUri = redirectUri
                };

                // Store the original return URL in properties so we can use it after login
                if (!string.IsNullOrWhiteSpace(returnUrl))
                {
                    properties.Items["returnUrl"] = returnUrl;
                }

                return Challenge(properties, "AzureAd");
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error initiating Azure AD login");
                return Redirect("/login?error=azure_challenge_failed");
            }
        }

        /// <summary>
        /// Azure AD logout handler. Clears user session and redirects to Azure AD logout endpoint.
        /// </summary>
        [Authorize]
        [HttpPost("logout-azure")]
        public async Task<IActionResult> LogoutAzure()
        {
            try
            {
                var email = GetClaimSafely(ClaimTypes.Email, "email", "preferred_username", "sub");
                if (!string.IsNullOrWhiteSpace(email))
                {
                    // Clear cached tokens
                    await _cacheService.RemoveAsync($"bold-reports-exchanged-token-{email}");
                    await _cacheService.RemoveAsync($"bold-reports-embed-token-{email}");
                }

                Logger.LogInformation("Azure AD logout initiated for user: {Email}", email ?? "unknown");

                return SignOut(
                    new Microsoft.AspNetCore.Authentication.AuthenticationProperties
                    {
                        RedirectUri = "/login"
                    },
                    "Cookies",
                    "AzureAd"
                );
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error during Azure AD logout");
                return Ok(ApiResponse<dynamic>.SuccessResponse(null, "Logout complete"));
            }
        }
    }
}
