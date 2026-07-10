using Microsoft.AspNetCore.Mvc;
using BoldAdhocEmbed.Server.Services;
using BoldAdhocEmbed.Server.Models;

namespace BoldAdhocEmbed.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class UsersController : BaseController
    {
        private readonly IBoldReportsService _boldReportsService;
        private readonly ILogger<UsersController> _logger;
        private readonly ICacheService _cacheService;
        private readonly IUserStore _userStore;

        public UsersController(
            IBoldReportsService boldReportsService,
            ILogger<UsersController> logger,
            ICacheService cacheService,
            IUserStore userStore)
            : base(logger)
        {
            _boldReportsService = boldReportsService ?? throw new ArgumentNullException(nameof(boldReportsService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _cacheService = cacheService ?? throw new ArgumentNullException(nameof(cacheService));
            _userStore = userStore ?? throw new ArgumentNullException(nameof(userStore));
        }

        [HttpGet]
        public async Task<ActionResult<ApiResponse<dynamic>>> GetUsers()
        {
            try
            {
                // Get token from the authenticated user's request
                var token = await GetBoldReportsTokenAsync(_boldReportsService);
                if (string.IsNullOrEmpty(token))
                {
                    _logger.LogWarning("No token provided in Authorization header for GetUsers");
                    return Unauthorized(ApiResponse<dynamic>.UnauthorizedResponse());
                }

                // Check cache first
                var requestToken = GetTokenFromRequest();
                var userEmail = GetEmailFromToken(requestToken) ?? "manoranjan.rajendran@syncfusion.com";
                var cacheKey = $"users-list-{userEmail}";
                var cachedUsers = await _cacheService.GetAsync<dynamic>(cacheKey);
                if (cachedUsers != null)
                {
                    _logger.LogInformation("Users list retrieved from cache");
                    return Ok(ApiResponse<dynamic>.SuccessResponse(cachedUsers, "Retrieved users"));
                }

                // Prefer v5.0 users endpoint, fallback to legacy if needed
                // The user's permissions and RLS will be applied by Bold Reports
                var users = await _boldReportsService.GetUsersV5Async(token);
                if (users == null || users.Count == 0)
                {
                    users = await _boldReportsService.GetUsersAsync(token);
                }

                var userList = users.Select(u => new
                {
                    u.Id,
                    u.Email,
                    u.FirstName,
                    u.LastName,
                    u.FullName,
                    u.IsActive,
                    Status = u.IsActive ? "Active" : "Inactive"
                }).ToList();

                _logger.LogInformation("Retrieved {UserCount} users for authenticated user", userList.Count);

                // Cache for 5 minutes
                await _cacheService.SetAsync(cacheKey, (dynamic)userList, TimeSpan.FromMinutes(5));

                return Ok(ApiResponse<dynamic>.SuccessResponse(userList, $"Retrieved {userList.Count} users"));
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

                // Get token from the authenticated user's request
                var token = await GetBoldReportsTokenAsync(_boldReportsService);
                if (string.IsNullOrEmpty(token))
                {
                    _logger.LogWarning("No token provided for getting user {Email}", email);
                    return Unauthorized(ApiResponse<dynamic>.UnauthorizedResponse());
                }

                var user = await _boldReportsService.GetUserAsync(token, email);
                if (user == null)
                {
                    _logger.LogWarning("User not found or access denied: {Email}", email);
                    return NotFound(ApiResponse<dynamic>.ErrorResponse("Not Found", $"User '{email}' not found or you don't have permission"));
                }

                var userData = new
                {
                    user.Id,
                    user.Email,
                    user.FirstName,
                    user.LastName,
                    user.FullName,
                    user.IsActive,
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
                // Validate request
                if (string.IsNullOrWhiteSpace(request?.Email))
                {
                    return BadRequest(ApiResponse<dynamic>.ErrorResponse("Invalid Request", "Email is required"));
                }

                // Get token from the authenticated user's request
                // User must have permissions to create users
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
                    Password = request.Password ?? GeneratePassword()
                };

                var success = await _boldReportsService.CreateUserAsync(token, boldUserRequest);
                if (!success)
                {
                    _logger.LogWarning("Failed to create user in Bold Reports: {Email}", request.Email);
                    return BadRequest(ApiResponse<dynamic>.ErrorResponse("Creation Failed", "Failed to create user - you may not have permission or user already exists"));
                }

                var createdUser = await _boldReportsService.GetUserAsync(token, request.Email);
                _logger.LogInformation("Successfully created user: {Email}", request.Email);
                
                // Invalidate users cache
                var requestToken = GetTokenFromRequest();
                var userEmail = GetEmailFromToken(requestToken) ?? "manoranjan.rajendran@syncfusion.com";
                var cacheKey = $"users-list-{userEmail}";
                await _cacheService.RemoveAsync(cacheKey);

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

                // Get token from the authenticated user's request
                // User must have permissions to update users
                var token = await GetBoldReportsTokenAsync(_boldReportsService);
                if (string.IsNullOrEmpty(token))
                {
                    _logger.LogWarning("No token provided for updating user {Email}", email);
                    return Unauthorized(ApiResponse<dynamic>.UnauthorizedResponse());
                }

                var boldUserRequest = new UpdateBoldUserRequest
                {
                    FirstName = request.FirstName,
                    LastName = request.LastName
                };

                var success = await _boldReportsService.UpdateUserAsync(token, email, boldUserRequest);
                if (!success)
                {
                    _logger.LogWarning("Failed to update user in Bold Reports: {Email}", email);
                    return BadRequest(ApiResponse<dynamic>.ErrorResponse("Update Failed", "Failed to update user - you may not have permission"));
                }

                var updatedUser = await _boldReportsService.GetUserAsync(token, email);

                // Update local user store if user exists
                var localUser = _userStore.Get(email);
                if (localUser != null)
                {
                    localUser.FirstName = request.FirstName;
                    localUser.LastName = request.LastName;
                    localUser.Name = $"{request.FirstName} {request.LastName}".Trim();
                    _userStore.Update(localUser);
                    _logger.LogInformation("Updated local user store for {Email}", email);
                }

                _logger.LogInformation("Successfully updated user: {Email}", email);
                
                // Invalidate users cache
                var requestToken = GetTokenFromRequest();
                var userEmail = GetEmailFromToken(requestToken) ?? "manoranjan.rajendran@syncfusion.com";
                var cacheKey = $"users-list-{userEmail}";
                await _cacheService.RemoveAsync(cacheKey);

                return Ok(ApiResponse<dynamic>.SuccessResponse(updatedUser, "User updated successfully"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating user {Email}", email);
                return StatusCode(500, ApiResponse<dynamic>.ErrorResponse(ex.Message, "Failed to update user"));
            }
        }

        [HttpDelete("{email}")]
        public async Task<ActionResult<ApiResponse>> DeleteUser(string email)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(email))
                {
                    return BadRequest(ApiResponse.ErrorResponse("Invalid Request", "Email is required"));
                }

                // Get token from the authenticated user's request
                // User must have permissions to delete users
                var token = await GetBoldReportsTokenAsync(_boldReportsService);
                if (string.IsNullOrEmpty(token))
                {
                    _logger.LogWarning("No token provided for deleting user {Email}", email);
                    return Unauthorized(ApiResponse.UnauthorizedResponse());
                }

                var success = await _boldReportsService.DeleteUserAsync(token, email);
                if (!success)
                {
                    _logger.LogWarning("Failed to delete user from Bold Reports: {Email}", email);
                    return BadRequest(ApiResponse.ErrorResponse("Deletion Failed", "Failed to delete user - you may not have permission"));
                }

                _logger.LogInformation("Successfully deleted user: {Email}", email);
                
                // Invalidate users cache
                var requestToken = GetTokenFromRequest();
                var userEmail = GetEmailFromToken(requestToken) ?? "manoranjan.rajendran@syncfusion.com";
                var cacheKey = $"users-list-{userEmail}";
                await _cacheService.RemoveAsync(cacheKey);

                return Ok(ApiResponse.SuccessResponse($"User '{email}' deleted successfully"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting user {Email}", email);
                return StatusCode(500, ApiResponse.ErrorResponse(ex.Message, "Failed to delete user"));
            }
        }

        private string GeneratePassword() => Guid.NewGuid().ToString("N").Substring(0, 12);
    }

    public class CreateUserRequest
    {
        public string Email { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string Password { get; set; }
    }

    public class UpdateUserRequest
    {
        public string FirstName { get; set; }
        public string LastName { get; set; }
    }
}
