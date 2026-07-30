using BoldAdhocEmbed.Server.Models;

namespace BoldAdhocEmbed.Server.Services
{
    /// <summary>
    /// Interface for user store operations
    /// Abstracts the underlying user storage mechanism
    /// </summary>
    public interface IUserStore
    {
        /// <summary>
        /// Get user by email
        /// </summary>
        AppUser Get(string email);

        /// <summary>
        /// Get all users
        /// </summary>
        IEnumerable<AppUser> GetAll();

        /// <summary>
        /// Get users by tenant ID
        /// </summary>
        IEnumerable<AppUser> GetByTenant(int tenantId);

        /// <summary>
        /// Authenticate user with email and password
        /// </summary>
        AppUser Authenticate(string email, string password);

        /// <summary>
        /// Add user to store
        /// </summary>
        void Add(AppUser user);

        /// <summary>
        /// Update existing user
        /// </summary>
        void Update(AppUser user);

        /// <summary>
        /// Delete user from store
        /// </summary>
        void Delete(string email);

        /// <summary>
        /// Get permissions for a specific role
        /// </summary>
        PermissionSet GetPermissionsForRole(string role);
    }

    /// <summary>
    /// In-memory implementation of IUserStore for development/testing
    /// Stores users in memory and does not persist to database
    /// </summary>
    public class InMemoryUserStore : IUserStore
    {
        private readonly List<AppUser> _users = new();
        private readonly Dictionary<string, PermissionSet> _rolePermissions = new();

        public InMemoryUserStore()
        {
            InitializeDefaultUsers();
            InitializeRolePermissions();
        }

        public AppUser Get(string email)
        {
            if (string.IsNullOrWhiteSpace(email)) return null;
            return _users.FirstOrDefault(u => u.Email != null && u.Email.Equals(email.Trim(), StringComparison.OrdinalIgnoreCase));
        }

        public IEnumerable<AppUser> GetAll()
        {
            return _users.Where(u => u != null).OrderBy(u => u.Name ?? u.Email ?? "");
        }

        public IEnumerable<AppUser> GetByTenant(int tenantId)
        {
            return _users.Where(u => u != null && u.TenantId == tenantId).OrderBy(u => u.Name ?? u.Email ?? "");
        }

        public AppUser Authenticate(string email, string password)
        {
            if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(password))
                return null;

            var user = Get(email);
            if (user == null || !user.IsActive)
                return null;

            // Simple password verification (in production, use proper hashing)
            if (VerifyPassword(password, user.PasswordHash))
            {
                user.LastLoginDate = DateTime.UtcNow;
                return user;
            }

            return null;
        }

        public void Add(AppUser user)
        {
            if (user == null)
                throw new ArgumentNullException(nameof(user));

            if (!string.IsNullOrEmpty(user.Email) && _users.Any(u => u.Email != null && u.Email.Equals(user.Email, StringComparison.OrdinalIgnoreCase)))
                return;

            _users.Add(user);
        }

        public void Update(AppUser user)
        {
            if (user == null)
                throw new ArgumentNullException(nameof(user));

            var existingUser = Get(user.Email);
            if (existingUser == null)
                return;

            // Update properties
            existingUser.Name = user.Name ?? existingUser.Name;
            existingUser.FirstName = user.FirstName ?? existingUser.FirstName;
            existingUser.LastName = user.LastName ?? existingUser.LastName;
            existingUser.Role = user.Role ?? existingUser.Role;
            existingUser.TenantId = user.TenantId;
            existingUser.TenantName = user.TenantName ?? existingUser.TenantName;
            existingUser.Region = user.Region ?? existingUser.Region;
            existingUser.AvatarUrl = user.AvatarUrl ?? existingUser.AvatarUrl;
            existingUser.IsActive = user.IsActive;
            existingUser.Permissions = user.Permissions ?? existingUser.Permissions;
            existingUser.LastLoginDate = user.LastLoginDate;
        }

        public void Delete(string email)
        {
            var user = Get(email);
            if (user != null)
                _users.Remove(user);
        }

        public PermissionSet GetPermissionsForRole(string role)
        {
            return _rolePermissions.TryGetValue(role?.ToLower() ?? "admin", out var permissions)
                ? permissions
                : new PermissionSet
                {
                    CanView = true,
                    CanEdit = true,
                    CanDelete = true,
                    CanCreate = true,
                    CanExport = true,
                    CanSchedule = true,
                    CanManageUsers = true,
                    CanViewAuditLogs = true
                };
        }

