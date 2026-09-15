namespace BoldAdhocEmbed.Server.Models;

// Shared DTOs referenced by AuthController and UsersController. The
// previous inline classes were lost during the controller rewrites; here
// they live as records so JSON serialization stays camelCase-friendly.
public record LoginRequest(string? Email, string? Password, string? JwtToken, string? CustomAttribute);

public record LoginResponse
{
    public bool Success { get; init; }
    public string Message { get; init; } = string.Empty;
    public AppUser? User { get; init; }
    public string? SessionToken { get; init; }
    public PermissionSet? Permissions { get; init; }
}

public record CreateUserRequest(
    string Email,
    string? FirstName,
    string? LastName,
    string? Password);

public record UpdateUserRequest(string? FirstName, string? LastName);
