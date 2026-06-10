namespace BoldAdhocEmbed.Server.Models
{
    /// <summary>
    /// Permission set defining what actions a user can perform
    /// Used in RBAC system to control user access to resources
    /// </summary>
    public class PermissionSet
    {
        /// <summary>
        /// Can view reports and dashboards
        /// </summary>
        public bool CanView { get; set; } = true;

        /// <summary>
        /// Can edit reports and dashboards
        /// </summary>
        public bool CanEdit { get; set; } = false;

        /// <summary>
        /// Can delete reports and dashboards
        /// </summary>
        public bool CanDelete { get; set; } = false;

        /// <summary>
        /// Can create new reports and dashboards
        /// </summary>
        public bool CanCreate { get; set; } = false;

        /// <summary>
        /// Can export reports
        /// </summary>
        public bool CanExport { get; set; } = true;

        /// <summary>
        /// Can schedule reports
        /// </summary>
        public bool CanSchedule { get; set; } = false;

        /// <summary>
        /// Can manage users in the system
        /// </summary>
        public bool CanManageUsers { get; set; } = false;

        /// <summary>
        /// Can view audit logs
        /// </summary>
        public bool CanViewAuditLogs { get; set; } = false;
    }
}
