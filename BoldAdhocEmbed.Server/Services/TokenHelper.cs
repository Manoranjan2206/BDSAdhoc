using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Threading.Tasks;

namespace BoldAdhocEmbed.Server.Services
{
    /// <summary>
    /// Helper service to centralize token acquisition logic
    /// </summary>
    public interface ITokenHelper
    {
        Task<string> GetAdminTokenAsync();
    }

    public class TokenHelper : ITokenHelper
    {
        private readonly IConfiguration _configuration;
        private readonly IBoldReportsService _boldReportsService;
        private readonly ILogger<TokenHelper> _logger;

        public TokenHelper(IConfiguration configuration, IBoldReportsService boldReportsService, ILogger<TokenHelper> logger)
        {
            _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
            _boldReportsService = boldReportsService ?? throw new ArgumentNullException(nameof(boldReportsService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <summary>
        /// Get admin token with fallback strategy: embed secret ? password auth
        /// </summary>
        public async Task<string> GetAdminTokenAsync()
        {
            var adminUser = _configuration["BoldReports:AdminUser"];
            var adminPassword = _configuration["BoldReports:AdminPassword"];
            var embedSecret = _configuration["BoldReports:EmbedSecret"];

            // Try embed secret authentication first if available
            if (!string.IsNullOrEmpty(embedSecret))
            {
                var token = await _boldReportsService.GetTokenFromSecretAsync(adminUser);
                if (!string.IsNullOrEmpty(token))
                {
                    _logger.LogInformation("Successfully obtained token using embed secret");
                    return token;
                }
                _logger.LogWarning("Failed to obtain token using embed secret, falling back to password auth");
            }

            // Fall back to password authentication
            if (string.IsNullOrEmpty(adminUser) || string.IsNullOrEmpty(adminPassword))
            {
                _logger.LogError("Missing required Bold Reports credentials (AdminUser and AdminPassword)");
                return null;
            }

            var passwordToken = await _boldReportsService.GetTokenAsync(adminUser, adminPassword);
            if (string.IsNullOrEmpty(passwordToken))
            {
                _logger.LogError("Failed to obtain token using password authentication");
                return null;
            }

            _logger.LogInformation("Successfully obtained token using password authentication");
            return passwordToken;
        }
    }
}
