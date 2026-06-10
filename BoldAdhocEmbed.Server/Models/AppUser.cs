namespace BoldAdhocEmbed.Server.Models
{
    /// <summary>
    /// Application user model for RBAC (Role-Based Access Control)
    /// Represents users in the system with their roles and permissions
    /// </summary>
    public class AppUser
    {
        /// <summary>
        /// Unique user identifier
        /// </summary>
        public string Id { get; set; }

        /// <summary>
        /// User email address (unique identifier)
        /// </summary>
        public string Email { get; set; }

        /// <summary>
        /// User full name
        /// </summary>
        public string Name { get; set; }

        /// <summary>
        /// User first name
        /// </summary>
        public string FirstName { get; set; }

        /// <summary>
        /// User last name
        /// </summary>
        public string LastName { get; set; }

        /// <summary>
        /// Hashed password (for local authentication)
        /// </summary>
        public string PasswordHash { get; set; }

        /// <summary>
        /// User role (Sales, Manager, Admin, etc.)
        /// </summary>
        public string Role { get; set; }

        /// <summary>
        /// Tenant/Organization ID
        /// </summary>
        public int TenantId { get; set; }

        /// <summary>
        /// Tenant/Organization name
        /// </summary>
        public string TenantName { get; set; }

        /// <summary>
        /// Geographic region
        /// </summary>
        public string Region { get; set; }

        /// <summary>
        /// Avatar URL for the user
        /// </summary>
        public string AvatarUrl { get; set; }

        /// <summary>
        /// Whether the user account is active
        /// </summary>
        public bool IsActive { get; set; }

        /// <summary>
        /// User permissions
        /// </summary>
        public PermissionSet Permissions { get; set; } = new();

        /// <summary>
        /// Account creation date
        /// </summary>
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// Last login date
        /// </summary>
        public DateTime? LastLoginDate { get; set; }
    }
}
