using System.ComponentModel.DataAnnotations;

namespace BoldAdhocEmbed.Server.Validators
{
    /// <summary>
    /// Centralized request validation methods
    /// Provides validation logic for common request parameters
    /// </summary>
    public static class RequestValidator
    {
        /// <summary>
        /// Validate email address format
        /// </summary>
        public static List<string> ValidateEmail(string email)
        {
            var errors = new List<string>();

            if (string.IsNullOrWhiteSpace(email))
            {
                errors.Add("Email is required");
            }
            else if (!new EmailAddressAttribute().IsValid(email))
            {
                errors.Add("Email format is invalid");
            }

            return errors;
        }

        /// <summary>
        /// Validate string field with optional length constraints
        /// </summary>
        public static List<string> ValidateString(
            string value,
            string fieldName,
            int? minLength = null,
            int? maxLength = null,
            bool required = true)
        {
            var errors = new List<string>();

            if (string.IsNullOrWhiteSpace(value))
            {
                if (required)
                    errors.Add($"{fieldName} is required");
            }
            else
            {
                if (minLength.HasValue && value.Length < minLength)
                    errors.Add($"{fieldName} must be at least {minLength} characters");

                if (maxLength.HasValue && value.Length > maxLength)
                    errors.Add($"{fieldName} cannot exceed {maxLength} characters");
            }

            return errors;
        }

        /// <summary>
        /// Validate that value is not null or empty
        /// </summary>
        public static bool IsNullOrEmpty(string value) =>
            string.IsNullOrWhiteSpace(value);

        /// <summary>
        /// Validate that a list contains items
        /// </summary>
        public static List<string> ValidateList<T>(
            IEnumerable<T> items,
            string fieldName)
        {
            var errors = new List<string>();

            if (items == null || !items.Any())
                errors.Add($"{fieldName} cannot be empty");

            return errors;
        }

        /// <summary>
        /// Validate positive integer
        /// </summary>
        public static List<string> ValidatePositiveInt(
            int value,
            string fieldName)
        {
            var errors = new List<string>();

            if (value <= 0)
                errors.Add($"{fieldName} must be a positive number");

            return errors;
        }

        /// <summary>
        /// Validate date is not in the past
        /// </summary>
        public static List<string> ValidateFutureDate(
            DateTime date,
            string fieldName)
        {
            var errors = new List<string>();

            if (date < DateTime.UtcNow)
                errors.Add($"{fieldName} cannot be in the past");

            return errors;
        }

        /// <summary>
        /// Validate URL format
        /// </summary>
        public static List<string> ValidateUrl(
            string url,
            string fieldName)
        {
            var errors = new List<string>();

            if (string.IsNullOrWhiteSpace(url))
            {
                errors.Add($"{fieldName} is required");
            }
            else if (!Uri.TryCreate(url, UriKind.Absolute, out var uriResult) ||
                     (uriResult.Scheme != Uri.UriSchemeHttp && uriResult.Scheme != Uri.UriSchemeHttps))
            {
                errors.Add($"{fieldName} must be a valid HTTP(S) URL");
            }

            return errors;
        }
    }
}
