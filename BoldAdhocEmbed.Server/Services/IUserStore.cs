using BoldAdhocEmbed.Server.Models;

namespace BoldAdhocEmbed.Server.Services
{
    /// <summary>
    /// Interface for user store operations. Abstracts the underlying user
    /// storage mechanism so the production build can swap in an EF Core /
    /// PostgreSQL-backed implementation without touching callers.
    /// </summary>
    public interface IUserStore
    {
        AppUser Get(string email);
        IEnumerable<AppUser> GetAll();
        IEnumerable<AppUser> GetByTenant(int tenantId);
        AppUser Authenticate(string email, string password);
        void Add(AppUser user);
        void Update(AppUser user);
        void Delete(string email);
        PermissionSet GetPermissionsForRole(string role);
    }

    /// <summary>
    /// In-memory implementation of <see cref="IUserStore"/>. Intended for
    /// local development only; production deployments must replace this
    /// with a backed store (Postgres). Passwords are BCrypt-hashed with a
    /// per-user salt; no demo passwords are seeded.
    /// </summary>
    public class InMemoryUserStore : IUserStore
    {
        private readonly List<AppUser> _users = new();
        private readonly Dictionary<string, PermissionSet> _rolePermissions = new();

        public InMemoryUserStore()
        {
            InitializeRolePermissions();
            SeedDevelopmentUsers();
        }

        public AppUser Get(string email)
        {
            if (string.IsNullOrWhiteSpace(email)) return null;
            return _users.FirstOrDefault(u => u.Email != null
                && u.Email.Equals(email.Trim(), StringComparison.OrdinalIgnoreCase));
        }

        public IEnumerable<AppUser> GetAll()
        {
            return _users.Where(u => u != null).OrderBy(u => u.Name ?? u.Email ?? "");
        }

        public IEnumerable<AppUser> GetByTenant(int tenantId)
        {
            return _users.Where(u => u != null && u.TenantId == tenantId)
                         .OrderBy(u => u.Name ?? u.Email ?? "");
        }

        public AppUser Authenticate(string email, string password)
        {
            if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(password))
                return null;

            var user = Get(email);
            if (user == null || !user.IsActive)
                return null;

            // BCrypt verification with constant-time comparison. Missing or
            // malformed hashes are NOT silently accepted. The previous code
            // fell back to a re-hash check that conflated missing-hash with
            // bad-password, weakening the auth boundary.
            if (string.IsNullOrEmpty(user.PasswordHash) || !VerifyPassword(password, user.PasswordHash))
                return null;

            user.LastLoginDate = DateTime.UtcNow;
            return user;
        }

        public void Add(AppUser user)
        {
            if (user == null) throw new ArgumentNullException(nameof(user));
            if (!string.IsNullOrEmpty(user.Email) && _users.Any(u => u.Email != null
                && u.Email.Equals(user.Email, StringComparison.OrdinalIgnoreCase)))
                return;
            _users.Add(user);
        }

        public void Update(AppUser user)
        {
            if (user == null) throw new ArgumentNullException(nameof(user));
            var existingUser = Get(user.Email);
            if (existingUser == null) return;

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
            if (user != null) _users.Remove(user);
        }

        public PermissionSet GetPermissionsForRole(string role)
        {
            return _rolePermissions.TryGetValue(role?.ToLower() ?? "admin", out var permissions)
                ? permissions
                : new PermissionSet
                {
                    CanView = true, CanEdit = true, CanDelete = true, CanCreate = true,
                    CanExport = true, CanSchedule = true, CanManageUsers = true,
                    CanViewAuditLogs = true
                };
        }

        // Restrictive default for unknown roles; prevents a typo in the auth
        // layer from accidentally elevating privileges.
        private void InitializeRolePermissions()
        {
            _rolePermissions["admin"] = new PermissionSet
            {
                CanView = true, CanEdit = true, CanDelete = true, CanCreate = true,
                CanExport = true, CanSchedule = true, CanManageUsers = true,
                CanViewAuditLogs = true,
            };
            _rolePermissions["manager"] = new PermissionSet
            {
                CanView = true, CanEdit = true, CanDelete = false, CanCreate = true,
                CanExport = true, CanSchedule = true, CanManageUsers = false,
                CanViewAuditLogs = true,
            };
            _rolePermissions["sales"] = new PermissionSet
            {
                CanView = true, CanEdit = false, CanDelete = false, CanCreate = false,
                CanExport = true, CanSchedule = false, CanManageUsers = false,
                CanViewAuditLogs = false,
            };
            _rolePermissions["user"] = _rolePermissions["sales"];
            _rolePermissions["readonly"] = new PermissionSet
            {
                CanView = true, CanEdit = false, CanDelete = false, CanCreate = false,
                CanExport = false, CanSchedule = false, CanManageUsers = false,
                CanViewAuditLogs = false,
            };
            _rolePermissions["viewer"] = _rolePermissions["readonly"];
        }

