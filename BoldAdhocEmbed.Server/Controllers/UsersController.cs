using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using BoldAdhocEmbed.Server.Services;
using BoldAdhocEmbed.Server.Models;

namespace BoldAdhocEmbed.Server.Controllers
{
    /// <summary>
    /// Identity comes from validated JWT claims only. No header parsing.
    /// </summary>
    [ApiController]
    [Authorize]
    [Route("api/[controller]/[action]")]
    public class UsersController : BaseController
    {
        private readonly IBoldReportsService _boldReportsService;
        private readonly ILogger<UsersController> _logger;
        private readonly ICacheService _cacheService;
        private readonly IUserStore _userStore;
        private readonly IAuthenticatedUser _auth;

        public UsersController(
            IBoldReportsService boldReportsService,
            ILogger<UsersController> logger,
            ICacheService cacheService,
            IUserStore userStore,
            IAuthenticatedUser auth)
            : base(logger)
        {
            _boldReportsService = boldReportsService ?? throw new ArgumentNullException(nameof(boldReportsService));
            _logger = logger;
            _cacheService = cacheService ?? throw new ArgumentNullException(nameof(cacheService));
            _userStore = userStore ?? throw new ArgumentNullException(nameof(userStore));
            _auth = auth ?? throw new ArgumentNullException(nameof(auth));
        }

        // Cryptographically random fallback password for users created via the
        // admin UI without an explicit password. Not used in the auth chain
        // because the new user receives a password from the operator.
        private static string GenerateRandomPassword()
        {
            var bytes = new byte[12];
            System.Security.Cryptography.RandomNumberGenerator.Fill(bytes);
            return Convert.ToBase64String(bytes);
        }

        private string CurrentEmail => _auth.GetAuthContext()?.Email
            ?? throw new UnauthorizedAccessException("Authenticated context missing");

