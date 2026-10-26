using BoldAdhocEmbed.Server.Services;
using BoldAdhocEmbed.Server.Middleware;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.HttpOverrides;
using System.Text;
using System.IO;

// Load environment variables from .env file if present
for (var dir = new DirectoryInfo(Directory.GetCurrentDirectory()); dir != null; dir = dir.Parent)
{
    var envPath = Path.Combine(dir.FullName, ".env");
    if (File.Exists(envPath))
    {
        foreach (var rawLine in File.ReadAllLines(envPath))
        {
            var line = rawLine.Trim();
            if (string.IsNullOrEmpty(line) || line.StartsWith('#')) continue;
            var idx = line.IndexOf('=');
            if (idx <= 0) continue;
            var key = line.Substring(0, idx).Trim();
            var val = line.Substring(idx + 1).Trim().Trim('"', '\'');
            if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable(key)))
            {
                Environment.SetEnvironmentVariable(key, val);
            }
        }
        break;
    }
}

var builder = WebApplication.CreateBuilder(args);

// Bind to port 5274 only if ASPNETCORE_URLS or DOTNET_URLS is not explicitly configured.
// In production container environments, ASPNETCORE_URLS (e.g. http://+:8080) takes precedence.
var configuredUrls = Environment.GetEnvironmentVariable("ASPNETCORE_URLS")
    ?? Environment.GetEnvironmentVariable("DOTNET_URLS");
if (string.IsNullOrWhiteSpace(configuredUrls))
{
    builder.WebHost.UseUrls("http://0.0.0.0:5274");
}

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

if (!builder.Environment.IsDevelopment() && effectiveSigningKey == "local-development-signing-key-change-before-production-2026")
{
    throw new InvalidOperationException("FATAL: Default JWT signing key detected in non-development environment. Configure 'Jwt:Key' or 'Jwt:SigningKey' securely.");
}

