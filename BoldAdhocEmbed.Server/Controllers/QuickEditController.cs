using System;
using System.Threading.Tasks;
using BoldAdhocEmbed.Server.Models;
using BoldAdhocEmbed.Server.Services;
using BoldAdhocEmbed.Server.Services.QuickEdit;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace BoldAdhocEmbed.Server.Controllers
{
    /// <summary>
    /// Quick Edit endpoints. Replaces the old "Copy → open full designer"
    /// flow with an in-page dialog that downloads the source RDL via
    /// Bold Reports v5.0, lets the user add/remove compatible columns
    /// and remove report items, then uploads a new RDL as a separate
    /// report. The original is never modified.
    ///
    /// Routes live under /api/reports to match the rest of the Reports
    /// surface area; controller class is split out for readability.
    /// </summary>
    [ApiController]
    [Authorize]
    [Route("api/reports")]
    public class QuickEditController : BaseController
    {
        private readonly ICustomizeService _customizeService;
        private readonly IAuthenticatedUser _auth;

        public QuickEditController(ICustomizeService customizeService, IAuthenticatedUser auth, ILogger<QuickEditController> logger)
            : base(logger)
        {
            _customizeService = customizeService ?? throw new ArgumentNullException(nameof(customizeService));
            _auth = auth ?? throw new ArgumentNullException(nameof(auth));
        }

        public class QuickEditLoadQuery
        {
            public string ServerPath { get; set; } = string.Empty;
            public string? ReportId { get; set; }
        }

        public class QuickEditPreviewResponse
        {
            public bool Success { get; set; }
            public string? SessionId { get; set; }
            public string? RdlXml { get; set; }
            public List<string> Warnings { get; set; } = new();
            public string? Error { get; set; }
        }

        /// <summary>
        /// Download the source RDL via Bold Reports v5.0 and return the
        /// parsed model the Quick Edit dialog needs. The model is held
        /// server-side under the returned sessionId until save.
        /// </summary>
        [HttpPost("customize/load")]
        public async Task<IActionResult> Load([FromBody] QuickEditLoadQuery query)
        {
            if (query == null || string.IsNullOrWhiteSpace(query.ServerPath))
                return BadRequest(ApiResponse<dynamic>.ErrorResponse("serverPath is required.", "Bad Request"));

            var authUser = _auth.GetAuthContext();
            var email = authUser?.Email ?? string.Empty;

            try
            {
                // Get the Bold Reports token using the same logic as /api/reports/tree
                // This handles caching, credential resolution, and user-scoped token minting
                var boldReportsService = HttpContext.RequestServices.GetService<IBoldReportsService>();
                if (boldReportsService == null)
                    throw new InvalidOperationException("IBoldReportsService not found in DI container");
                
                var token = await GetBoldReportsTokenAsync(boldReportsService);
                if (string.IsNullOrEmpty(token))
                {
                    Logger.LogWarning("Failed to obtain Bold Reports token for Quick Edit load");
                    return StatusCode(502, ApiResponse<dynamic>.ErrorResponse("Failed to obtain Bold Reports token", "Load failed"));
                }

                var (ok, error, model) = await _customizeService.LoadAsync(query.ServerPath, query.ReportId, email, token);
                if (!ok || model == null)
                {
                    Logger.LogWarning("Customize load failed for {Path}: {Error}", query.ServerPath, error);
                    return StatusCode(502, ApiResponse<dynamic>.ErrorResponse(error ?? "Unknown error", "Load failed"));
                }
                return Ok(ApiResponse<dynamic>.SuccessResponse(model, "Quick Edit loaded"));
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Customize load threw");
                return StatusCode(500, ApiResponse<dynamic>.ErrorResponse(ex.Message, "Server error"));
            }
        }

        /// <summary>
        /// Apply the user's edits and write the regenerated RDL back to
        /// Bold Reports under a new name. The original report is never
        /// modified.
        /// </summary>
        [HttpPost("customize/save")]
        public async Task<IActionResult> Save([FromBody] QuickEditSaveRequest req)
        {
            if (req == null)
                return BadRequest(ApiResponse<dynamic>.ErrorResponse("Request body is required.", "Bad Request"));

            var authUser = _auth.GetAuthContext();
            var email = authUser?.Email ?? string.Empty;

            try
            {
                var result = await _customizeService.SaveAsync(req, email);
                if (!result.Success)
                {
                    Logger.LogWarning("Customize save failed: {Error}", result.Error);
                    return StatusCode(400, ApiResponse<dynamic>.ErrorResponse(result.Error ?? "Unknown error", "Save failed"));
                }
                return Ok(ApiResponse<dynamic>.SuccessResponse(result, "Report saved"));
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Customize save threw");
                return StatusCode(500, ApiResponse<dynamic>.ErrorResponse(ex.Message, "Server error"));
            }
        }

        /// <summary>
        /// Dry-run: applies the same edit set as /save but returns the
        /// regenerated RDL XML for the UI to show as a preview. Does
        /// NOT write anything back to Bold Reports.
        /// </summary>
        [HttpPost("customize/preview")]
        public async Task<IActionResult> Preview([FromBody] QuickEditSaveRequest req)
        {
            if (req == null || string.IsNullOrWhiteSpace(req.SessionId))
                return BadRequest(ApiResponse<dynamic>.ErrorResponse("sessionId is required.", "Bad Request"));

            // For Phase 1 we delegate to the service which already has
            // the rebuilder. Re-using SaveAsync would upload; instead we
            // call a thin wrapper that stops before the upload step.
            var result = await _customizeService.PreviewAsync(req);
            if (!result.Success)
            {
                Logger.LogWarning("Customize preview failed: {Error}", result.Error);
                return StatusCode(400, ApiResponse<dynamic>.ErrorResponse(result.Error ?? "Unknown error", "Preview failed"));
            }
            return Ok(ApiResponse<dynamic>.SuccessResponse(result, "Preview ready"));
        }
    }
}
