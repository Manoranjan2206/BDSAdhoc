using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using BoldAdhocEmbed.Server.Services;
using BoldAdhocEmbed.Server.Models;

namespace BoldAdhocEmbed.Server.Controllers
{
    /// <summary>
    /// CRM data access layer — every endpoint relies solely on the validated
    /// JWT (email, role, region, tenant) decoded via
    /// <see cref="IAuthenticatedUser"/>. Client-supplied X-User-* headers
    /// are NEVER trusted.
    /// </summary>
    [ApiController]
    [Authorize]
    [Route("api/[controller]")]
    public class CrmController : BaseController
    {
        private readonly ICrmDataService _crmDataService;
        private readonly IAuthenticatedUser _auth;

        public CrmController(
            ICrmDataService crmDataService,
            IAuthenticatedUser auth,
            ILogger<CrmController> logger)
            : base(logger)
        {
            _crmDataService = crmDataService;
            _auth = auth;
        }

        private AuthUserContext GetAuthContext()
        {
            var ctx = _auth.GetAuthContext();
            if (ctx == null)
            {
                throw new UnauthorizedAccessException(
                    "Authenticated user could not be resolved from token claims.");
            }
            return ctx;
        }

        [HttpGet("home-summary")]
        public async Task<ActionResult<ApiResponse<HomeSummaryDto>>> GetHomeSummary(
            [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
        {
            var ctx = GetAuthContext();
            var summary = await _crmDataService.GetHomeSummaryAsync(ctx);
            return OkResponse(summary, $"Home summary loaded for {ctx.TenantName}");
        }

        [HttpGet("deals")]
        public async Task<ActionResult<ApiResponse<List<DealDto>>>> GetDeals(
            [FromQuery] string? stage = null,
            [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
        {
            var ctx = GetAuthContext();
            page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 200);
            var deals = await _crmDataService.GetDealsAsync(ctx, stage, page, pageSize);
            return OkResponse(deals, $"Deals loaded for {ctx.TenantName}");
        }

        [HttpGet("contacts")]
        public async Task<ActionResult<ApiResponse<List<ContactDto>>>> GetContacts(
            [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
        {
            var ctx = GetAuthContext();
            page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 200);
            var contacts = await _crmDataService.GetContactsAsync(ctx, page, pageSize);
            return OkResponse(contacts, $"Contacts loaded for {ctx.TenantName}");
        }

        [HttpGet("tickets")]
        public async Task<ActionResult<ApiResponse<List<SupportTicketDto>>>> GetTickets(
            [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
        {
            var ctx = GetAuthContext();
            page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 200);
            var tickets = await _crmDataService.GetTicketsAsync(ctx, page, pageSize);
            return OkResponse(tickets, $"Support tickets loaded for {ctx.TenantName}");
        }

        [HttpGet("campaigns")]
        public async Task<ActionResult<ApiResponse<List<CampaignDto>>>> GetCampaigns(
            [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
        {
            var ctx = GetAuthContext();
            page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 200);
            var campaigns = await _crmDataService.GetCampaignsAsync(ctx, page, pageSize);
            return OkResponse(campaigns, $"Campaigns loaded for {ctx.TenantName}");
        }

        [HttpGet("audit-logs")]
        public async Task<ActionResult<ApiResponse<List<AuditLogDto>>>> GetAuditLogs(
            [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
        {
            var ctx = GetAuthContext();
            page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 200);
            var logs = await _crmDataService.GetAuditLogsAsync(ctx, page, pageSize);
            return OkResponse(logs, $"Audit logs loaded for {ctx.TenantName}");
        }
    }
}