        private void SeedDevelopmentUsers()
        {
            // These accounts mirror the local login selector in the SPA. They
            // are development fixtures only; production must use a persistent
            // identity store instead of this in-memory implementation.
            var users = new[]
            {
                ("alpha1@alphacorp.com", "Anna Smith", "Admin", 1, "AlphaCorp", "North America"),
                ("alpha2@alphacorp.com", "John Doe", "Sales", 1, "AlphaCorp", "Europe"),
                ("alpha3@alphacorp.com", "Linda Lee", "Finance", 1, "AlphaCorp", "Asia"),
                ("alpha4@alphacorp.com", "Mike Brown", "Support", 1, "AlphaCorp", "Oceania"),
                ("alpha5@alphacorp.com", "Chris Green", "Operations", 1, "AlphaCorp", "Oceania"),
                ("beta1@betasolutions.com", "Betty Jones", "Admin", 2, "BetaSolutions", "North America"),
                ("beta2@betasolutions.com", "Julia King", "Sales", 2, "BetaSolutions", "Europe"),
                ("beta3@betasolutions.com", "Brian Adams", "Finance", 2, "BetaSolutions", "Asia"),
                ("beta4@betasolutions.com", "Diana Miller", "Support", 2, "BetaSolutions", "Oceania"),
                ("beta5@betasolutions.com", "Eliza Scott", "Operations", 2, "BetaSolutions", "Oceania"),
                ("gamma1@gammaindustries.com", "George William", "Admin", 3, "GammaIndustries", "North America"),
                ("gamma2@gammaindustries.com", "Jack Black", "Sales", 3, "GammaIndustries", "Europe"),
                ("gamma3@gammaindustries.com", "Olivia Martin", "Finance", 3, "GammaIndustries", "Asia"),
                ("gamma4@gammaindustries.com", "Sophia White", "Support", 3, "GammaIndustries", "Oceania"),
                ("gamma5@gammaindustries.com", "Noah Clark", "Operations", 3, "GammaIndustries", "Oceania"),
                ("delta1@deltaenterprises.com", "Megan Young", "Admin", 4, "DeltaEnterprises", "North America"),
                ("delta2@deltaenterprises.com", "Zoe Turner", "Sales", 4, "DeltaEnterprises", "Europe"),
                ("delta3@deltaenterprises.com", "Ryan Evans", "Finance", 4, "DeltaEnterprises", "Asia"),
                ("delta4@deltaenterprises.com", "Liam Cooper", "Support", 4, "DeltaEnterprises", "Oceania"),
                ("delta5@deltaenterprises.com", "Emma Hall", "Operations", 4, "DeltaEnterprises", "Oceania"),
            };

            var passwordHash = HashPassword("Password123!");
            foreach (var (email, name, role, tenantId, tenantName, region) in users)
            {
                _users.Add(new AppUser
                {
                    Id = Guid.NewGuid().ToString(),
                    Email = email,
                    Name = name,
                    Role = role,
                    TenantId = tenantId,
                    TenantName = tenantName,
                    Region = region,
                    PasswordHash = passwordHash,
                    IsActive = true,
                    Permissions = GetPermissionsForRole(role),
                });
            }
        }

        // BCrypt with cost factor 12. Distinct salts prevent the kind of
        // precomputed hash attacks that affected the previous SHA-256
        // implementation.
        private static string HashPassword(string password)
        {
            if (string.IsNullOrEmpty(password)) return string.Empty;
            return BCrypt.Net.BCrypt.HashPassword(password, workFactor: 12);
        }

        private static bool VerifyPassword(string password, string hash)
        {
            if (string.IsNullOrEmpty(password) || string.IsNullOrEmpty(hash)) return false;
            try { return BCrypt.Net.BCrypt.Verify(password, hash); }
            catch (BCrypt.Net.SaltParseException) { return false; }
        }
    }
}