        [HttpGet]
        public async Task<ActionResult<ApiResponse<dynamic>>> GetUsers()
        {
            try
            {
                var token = await GetBoldReportsTokenAsync(_boldReportsService);
                if (string.IsNullOrEmpty(token))
                {
                    _logger.LogWarning("No token provided in Authorization header for GetUsers");
                    return Unauthorized(ApiResponse<dynamic>.UnauthorizedResponse());
                }

                var userEmail = CurrentEmail;
                var cacheKey = $"users-list-{userEmail}";
                var cachedUsers = await _cacheService.GetAsync<dynamic>(cacheKey);
                if (cachedUsers != null)
                {
                    _logger.LogInformation("Users list retrieved from cache");
                    return Ok(ApiResponse<dynamic>.SuccessResponse(cachedUsers, "Retrieved users"));
                }

                var authCtx = _auth.GetAuthContext();
                var currentTenantName = authCtx?.TenantName;
                var currentTenantId = authCtx?.TenantId ?? 0;

                // Prefer v5.0 users endpoint, fallback to legacy if needed.
                var users = await _boldReportsService.GetUsersV5Async(token);
                if (users == null || users.Count == 0)
                {
                    users = await _boldReportsService.GetUsersAsync(token);
                }

                // Scope Bold Reports users to current tenant
                var userList = (users ?? new List<BoldUser>())
                    .Where(u => {
                        var local = _userStore.Get(u.Email);
                        if (local != null)
                        {
                            return (!string.IsNullOrEmpty(currentTenantName) && string.Equals(local.TenantName, currentTenantName, StringComparison.OrdinalIgnoreCase))
                                || (currentTenantId > 0 && local.TenantId == currentTenantId);
                        }
                        if (!string.IsNullOrEmpty(currentTenantName))
                        {
                            var prefix = currentTenantName.ToLower().Replace("corp", "").Replace("solutions", "").Replace("industries", "").Replace("enterprises", "");
                            return u.Email != null && u.Email.Contains(prefix, StringComparison.OrdinalIgnoreCase);
                        }
                        return true;
                    })
                    .Select(u => {
                        var local = _userStore.Get(u.Email);
                        return new
                        {
                            u.Id,
                            u.Email,
                            u.FirstName,
                            u.LastName,
                            u.FullName,
                            Role = local?.Role ?? "Admin",
                            TenantName = local?.TenantName ?? currentTenantName,
                            u.IsActive,
                            Status = u.IsActive ? "Active" : "Inactive"
                        };
                    }).ToList();

                // Merge seeded tenant users so full tenant team is visible
                var tenantUsers = _userStore.GetAll()
                    .Where(u => (!string.IsNullOrEmpty(currentTenantName) && string.Equals(u.TenantName, currentTenantName, StringComparison.OrdinalIgnoreCase))
                             || (currentTenantId > 0 && u.TenantId == currentTenantId))
                    .ToList();

                var existingEmails = new HashSet<string>(userList.Select(u => u.Email), StringComparer.OrdinalIgnoreCase);
                foreach (var tu in tenantUsers)
                {
                    if (!existingEmails.Contains(tu.Email))
                    {
                        userList.Add(new
                        {
                            Id = tu.Id,
                            Email = tu.Email,
                            FirstName = tu.FirstName ?? tu.Name?.Split(' ').FirstOrDefault() ?? "",
                            LastName = tu.LastName ?? tu.Name?.Split(' ').Skip(1).FirstOrDefault() ?? "",
                            FullName = tu.Name ?? $"{tu.FirstName} {tu.LastName}".Trim(),
                            Role = tu.Role ?? "User",
                            TenantName = tu.TenantName,
                            IsActive = tu.IsActive,
                            Status = tu.IsActive ? "Active" : "Inactive"
                        });
                    }
                }

                await _cacheService.SetAsync(cacheKey, (dynamic)userList, TimeSpan.FromMinutes(5));
                _logger.LogInformation("Retrieved {UserCount} users for authenticated user", userList.Count);
                return Ok(ApiResponse<dynamic>.SuccessResponse(userList, $"Retrieved {userList.Count} users"));
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(ApiResponse<dynamic>.UnauthorizedResponse());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving users");
                return StatusCode(500, ApiResponse<dynamic>.ErrorResponse(ex.Message, "Failed to retrieve users"));
            }
        }

        [HttpGet("{email}")]
        public async Task<ActionResult<ApiResponse<dynamic>>> GetUser(string email)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(email))
                {
                    return BadRequest(ApiResponse<dynamic>.ErrorResponse("Invalid Request", "Email is required"));
                }

                var token = await GetBoldReportsTokenAsync(_boldReportsService);
                if (string.IsNullOrEmpty(token))
                {
                    _logger.LogWarning("No token provided for getting user {Email}", email);
                    return Unauthorized(ApiResponse<dynamic>.UnauthorizedResponse());
                }

                var user = await _boldReportsService.GetUserAsync(token, email);
                if (user == null)
                {
                    return NotFound(ApiResponse<dynamic>.ErrorResponse("Not Found",
                        $"User '{email}' not found or you do not have permission"));
                }

                var userData = new
                {
                    user.Id, user.Email, user.FirstName, user.LastName,
                    user.FullName, user.IsActive,
                    Status = user.IsActive ? "Active" : "Inactive"
                };

                _logger.LogInformation("User {Email} retrieved successfully", email);
                return Ok(ApiResponse<dynamic>.SuccessResponse(userData, "User retrieved successfully"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving user {Email}", email);
                return StatusCode(500, ApiResponse<dynamic>.ErrorResponse(ex.Message, "Failed to retrieve user"));
            }
        }

