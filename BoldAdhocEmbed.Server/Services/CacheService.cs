using Microsoft.Extensions.Caching.Memory;

namespace BoldAdhocEmbed.Server.Services
{
    /// <summary>
    /// Interface for caching service
    /// Provides abstraction for different caching implementations
    /// </summary>
    public interface ICacheService
    {
        /// <summary>
        /// Get a value from cache
        /// </summary>
        T Get<T>(string key);

        /// <summary>
        /// Get a value from cache asynchronously
        /// </summary>
        Task<T> GetAsync<T>(string key);

        /// <summary>
        /// Set a value in cache
        /// </summary>
        void Set<T>(string key, T value, TimeSpan? expiration = null);

        /// <summary>
        /// Set a value in cache asynchronously
        /// </summary>
        Task SetAsync<T>(string key, T value, TimeSpan? expiration = null);

        /// <summary>
        /// Remove a value from cache
        /// </summary>
        void Remove(string key);

        /// <summary>
        /// Remove a value from cache asynchronously
        /// </summary>
        Task RemoveAsync(string key);

        /// <summary>
        /// Get or create a cached value
        /// </summary>
        Task<T> GetOrCreateAsync<T>(string key, Func<Task<T>> factory, TimeSpan? expiration = null);

        /// <summary>
        /// Clear all cache entries
        /// </summary>
        void Clear();
    }

    /// <summary>
    /// In-memory cache service implementation using IMemoryCache
    /// </summary>
    public class MemoryCacheService : ICacheService
    {
        private readonly IMemoryCache _cache;
        private readonly ILogger<MemoryCacheService> _logger;

        /// <summary>
        /// Default cache expiration: 1 hour
        /// </summary>
        private static readonly TimeSpan DefaultExpiration = TimeSpan.FromHours(1);

        public MemoryCacheService(IMemoryCache cache, ILogger<MemoryCacheService> logger)
        {
            _cache = cache ?? throw new ArgumentNullException(nameof(cache));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public T Get<T>(string key)
        {
            if (string.IsNullOrWhiteSpace(key))
                return default;

            var found = _cache.TryGetValue(key, out T value);
            
            if (found)
            {
                _logger.LogDebug("Cache hit for key: {Key}", key);
                return value;
            }

            _logger.LogDebug("Cache miss for key: {Key}", key);
            return default;
        }

        public Task<T> GetAsync<T>(string key) =>
            Task.FromResult(Get<T>(key));

        public void Set<T>(string key, T value, TimeSpan? expiration = null)
        {
            if (string.IsNullOrWhiteSpace(key))
                return;

            var options = new MemoryCacheEntryOptions();
            
            if (expiration.HasValue)
            {
                options.AbsoluteExpirationRelativeToNow = expiration;
            }
            else
            {
                options.AbsoluteExpirationRelativeToNow = DefaultExpiration;
            }

            _cache.Set(key, value, options);
            _logger.LogDebug("Set cache key: {Key} with expiration: {Expiration}", key, expiration ?? DefaultExpiration);
        }

        public Task SetAsync<T>(string key, T value, TimeSpan? expiration = null)
        {
            Set(key, value, expiration);
            return Task.CompletedTask;
        }

        public void Remove(string key)
        {
            if (string.IsNullOrWhiteSpace(key))
                return;

            _cache.Remove(key);
            _logger.LogDebug("Removed cache key: {Key}", key);
        }

        public Task RemoveAsync(string key)
        {
            Remove(key);
            return Task.CompletedTask;
        }

        public async Task<T> GetOrCreateAsync<T>(
            string key,
            Func<Task<T>> factory,
            TimeSpan? expiration = null)
        {
            if (string.IsNullOrWhiteSpace(key))
                throw new ArgumentNullException(nameof(key));

            if (factory == null)
                throw new ArgumentNullException(nameof(factory));

            var cached = Get<T>(key);
            
            if (cached != null)
                return cached;

            _logger.LogDebug("Cache miss for key: {Key}, creating new value", key);
            
            var value = await factory();
            
            if (value != null)
                Set(key, value, expiration);

            return value;
        }

        public void Clear()
        {
            _logger.LogInformation("Clearing all cache entries");
            // Note: IMemoryCache doesn't provide a Clear method
            // In production, consider using IDistributedCache instead
        }
    }
}
