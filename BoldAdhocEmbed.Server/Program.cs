using BoldAdhocEmbed.Server.Services;
using BoldAdhocEmbed.Server.Middleware;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();

// Allow dependency-free /health endpoint + minor JSON niceties
builder.Services.AddHealthChecks();

// ===== RBAC Configuration =====
// Register user store for role-based access control
builder.Services.AddSingleton<IUserStore, InMemoryUserStore>();

// ===== Authentication / Authorization =====
// JwtBearer is the primary validation path. When the configured Keycloak
// metadata is unreachable (local dev), the [Authorize] pipeline still
// requires a valid Bearer token; the simplified legacy fallback in
// AuthController.AuthenticateWithJwt is gated behind a feature flag and
// rejected by default in Production.
var jwtAuthority = builder.Configuration["Jwt:Authority"];
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "BoldAdhocUsers";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "BoldAdhoc";
var jwtSigningKey = builder.Configuration["Jwt:Key"] ?? builder.Configuration["Jwt:SigningKey"];

var effectiveSigningKey = string.IsNullOrWhiteSpace(jwtSigningKey)
    ? "local-development-signing-key-change-before-production-2026"
    : jwtSigningKey;

builder.Services.AddAuthentication(Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = false;
        options.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,
            ValidateAudience = true,
            ValidAudience = jwtAudience,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(effectiveSigningKey)),
            ClockSkew = TimeSpan.FromSeconds(30),
        };
    });

builder.Services.AddAuthorization();

// ===== SECURE CREDENTIAL CONFIGURATION =====
// Credentials MUST be supplied via environment variables in non-Development environments.
// In Development, we allow appsettings to provide a convenient default but still prefer env vars.
bool isDevelopment = builder.Environment.IsDevelopment();

string GetRequiredEnv(string key, string configKey, string? devDefault = null)
{
    // Preferred order: env var > appsettings > dev default
    var envVal = Environment.GetEnvironmentVariable(key);
    if (!string.IsNullOrWhiteSpace(envVal)) return envVal;
    var configVal = builder.Configuration[configKey];
    if (!string.IsNullOrWhiteSpace(configVal)) return configVal;
    if (isDevelopment && devDefault != null) return devDefault;
    throw new InvalidOperationException(
        $"Required configuration '{key}' is missing. " +
        $"Set the environment variable or add '{configKey}' to appsettings.");
}

// Configure Bold Reports settings with secure credential resolution.
// Distinct from BoldBI secrets — one leak must not compromise both products.
var boldReportsPassword = GetRequiredEnv("BOLD_REPORTS_PASSWORD", "BoldReports:AdminPassword",
    isDevelopment ? builder.Configuration["BoldReports:AdminPassword"] ?? "Admin@123" : null);
var boldReportsSecret = GetRequiredEnv("BOLD_REPORTS_SECRET", "BoldReports:EmbedSecret",
    isDevelopment ? builder.Configuration["BoldReports:EmbedSecret"] ?? "" : null);

var boldReportsSettings = new BoldReportsSettings
{
    ReportRootUrl = builder.Configuration["BoldReports:ReportRootUrl"] ?? "http://localhost:62807/reporting",
    ReportsSiteIdentifier = builder.Configuration["BoldReports:ReportsSiteIdentifier"] ?? "site1",
    AdminUser = builder.Configuration["BoldReports:AdminUser"] ?? "@syncfusion.com",
    AdminPassword = boldReportsPassword,
    EmbedSecret = boldReportsSecret
};

builder.Services.AddSingleton(boldReportsSettings);

// Configure Bold BI Dashboard settings with secure credential resolution.
// Explicitly reject identical secrets to enforce product separation.
var boldBIPassword = GetRequiredEnv("BOLD_BI_PASSWORD", "BoldBI:AdminPassword",
    isDevelopment ? builder.Configuration["BoldBI:AdminPassword"] ?? "" : null);
var boldBISecret = GetRequiredEnv("BOLD_BI_SECRET", "BoldBI:EmbedSecret",
    isDevelopment ? builder.Configuration["BoldBI:EmbedSecret"] ?? "" : null);