// ===== Dual Authentication: JWT Bearer (for API) + Cookie/OIDC (for Azure AD login flow) =====
builder.Services.AddAuthentication(options =>
{
    options.DefaultScheme = "SmartScheme";
    options.DefaultAuthenticateScheme = "SmartScheme";
    options.DefaultChallengeScheme = "SmartScheme";
})
    .AddPolicyScheme("SmartScheme", "Bearer or Cookie", options =>
    {
        options.ForwardDefaultSelector = context =>
        {
            var authHeader = context.Request.Headers.Authorization.FirstOrDefault();
            if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                return Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme;
            }

            // For Azure AD OIDC callback, use Cookie auth
            if (context.Request.Path.StartsWithSegments("/api/auth/azure-callback") ||
                context.Request.Cookies.ContainsKey(".AspNetCore.Cookies"))
            {
                return CookieAuthenticationDefaults.AuthenticationScheme;
            }

            // Default to JWT Bearer so unauthorized API calls return 401 instead of redirecting
            return Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme;
        };
    })
    .AddCookie(CookieAuthenticationDefaults.AuthenticationScheme, options =>
    {
        // Session cookie settings - use MemoryCacheTicketStore so authentication tickets
        // are kept in server memory instead of serializing large claims into the Set-Cookie header.
        // This keeps HTTP response headers well under 500 bytes and avoids Nginx 502 "upstream sent too big header".
        options.Cookie.SameSite = SameSiteMode.None;
        options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
        options.Cookie.HttpOnly = true;
        options.ExpireTimeSpan = TimeSpan.FromHours(1);
        options.SlidingExpiration = true;
        options.SessionStore = new MemoryCacheTicketStore(new Microsoft.Extensions.Caching.Memory.MemoryCache(
            new Microsoft.Extensions.Caching.Memory.MemoryCacheOptions()));
    })
    .AddJwtBearer(Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme, options =>
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

        options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
        {
            OnAuthenticationFailed = context =>
            {
                var logger = context.HttpContext.RequestServices.GetRequiredService<ILogger<Program>>();
                logger.LogError(context.Exception, "JWT Authentication failed!");
                return Task.CompletedTask;
            },
            OnTokenValidated = context =>
            {
                var logger = context.HttpContext.RequestServices.GetRequiredService<ILogger<Program>>();
                logger.LogInformation("JWT Token successfully validated.");
                return Task.CompletedTask;
            }
        };
    })
    .AddOpenIdConnect("AzureAd", options =>
    {
        // ===== Azure AD OIDC Configuration =====
        options.SignInScheme = CookieAuthenticationDefaults.AuthenticationScheme;
        options.Authority = builder.Configuration["AzureAd:Authority"] ?? "https://login.microsoftonline.com/common";
        options.ClientId = builder.Configuration["AzureAd:ClientId"] ?? "";
        options.ClientSecret = Environment.GetEnvironmentVariable("AZURE_AD_CLIENT_SECRET") 
            ?? builder.Configuration["AzureAd:ClientSecret"] ?? "";
        options.ResponseType = "code";
        // Do NOT serialize raw OAuth tokens into the session cookie (prevents large Set-Cookie headers)
        options.SaveTokens = false;
        options.UseTokenLifetime = true;

        // Configure correlation cookie to survive OAuth redirect flow
        options.CorrelationCookie.SameSite = SameSiteMode.None;
        options.CorrelationCookie.SecurePolicy = CookieSecurePolicy.Always;
        options.CorrelationCookie.HttpOnly = true;

        // Redirect URIs (must match app registration in Azure Portal)
        var callbackPath = builder.Configuration["AzureAd:CallbackPath"] ?? "/signin-oidc";
        options.CallbackPath = new PathString(callbackPath);

        // Map Azure AD claims to standard claim types for easier consumption
        options.TokenValidationParameters = new TokenValidationParameters
        {
            NameClaimType = "name",
            RoleClaimType = "roles",
            ValidateIssuer = false,  // Let Azure AD handle issuer validation via MetadataAddress
            SaveSigninToken = false  // Do not retain raw sign-in token to keep ticket small
        };

        // Events for logging and custom handling
        options.Events = new Microsoft.AspNetCore.Authentication.OpenIdConnect.OpenIdConnectEvents
        {
            OnTokenValidated = context =>
            {
                var logger = context.HttpContext.RequestServices.GetRequiredService<ILogger<Program>>();
                logger.LogInformation("Azure AD token validated for user: {Email}", 
                    context.Principal?.FindFirst("preferred_username")?.Value ?? "unknown");
                return Task.CompletedTask;
            },
            OnAuthenticationFailed = context =>
            {
                var logger = context.HttpContext.RequestServices.GetRequiredService<ILogger<Program>>();
                logger.LogError(context.Exception, "Azure AD authentication failed");
                context.HandleResponse();
                context.Response.Redirect("/login?error=azure_auth_failed");
                return Task.CompletedTask;
            },
            OnRedirectToIdentityProvider = context =>
            {
                // CRITICAL: Force HTTPS for redirect_uri sent to Azure AD
                // Azure AD requires exact match of redirect URI scheme (http != https)
                var redirectUri = context.ProtocolMessage.RedirectUri;
                
                var logger = context.HttpContext.RequestServices.GetRequiredService<ILogger<Program>>();
                logger.LogInformation("OnRedirectToIdentityProvider - Original redirect_uri: {Uri}", redirectUri);
                
                if (redirectUri != null && redirectUri.StartsWith("http://", StringComparison.OrdinalIgnoreCase))
                {
                    var host = context.HttpContext.Request.Host.Host;
                    bool isLocalhost = host.Contains("localhost") || host.Contains("127.0.0.1");
                    
                    if (!isLocalhost)  // Only convert for non-localhost
                    {
                        var httpsUri = redirectUri.Replace("http://", "https://", StringComparison.OrdinalIgnoreCase);
                        context.ProtocolMessage.RedirectUri = httpsUri;
                        
                        logger.LogWarning("Azure AD: Forced HTTPS - Old: {OldUri}, New: {NewUri}", 
                            redirectUri, httpsUri);
                    }
                }
                else
                {
                    logger.LogInformation("Redirect URI already HTTPS or null");
                }
                
                return Task.CompletedTask;
            }
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
    isDevelopment ? builder.Configuration["BoldReports:AdminPassword"] : null);
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

// Register Database Bootstrapper for automated multi-tenant schema initialization
builder.Services.AddScoped<IDatabaseBootstrapper, DatabaseBootstrapper>();

// HttpContext-aware identity resolver — controllers MUST scope identity
// through this rather than reading client-supplied X-User-* headers.
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IAuthenticatedUser, AuthenticatedUser>();

// Quick Edit / Customize services (Phase 1)
builder.Services.AddScoped<BoldAdhocEmbed.Server.Services.QuickEdit.IRdlParser,
    BoldAdhocEmbed.Server.Services.QuickEdit.RdlParser>();
builder.Services.AddScoped<BoldAdhocEmbed.Server.Services.QuickEdit.IRdlDependencyChecker,
    BoldAdhocEmbed.Server.Services.QuickEdit.RdlDependencyChecker>();
builder.Services.AddScoped<BoldAdhocEmbed.Server.Services.QuickEdit.IRdlRebuilder,
    BoldAdhocEmbed.Server.Services.QuickEdit.RdlRebuilder>();
builder.Services.AddHttpClient<BoldAdhocEmbed.Server.Services.QuickEdit.IBoldItemsClient,
    BoldAdhocEmbed.Server.Services.QuickEdit.BoldItemsClient>();
builder.Services.AddScoped<BoldAdhocEmbed.Server.Services.QuickEdit.ICustomizeService,
    BoldAdhocEmbed.Server.Services.QuickEdit.CustomizeService>();

// Session store is a singleton so the in-memory dictionary survives
// across HTTP requests. A scoped CustomizeService would create a new
// dictionary per request — the sessionId minted by /load would be
// unknown to the /save call a few seconds later. The 20-minute TTL
// inside QuickEditSessionStore handles cleanup.
builder.Services.AddSingleton<BoldAdhocEmbed.Server.Services.QuickEdit.IQuickEditSessionStore,
    BoldAdhocEmbed.Server.Services.QuickEdit.QuickEditSessionStore>();

// New Report builder services. The RDL generator is stateless (singleton);
// the dataset catalog needs its own HttpClient for the Bold Reports REST API.
builder.Services.AddSingleton<BoldAdhocEmbed.Server.Services.ReportBuilder.IRdlGenerator,
    BoldAdhocEmbed.Server.Services.ReportBuilder.RdlGenerator>();
builder.Services.AddHttpClient<BoldAdhocEmbed.Server.Services.ReportBuilder.IDatasetCatalogService,
    BoldAdhocEmbed.Server.Services.ReportBuilder.DatasetCatalogService>();

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

// Auto-create databases, schemas, tables, and starter data for all tenants on startup
using (var scope = app.Services.CreateScope())
{
    try
    {
        var bootstrapper = scope.ServiceProvider.GetRequiredService<IDatabaseBootstrapper>();
        await bootstrapper.InitializeAllDatabasesAsync();
    }
    catch (Exception ex)
    {
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "Failed to auto-initialize multi-tenant databases during startup");
    }
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.MapOpenApi();
}

// Use CORS before other middleware
app.UseCors("AllowFrontend");

// Configure ForwardedHeaders for X-Forwarded-Proto, X-Forwarded-For, X-Forwarded-Host
// This is standard practice when running behind a reverse proxy (e.g., E2B's nginx)
// The proxy sends X-Forwarded-Proto: https even though the connection to Kestrel is HTTP
// Without this, the OIDC middleware sees the request scheme as HTTP and constructs
// redirect_uri as http://, which doesn't match Azure Portal's https:// registration
var forwardedHeadersOptions = new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedProto 
                     | ForwardedHeaders.XForwardedHost
                     | ForwardedHeaders.XForwardedFor
};
// Allow proxy headers from the E2B reverse proxy
forwardedHeadersOptions.KnownNetworks.Clear();
forwardedHeadersOptions.KnownProxies.Clear();
forwardedHeadersOptions.AllowedHosts.Clear();
app.UseForwardedHeaders(forwardedHeadersOptions);

// Force HTTPS scheme for OIDC redirect_uri construction as a fallback
// In case the X-Forwarded-Proto header is missing or can't be relied upon
app.Use(async (context, next) =>
{
    // For non-localhost environments (E2B, production), force request scheme to HTTPS if not already set
    var host = context.Request.Host.Host;
    bool isLocalhost = host.Contains("localhost") || host.Contains("127.0.0.1");
    
    if (!isLocalhost && context.Request.Scheme == "http")
    {
        var logger = context.RequestServices.GetRequiredService<ILogger<Program>>();
        logger.LogWarning("Fallback: Forcing HTTPS scheme for OIDC - Original: {Scheme}://{Host}{Path}", 
            context.Request.Scheme, context.Request.Host, context.Request.Path);
        
        context.Request.Scheme = "https";
    }
    
    await next(context);
});

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
