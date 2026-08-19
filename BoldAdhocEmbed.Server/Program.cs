using BoldAdhocEmbed.Server.Services;
using BoldAdhocEmbed.Server.Middleware;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();

// ===== RBAC Configuration =====
// Register user store for role-based access control
builder.Services.AddSingleton<IUserStore, InMemoryUserStore>();

// Configure Bold Reports settings from configuration
var boldReportsSettings = new BoldReportsSettings
{
    ReportRootUrl = builder.Configuration["BoldReports:ReportRootUrl"] ?? "http://localhost:62807/reporting",
    ReportsSiteIdentifier = builder.Configuration["BoldReports:ReportsSiteIdentifier"] ?? "site1",
    AdminUser = builder.Configuration["BoldReports:AdminUser"] ?? "@syncfusion.com",
    AdminPassword = builder.Configuration["BoldReports:AdminPassword"] ?? "",
    EmbedSecret = builder.Configuration["BoldReports:EmbedSecret"] ?? ""
};

builder.Services.AddSingleton(boldReportsSettings);

// Configure Bold BI Dashboard settings from configuration
var boldBISettings = new BoldBISettings
{
    ServerUrl = builder.Configuration["BoldBI:ServerUrl"] ?? "http://localhost:62807/bi",
    SiteIdentifier = builder.Configuration["BoldBI:SiteIdentifier"] ?? "site3",
    AdminUser = builder.Configuration["BoldBI:AdminUser"] ?? "@syncfusion.com",
    AdminPassword = builder.Configuration["BoldBI:AdminPassword"] ?? "",
    EmbedSecret = builder.Configuration["BoldBI:EmbedSecret"] ?? "",
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

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

// Add CORS - Allow all localhost ports for development and Docker deployment
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        // Allow all localhost variations for development debugging and Docker deployment
        policy
            .WithOrigins(
                "http://localhost:3000",
                "http://localhost:5050",        // Docker deployment
                "http://localhost:5173",        // Vite dev server
                "http://localhost:5274",        // ASP.NET dev server
                "https://localhost:7029",       // HTTPS dev
                "https://localhost:44300",      // HTTPS dev
                "https://localhost:64940",      // HTTPS dev
                "https://localhost:64941",      // HTTPS dev
                "http://127.0.0.1:5173",        // Loopback Vite
                "http://127.0.0.1:5050"         // Loopback Docker
            )
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

app.UseAuthorization();

app.MapControllers();

// Fallback to index.html for SPA routing
app.MapFallbackToFile("/index.html");

app.Run();