if (!string.IsNullOrEmpty(boldReportsSecret)
    && !string.IsNullOrEmpty(boldBISecret)
    && string.Equals(boldReportsSecret, boldBISecret, StringComparison.Ordinal))
{
    throw new InvalidOperationException(
        "BoldBI:EmbedSecret must be distinct from BoldReports:EmbedSecret. " +
        "Rotate BoldBI:EmbedSecret via the BOLD_BI_SECRET env var.");
}

var boldBISettings = new BoldBISettings
{
    ServerUrl = builder.Configuration["BoldBI:ServerUrl"] ?? "http://localhost:62807/bi",
    SiteIdentifier = builder.Configuration["BoldBI:SiteIdentifier"] ?? "site3",
    AdminUser = builder.Configuration["BoldBI:AdminUser"] ?? "@syncfusion.com",
    AdminPassword = boldBIPassword,
    EmbedSecret = boldBISecret,
    UserEmail = builder.Configuration["BoldBI:UserEmail"] ?? "user@example.com",
    Environment = builder.Configuration["BoldBI:Environment"] ?? "onpremise"
};

builder.Services.AddSingleton(boldBISettings);

// Add caching service
builder.Services.AddMemoryCache();
builder.Services.AddScoped<ICacheService, MemoryCacheService>();

// Configure HttpClient with proper reuse and timeouts
builder.Services.AddHttpClient<IBoldReportsService, BoldReportsService>()
    .ConfigureHttpClient(client =>
    {
        client.Timeout = TimeSpan.FromSeconds(30);
    });

// Configure HttpClient for Bold BI Dashboard service
builder.Services.AddHttpClient<IBoldBIDashboardService, BoldBIDashboardService>()
    .ConfigureHttpClient(client =>
    {
        client.Timeout = TimeSpan.FromSeconds(30);
    });

// Register token helper
builder.Services.AddScoped<ITokenHelper, TokenHelper>();

// Register CRM Data Service for multi-tenant PostgreSQL queries
builder.Services.AddScoped<ICrmDataService, CrmDataService>();

// HttpContext-aware identity resolver — controllers MUST scope identity
// through this rather than reading client-supplied X-User-* headers.
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IAuthenticatedUser, AuthenticatedUser>();

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

// Add CORS — origins are config-driven. In Production, the SPA is served
// behind nginx same-origin so CORS is intentionally narrow; in Development
// the Vite dev server origins may be added via Cors:AllowedOrigins.
var configuredOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? Array.Empty<string>();

// Add the legacy localhost dev origins in Development only, behind a flag
// so they never leak to Production deployments using this binary.
if (isDevelopment)
{
    var devOrigins = new[]
    {
        "http://localhost:3000",
        "http://localhost:5050",
        "http://localhost:5173",
        "http://localhost:5274",
        "http://localhost:51821",
        "https://localhost:7029",
        "https://localhost:44300",
        "https://localhost:64940",
        "https://localhost:64941",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:51821",
        "http://127.0.0.1:64941",
        "http://127.0.0.1:5050"
    };
    configuredOrigins = configuredOrigins.Concat(devOrigins).Distinct().ToArray();
}

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        if (configuredOrigins.Length == 0)
        {
            // Same-origin only — no cross-site requests allowed.
            policy.AllowAnyHeader().AllowAnyMethod();
            return;
        }
        policy.WithOrigins(configuredOrigins)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

// Add logging
builder.Services.AddLogging(config =>
{
    config.AddConsole();
    config.AddDebug();
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.MapOpenApi();
}

// Use CORS before other middleware
app.UseCors("AllowFrontend");

// Use error handling middleware
app.UseMiddleware<ErrorHandlingMiddleware>();

// Serve static files in all environments
app.UseDefaultFiles();
app.MapStaticAssets();

app.UseHttpsRedirection();

app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

// Dependency-free health endpoint, replacement for prod healthcheck that
// used to hit an authenticated business endpoint with a forged email.
app.MapHealthChecks("/health");

app.MapControllers();

// Fallback to index.html for SPA routing
app.MapFallbackToFile("/index.html");

app.Run();
