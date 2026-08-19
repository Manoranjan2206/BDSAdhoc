using Microsoft.AspNetCore.Mvc;
using BoldAdhocEmbed.Server.Services;
using BoldAdhocEmbed.Server.Models;

namespace BoldAdhocEmbed.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CrmController : BaseController
    {
        private readonly ICrmDataService _crmDataService;

        public CrmController(ICrmDataService crmDataService, ILogger<CrmController> logger) : base(logger)
        {
            _crmDataService = crmDataService;
        }

        private (string tenantName, string userEmail, string userRole, string userRegion) GetUserContext()
        {
            var token = GetTokenFromRequest();
            var email = Request.Headers["X-User-Email"].ToString();
            if (string.IsNullOrEmpty(email)) email = Request.Query["email"].ToString();
            if (string.IsNullOrEmpty(email)) email = GetEmailFromToken(token) ?? "alpha1@alphacorp.com";

            var tenantName = Request.Headers["X-Tenant-Name"].ToString();
            if (string.IsNullOrEmpty(tenantName)) tenantName = Request.Query["tenantName"].ToString();
            if (string.IsNullOrEmpty(tenantName))
            {
                if (email.Contains("alpha", StringComparison.OrdinalIgnoreCase)) tenantName = "AlphaCorp";
                else if (email.Contains("beta", StringComparison.OrdinalIgnoreCase)) tenantName = "BetaSolutions";
                else if (email.Contains("gamma", StringComparison.OrdinalIgnoreCase)) tenantName = "GammaIndustries";
                else if (email.Contains("delta", StringComparison.OrdinalIgnoreCase)) tenantName = "DeltaEnterprises";
                else tenantName = "AlphaCorp";
            }

            var role = Request.Headers["X-User-Role"].ToString();
            if (string.IsNullOrEmpty(role)) role = Request.Query["role"].ToString();
            if (string.IsNullOrEmpty(role)) role = "Admin";

            var region = Request.Headers["X-User-Region"].ToString();
            if (string.IsNullOrEmpty(region)) region = Request.Query["region"].ToString();
            if (string.IsNullOrEmpty(region)) region = "North America";

            return (tenantName, email, role, region);
        }

        [HttpGet("home-summary")]
        public async Task<ActionResult<ApiResponse<HomeSummaryDto>>> GetHomeSummary()
        {
            var ctx = GetUserContext();
            var summary = await _crmDataService.GetHomeSummaryAsync(ctx.tenantName, ctx.userEmail, ctx.userRole, ctx.userRegion);
            return OkResponse(summary, $"Home summary loaded from PostgreSQL for {ctx.tenantName}");
        }

        [HttpGet("deals")]
        public async Task<ActionResult<ApiResponse<List<DealDto>>>> GetDeals([FromQuery] string? stage = null)
        {
            var ctx = GetUserContext();
            var deals = await _crmDataService.GetDealsAsync(ctx.tenantName, ctx.userEmail, ctx.userRole, ctx.userRegion, stage);
            return OkResponse(deals, $"Deals loaded from PostgreSQL for {ctx.tenantName}");
        }

        [HttpGet("contacts")]
        public async Task<ActionResult<ApiResponse<List<ContactDto>>>> GetContacts()
        {
            var ctx = GetUserContext();
            var contacts = await _crmDataService.GetContactsAsync(ctx.tenantName, ctx.userEmail, ctx.userRole, ctx.userRegion);
            return OkResponse(contacts, $"Contacts loaded from PostgreSQL for {ctx.tenantName}");
        }

        [HttpGet("tickets")]
        public async Task<ActionResult<ApiResponse<List<SupportTicketDto>>>> GetTickets()
        {
            var ctx = GetUserContext();
            var tickets = await _crmDataService.GetTicketsAsync(ctx.tenantName, ctx.userEmail, ctx.userRole, ctx.userRegion);
            return OkResponse(tickets, $"Support tickets loaded from PostgreSQL for {ctx.tenantName}");
        }

        [HttpGet("campaigns")]
        public async Task<ActionResult<ApiResponse<List<CampaignDto>>>> GetCampaigns()
        {
            var ctx = GetUserContext();
            var campaigns = await _crmDataService.GetCampaignsAsync(ctx.tenantName, ctx.userEmail, ctx.userRole, ctx.userRegion);
            return OkResponse(campaigns, $"Campaigns loaded from PostgreSQL for {ctx.tenantName}");
        }

        [HttpGet("audit-logs")]
        public async Task<ActionResult<ApiResponse<List<AuditLogDto>>>> GetAuditLogs()
        {
            var ctx = GetUserContext();
            var logs = await _crmDataService.GetAuditLogsAsync(ctx.tenantName, ctx.userEmail, ctx.userRole, ctx.userRegion);
            return OkResponse(logs, $"Audit logs loaded from PostgreSQL for {ctx.tenantName}");
        }
    }
}