        private void InitializeDefaultUsers()
        {
            // Primary Admin user (Manoranjan)
            _users.Add(new AppUser
            {
                Id = "1",
                Email = "manoranjan.rajendran@syncfusion.com",
                Name = "Manoranjan Rajendran",
                FirstName = "Manoranjan",
                LastName = "Rajendran",
                PasswordHash = HashPassword("admin123"),
                Role = "Admin",
                TenantId = 1,
                TenantName = "Default",
                Region = "US",
                IsActive = true,
                Permissions = new PermissionSet
                {
                    CanView = true,
                    CanEdit = true,
                    CanDelete = true,
                    CanCreate = true,
                    CanExport = true,
                    CanSchedule = true,
                    CanManageUsers = true,
                    CanViewAuditLogs = true
                }
            });

            // Admin user
            _users.Add(new AppUser
            {
                Id = "2",
                Email = "admin@example.com",
                Name = "Admin User",
                FirstName = "Admin",
                LastName = "User",
                PasswordHash = HashPassword("admin123"),
                Role = "Admin",
                TenantId = 1,
                TenantName = "Default",
                Region = "US",
                IsActive = true,
                Permissions = new PermissionSet
                {
                    CanView = true,
                    CanEdit = true,
                    CanDelete = true,
                    CanCreate = true,
                    CanExport = true,
                    CanSchedule = true,
                    CanManageUsers = true,
                    CanViewAuditLogs = true
                }
            });

            // Sales user
            _users.Add(new AppUser
            {
                Id = "3",
                Email = "sales@example.com",
                Name = "Sales User",
                FirstName = "Sales",
                LastName = "User",
                PasswordHash = HashPassword("sales123"),
                Role = "Sales",
                TenantId = 1,
                TenantName = "Default",
                Region = "US",
                IsActive = true,
                Permissions = new PermissionSet
                {
                    CanView = true,
                    CanEdit = false,
                    CanDelete = false,
                    CanCreate = false,
                    CanExport = true,
                    CanSchedule = false,
                    CanManageUsers = false,
                    CanViewAuditLogs = false
                }
            });

            // Manager user
            _users.Add(new AppUser
            {
                Id = "4",
                Email = "manager@example.com",
                Name = "Manager User",
                FirstName = "Manager",
                LastName = "User",
                PasswordHash = HashPassword("manager123"),
                Role = "Manager",
                TenantId = 1,
                TenantName = "Default",
                Region = "US",
                IsActive = true,
                Permissions = new PermissionSet
                {
                    CanView = true,
                    CanEdit = true,
                    CanDelete = false,
                    CanCreate = true,
                    CanExport = true,
                    CanSchedule = true,
                    CanManageUsers = false,
                    CanViewAuditLogs = true
                }
            });
        }

        private void InitializeRolePermissions()
        {
            _rolePermissions.Add("admin", new PermissionSet
            {
                CanView = true,
                CanEdit = true,
                CanDelete = true,
                CanCreate = true,
                CanExport = true,
                CanSchedule = true,
                CanManageUsers = true,
                CanViewAuditLogs = true
            });
            _rolePermissions.Add("manager", new PermissionSet
            {
                CanView = true,
                CanEdit = true,
                CanDelete = false,
                CanCreate = true,
                CanExport = true,
                CanSchedule = true,
                CanManageUsers = false,
                CanViewAuditLogs = true
            });
            _rolePermissions.Add("sales", new PermissionSet
            {
                CanView = true,
                CanEdit = false,
                CanDelete = false,
                CanCreate = false,
                CanExport = true,
                CanSchedule = false,
                CanManageUsers = false,
                CanViewAuditLogs = false
            });
            _rolePermissions.Add("viewer", new PermissionSet
            {
                CanView = true,
                CanEdit = false,
                CanDelete = false,
                CanCreate = false,
                CanExport = false,
                CanSchedule = false,
                CanManageUsers = false,
                CanViewAuditLogs = false
            });
        }

        /// <summary>
        /// Simple password hashing for demo purposes
        /// In production, use proper methods like BCrypt or PBKDF2
        /// </summary>
        private string HashPassword(string password)
        {
            if (string.IsNullOrEmpty(password))
                return null;

            using var sha256 = System.Security.Cryptography.SHA256.Create();
            var hashedBytes = sha256.ComputeHash(System.Text.Encoding.UTF8.GetBytes(password));
            return Convert.ToBase64String(hashedBytes);
        }

        /// <summary>
        /// Verify password against hash
        /// </summary>
        private bool VerifyPassword(string password, string hash)
        {
            if (string.IsNullOrEmpty(password) || string.IsNullOrEmpty(hash))
                return false;

            var hashOfInput = HashPassword(password);
            return hashOfInput == hash;
        }
    }
}
