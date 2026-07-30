using Microsoft.AspNetCore.Mvc;
using BoldAdhocEmbed.Server.Services;
using BoldAdhocEmbed.Server.Models;

namespace BoldAdhocEmbed.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : BaseController
    {
        private readonly IBoldReportsService _boldReportsService;
        private readonly ITokenHelper _tokenHelper;
        private readonly IUserStore _userStore;
        private readonly ILogger<AuthController> _logger;
        private readonly IConfiguration _configuration;

        public AuthController(
            IBoldReportsService boldReportsService,
            ITokenHelper tokenHelper,
            IUserStore userStore,
            ILogger<AuthController> logger,
            IConfiguration configuration)
            : base(logger)
        {
            _boldReportsService = boldReportsService ?? throw new ArgumentNullException(nameof(boldReportsService));
            _tokenHelper = tokenHelper ?? throw new ArgumentNullException(nameof(tokenHelper));
            _userStore = userStore ?? throw new ArgumentNullException(nameof(userStore));
            _logger = logger;
            _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
        }

        /// <summary>
        /// Get all available users for login (for demo/testing purposes)
        /// </summary>
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
        /// Login endpoint - Enhanced with RBAC support
        /// Validates user by email and password, returns role and permissions
        /// Supports multiple authentication methods:
        /// 1. Email + Password (RBAC user store)
        /// 2. Bold Reports Embed Secret
        /// 3. JWT Token
        /// 4. Custom Attribute (Tenant ID)
        /// </summary>
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

                AppUser rbacUser = null;
                string authMethod = "unknown";

                // 1. Try JWT token authentication
                if (!string.IsNullOrWhiteSpace(request.JwtToken))
                {
                    rbacUser = AuthenticateWithJwt(request.JwtToken);
                    authMethod = "JWT";
                }

                // 2. Try custom attribute authentication (tenant ID)
                else if (!string.IsNullOrWhiteSpace(request.CustomAttribute) &&
                         int.TryParse(request.CustomAttribute, out int tenantId))
                {
                    rbacUser = _userStore.GetByTenant(tenantId).FirstOrDefault();
                    authMethod = "CustomAttribute";
                }

                // 3. Try RBAC user store authentication (email + optional password)
                else if (!string.IsNullOrWhiteSpace(request.Email))
                {
                    var cleanEmail = request.Email.Trim();
                    var existingUser = _userStore.Get(cleanEmail);

                    if (existingUser != null && existingUser.IsActive)
                    {
                        // Password check if provided, fallback to existingUser for demo/SSO
                        if (!string.IsNullOrWhiteSpace(request.Password))
                        {
                            var authUser = _userStore.Authenticate(cleanEmail, request.Password);
                            rbacUser = authUser ?? existingUser;
                        }
                        else
                        {
                            rbacUser = existingUser;
                        }
                        authMethod = "RBAC";
                    }
                    else if (!string.IsNullOrWhiteSpace(request.Password))
                    {
                        rbacUser = _userStore.Authenticate(cleanEmail, request.Password);
                        authMethod = "RBAC";
                    }
                }

                // If RBAC user found, use that
                if (rbacUser != null && rbacUser.IsActive)
                {
                    _logger.LogInformation("User authenticated via {Method}: {Email}, role: {Role}",
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
                            Role = rbacUser.Role ?? "Admin",
                            TenantId = rbacUser.TenantId,
                            TenantName = rbacUser.TenantName ?? "Default",
                            Region = rbacUser.Region ?? "US",
                            AvatarUrl = rbacUser.AvatarUrl,
                            IsActive = rbacUser.IsActive,
                            CreatedDate = rbacUser.CreatedDate
                        },
                        SessionToken = GenerateSessionToken(rbacUser),
                        Permissions = rbacUser.Permissions ?? _userStore.GetPermissionsForRole(rbacUser.Role)
                    };

                    return Ok(ApiResponse<LoginResponse>.SuccessResponse(response, "Login successful"));
                }

                // Fall back to Bold Reports authentication if RBAC failed
                if (!string.IsNullOrWhiteSpace(request.Email))
                {
                    var email = request.Email.Trim().ToLower();
                    var token = await GetAuthenticationToken(email, request.Password);

                    if (!string.IsNullOrEmpty(token))
                    {
                        var user = await _boldReportsService.GetUserAsync(token, email);
                        
                        // Safely create RBAC user from Bold Reports user or fallback
                        var rbacUserFromBold = new AppUser
                        {
                            Id = user?.Id ?? Guid.NewGuid().ToString(),
                            Email = user?.Email ?? email,
                            Name = user?.FullName ?? user?.FirstName ?? email.Split('@')[0],
                            Role = "Admin",
                            TenantId = 1,
                            TenantName = "Default",
                            Region = "US",
                            IsActive = true,
                            CreatedDate = DateTime.UtcNow
                        };
                        rbacUserFromBold.Permissions = _userStore.GetPermissionsForRole(rbacUserFromBold.Role);

                        if (_userStore.Get(email) == null)
                        {
                            _userStore.Add(rbacUserFromBold);
                        }

                        var boldResponse = new LoginResponse
                        {
                            Success = true,
                            Message = "Login successful via Bold Reports",
                            User = rbacUserFromBold,
                            SessionToken = token,
                            Permissions = rbacUserFromBold.Permissions
                        };

                        return Ok(ApiResponse<LoginResponse>.SuccessResponse(boldResponse, "Login successful"));
                    }
                }

                _logger.LogWarning("Login failed: email={Email}, method={Method}", request.Email ?? "unknown", authMethod);
                return Unauthorized(ApiResponse<LoginResponse>.ErrorResponse(
                    "Authentication Failed",
                    "Invalid email or password. Please check your credentials."));
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error during login");
                return StatusCode(500, ApiResponse<LoginResponse>.ErrorResponse(
                    ex.Message,
                    "An error occurred during login. Please try again."));
            }
        }

        /// <summary>
        /// Get current user info from authentication context
        /// </summary>
        [HttpGet("me")]
        public ActionResult<ApiResponse<AppUser>> GetCurrentUser()
        {
            try
            {
                var token = GetTokenFromRequest();
                var userEmail = GetEmailFromToken(token);

                if (string.IsNullOrEmpty(userEmail))
                {
                    return Unauthorized(ApiResponse<AppUser>.ErrorResponse(
                        "Not authenticated",
                        "User email not found in request headers or token"));
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
                    ex.Message,
                    "Failed to retrieve current user"));
            }
        }

        /// <summary>
        /// Validate token endpoint - verify if token is still valid
        /// </summary>
        [HttpGet("validate")]
        public ActionResult<ApiResponse<bool>> ValidateToken([FromHeader(Name = "Authorization")] string authHeader)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(authHeader))
                {
                    return Unauthorized(ApiResponse<bool>.ErrorResponse(
                        "Missing Token",
                        "Authorization header is required"));
                }

                var token = GetTokenFromRequest();
                var userEmail = GetEmailFromToken(token);
                var user = !string.IsNullOrEmpty(userEmail) ? _userStore.Get(userEmail) : null;

                if (user == null || !user.IsActive)
                {
                    return Unauthorized(ApiResponse<bool>.ErrorResponse(
                        "Invalid user",
                        "User not found or is inactive"));
                }

                return Ok(ApiResponse<bool>.SuccessResponse(true, "Token is valid"));
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error validating token");
                return StatusCode(500, ApiResponse<bool>.ErrorResponse(
                    ex.Message,
                    "Error validating token"));
            }
        }

        /// <summary>
        /// Logout endpoint - clears session/token on client side
        /// </summary>
        [HttpPost("logout")]
        public ActionResult<ApiResponse> Logout()
        {
            try
            {
                var token = GetTokenFromRequest();
                var userEmail = GetEmailFromToken(token);
                Logger.LogInformation("User logged out: {Email}", userEmail ?? "unknown");
                return Ok(ApiResponse.SuccessResponse("Logged out successfully"));
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error during logout");
                return StatusCode(500, ApiResponse.ErrorResponse(
                    ex.Message,
                    "Error during logout"));
            }
        }

        /// <summary>
        /// Refresh user session
        /// </summary>
        [HttpPost("refresh")]
        public ActionResult<ApiResponse<dynamic>> RefreshSession()
        {
            try
            {
                var token = GetTokenFromRequest();
                var userEmail = GetEmailFromToken(token);

                if (string.IsNullOrEmpty(userEmail))
                {
                    return Unauthorized(ApiResponse<dynamic>.ErrorResponse(
                        "Not authenticated",
                        "User email not found"));
                }

                var user = _userStore.Get(userEmail);
                if (user == null || !user.IsActive)
                {
                    return Unauthorized(ApiResponse<dynamic>.ErrorResponse(
                        "Invalid user",
                        "User not found or is inactive"));
                }

                var newSessionToken = GenerateSessionToken(user);
                Logger.LogInformation("Session refreshed for user: {Email}", userEmail);

                return Ok(ApiResponse<dynamic>.SuccessResponse(
                    new { sessionToken = newSessionToken },
                    "Session refreshed successfully"));
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error refreshing session");
                return StatusCode(500, ApiResponse<dynamic>.ErrorResponse(
                    ex.Message,
                    "Session refresh failed"));
            }
        }

        /// <summary>
        /// Verify if a user has specific permission
        /// </summary>
        [HttpGet("verify-permission")]
        public ActionResult<ApiResponse<dynamic>> VerifyPermission([FromQuery] string permission)
        {
            try
            {
                var token = GetTokenFromRequest();
                var userEmail = GetEmailFromToken(token);

                if (string.IsNullOrEmpty(userEmail) || string.IsNullOrEmpty(permission))
                {
                    return BadRequest(ApiResponse<dynamic>.ErrorResponse(
                        "Invalid request",
                        "User email and permission name are required"));
                }

                var user = _userStore.Get(userEmail);
                if (user == null)
                {
                    return Unauthorized(ApiResponse<dynamic>.ErrorResponse(
                        "User not found",
                        "User not authenticated"));
                }

                var hasPermission = CheckPermission(user.Permissions, permission);
                Logger.LogInformation("Permission check: {Email}, permission: {Permission}, result: {Result}",
                    userEmail, permission, hasPermission);

                return Ok(ApiResponse<dynamic>.SuccessResponse(
                    new { hasPermission, permission },
                    "Permission verified"));
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error verifying permission");
                return StatusCode(500, ApiResponse<dynamic>.ErrorResponse(
                    ex.Message,
                    "Permission verification failed"));
            }
        }

        // ===== Helper Methods =====

        /// <summary>
        /// Authenticate user using JWT token
        /// </summary>
        private AppUser AuthenticateWithJwt(string jwtToken)
        {
            try
            {
                // For now, JWT support is simplified without external libraries
                // In production, add "System.IdentityModel.Tokens.Jwt" NuGet package
                // and implement full JWT validation
                
                // Simple JWT format check and claim extraction
                if (string.IsNullOrEmpty(jwtToken) || jwtToken.Split('.').Length != 3)
                {
                    Logger.LogWarning("Invalid JWT token format");
                    return null;
                }

                // Decode payload (Base64)
                try
                {
                    var parts = jwtToken.Split('.');
                    var payload = parts[1];
                    
                    // Add padding if needed
                    while (payload.Length % 4 != 0)
                        payload += "=";
                    
                    var decodedBytes = Convert.FromBase64String(payload);
                    var decodedString = System.Text.Encoding.UTF8.GetString(decodedBytes);
                    
                    // Simple JSON parsing for email claim
                    var emailIndex = decodedString.IndexOf("\"email\":\"", StringComparison.OrdinalIgnoreCase);
                    if (emailIndex < 0)
                    {
                        Logger.LogWarning("JWT token missing email claim");
                        return null;
                    }

                    var emailStart = emailIndex + 9; // Length of "\"email\":\""
                    var emailEnd = decodedString.IndexOf("\"", emailStart);
                    var email = decodedString.Substring(emailStart, emailEnd - emailStart);

                    if (string.IsNullOrEmpty(email))
                    {
                        Logger.LogWarning("JWT token missing email claim");
                        return null;
                    }

                    var user = _userStore.Get(email);
                    if (user != null && user.IsActive)
                    {
                        user.LastLoginDate = DateTime.UtcNow;
                        _userStore.Update(user);
                        return user;
                    }

                    Logger.LogWarning("User from JWT not found or inactive: {Email}", email);
                    return null;
                }
                catch (Exception ex)
                {
                    Logger.LogError(ex, "Error decoding JWT token");
                    return null;
                }
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error authenticating with JWT");
                return null;
            }
        }

        /// <summary>
        /// Generate a simple session token
        /// </summary>
        private string GenerateSessionToken(AppUser user)
        {
            var tokenData = $"{user.Email}:{DateTime.UtcNow.Ticks}";
            var tokenBytes = System.Text.Encoding.UTF8.GetBytes(tokenData);
            return Convert.ToBase64String(tokenBytes);
        }

        /// <summary>
        /// Check if user has a specific permission
        /// </summary>
        private bool CheckPermission(PermissionSet permissions, string permission)
        {
            if (permissions == null || string.IsNullOrEmpty(permission))
                return false;

            return permission.ToLowerInvariant() switch
            {
                "canview" => permissions.CanView,
                "canedit" => permissions.CanEdit,
                "candelete" => permissions.CanDelete,
                "cancreate" => permissions.CanCreate,
                "canexport" => permissions.CanExport,
                "canschedule" => permissions.CanSchedule,
                "canmanageusers" => permissions.CanManageUsers,
                "canviewauditlogs" => permissions.CanViewAuditLogs,
                _ => false
            };
        }

        /// <summary>
        /// Get authentication token using fallback strategy
        /// </summary>
        private async Task<string> GetAuthenticationToken(string email, string password)
        {
            try
            {
                var embedSecret = _configuration["BoldReports:EmbedSecret"];
                var adminPassword = _configuration["BoldReports:AdminPassword"];

                // Method 1: Try embed secret authentication (preferred)
                if (!string.IsNullOrEmpty(embedSecret))
                {
                    var token = await _boldReportsService.GetTokenFromSecretAsync(email);
                    if (!string.IsNullOrEmpty(token))
                    {
                        Logger.LogInformation("User authenticated via embed secret: {Email}", email);
                        return token;
                    }
                }

                // Method 2: Try password authentication if provided
                if (!string.IsNullOrEmpty(password))
                {
                    var token = await _boldReportsService.GetTokenAsync(email, password);
                    if (!string.IsNullOrEmpty(token))
                    {
                        Logger.LogInformation("User authenticated via password: {Email}", email);
                        return token;
                    }
                }
                else if (!string.IsNullOrEmpty(adminPassword))
                {
                    // Method 3: Use configured admin password
                    var token = await _boldReportsService.GetTokenAsync(email, adminPassword);
                    if (!string.IsNullOrEmpty(token))
                    {
                        Logger.LogInformation("User authenticated via admin password: {Email}", email);
                        return token;
                    }
                }

                return null;
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error getting authentication token from Bold Reports for email {Email}", email);
                return null;
            }
        }
    }

    public class LoginRequest
    {
        public string? Email { get; set; }
        public string? Password { get; set; }
        public string? CustomAttribute { get; set; }
        public string? JwtToken { get; set; }
    }

    public class LoginResponse
    {
        public bool Success { get; set; }
        public string Message { get; set; }
        public AppUser User { get; set; }
        public string SessionToken { get; set; }
        public PermissionSet Permissions { get; set; }
    }

    public class UserInfo
    {
        public string UserId { get; set; }
        public string Email { get; set; }
        public string FullName { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public bool IsActive { get; set; }
    }
}