        [HttpPost]
        public async Task<ActionResult<ApiResponse<dynamic>>> CreateUser([FromBody] CreateUserRequest request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request?.Email))
                {
                    return BadRequest(ApiResponse<dynamic>.ErrorResponse("Invalid Request", "Email is required"));
                }

                var token = await GetBoldReportsTokenAsync(_boldReportsService);
                if (string.IsNullOrEmpty(token))
                {
                    _logger.LogWarning("No token provided for creating user {Email}", request.Email);
                    return Unauthorized(ApiResponse<dynamic>.UnauthorizedResponse());
                }

                var boldUserRequest = new CreateBoldUserRequest
                {
                    Email = request.Email,
                    FirstName = request.FirstName,
                    LastName = request.LastName,
                    Password = request.Password ?? GenerateRandomPassword()
                };

                var success = await _boldReportsService.CreateUserAsync(token, boldUserRequest);
                if (!success)
                {
                    return BadRequest(ApiResponse<dynamic>.ErrorResponse("Creation Failed",
                        "Failed to create user - you may not have permission or user already exists"));
                }

                var createdUser = await _boldReportsService.GetUserAsync(token, request.Email);
                _logger.LogInformation("Successfully created user: {Email}", request.Email);

                await _cacheService.RemoveAsync($"users-list-{CurrentEmail}");

                return CreatedAtAction(nameof(GetUser), new { email = request.Email },
                    ApiResponse<dynamic>.SuccessResponse(createdUser, "User created successfully"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating user {Email}", request?.Email);
                return StatusCode(500, ApiResponse<dynamic>.ErrorResponse(ex.Message, "Failed to create user"));
            }
        }

        [HttpPut("{email}")]
        public async Task<ActionResult<ApiResponse<dynamic>>> UpdateUser(string email, [FromBody] UpdateUserRequest request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(email))
                {
                    return BadRequest(ApiResponse<dynamic>.ErrorResponse("Invalid Request", "Email is required"));
                }

                var token = await GetBoldReportsTokenAsync(_boldReportsService);
                if (string.IsNullOrEmpty(token))
                {
                    return Unauthorized(ApiResponse<dynamic>.UnauthorizedResponse());
                }

                var success = await _boldReportsService.UpdateUserAsync(token, email,
                    new UpdateBoldUserRequest { FirstName = request.FirstName, LastName = request.LastName });
                if (!success)
                {
                    return BadRequest(ApiResponse<dynamic>.ErrorResponse("Update Failed",
                        "Failed to update user - you may not have permission"));
                }

                var updatedUser = await _boldReportsService.GetUserAsync(token, email);
                var localUser = _userStore.Get(email);
                if (localUser != null)
                {
                    localUser.FirstName = request.FirstName;
                    localUser.LastName = request.LastName;
                    localUser.Name = $"{request.FirstName} {request.LastName}".Trim();
                    _userStore.Update(localUser);
                }

                _logger.LogInformation("User {Email} updated successfully", email);
                return Ok(ApiResponse<dynamic>.SuccessResponse(updatedUser, "User updated successfully"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating user {Email}", email);
                return StatusCode(500, ApiResponse<dynamic>.ErrorResponse(ex.Message, "Failed to update user"));
            }
        }

        [HttpDelete("{email}")]
        public async Task<ActionResult<ApiResponse<dynamic>>> DeleteUser(string email)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(email))
                {
                    return BadRequest(ApiResponse<dynamic>.ErrorResponse("Invalid Request", "Email is required"));
                }

                var token = await GetBoldReportsTokenAsync(_boldReportsService);
                if (string.IsNullOrEmpty(token))
                {
                    return Unauthorized(ApiResponse<dynamic>.UnauthorizedResponse());
                }

                var success = await _boldReportsService.DeleteUserAsync(token, email);
                if (!success)
                {
                    return BadRequest(ApiResponse<dynamic>.ErrorResponse("Delete Failed",
                        "Failed to delete user - you may not have permission"));
                }

                _userStore.Delete(email);
                await _cacheService.RemoveAsync($"users-list-{CurrentEmail}");
                _logger.LogInformation("User {Email} deleted successfully", email);
                return Ok(ApiResponse<dynamic>.SuccessResponse(new { email }, "User deleted successfully"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting user {Email}", email);
                return StatusCode(500, ApiResponse<dynamic>.ErrorResponse(ex.Message, "Failed to delete user"));
            }
        }
    }
}
