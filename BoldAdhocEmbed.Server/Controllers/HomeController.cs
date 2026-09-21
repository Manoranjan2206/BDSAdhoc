using Microsoft.AspNetCore.Mvc;

namespace BoldAdhocEmbed.Server.Controllers
{
    public class HomeController : Controller
    {
        [HttpGet]
        public IActionResult SSOLogin()
        {
            var redirectUri =
                $"{Request.Scheme}://{Request.Host}/Home/SSOCallback";
            var nonce = Guid.NewGuid().ToString("N");

            var url =
                "https://keycloak.boldbidemo.com/realms/master/protocol/openid-connect/auth" +
                "?client_id=crm-app" +
                "&response_type=" + Uri.EscapeDataString("id_token token") +
                "&scope=openid" +
                $"&nonce={nonce}" +
                $"&redirect_uri={Uri.EscapeDataString(redirectUri)}";

            return Redirect(url);
        }

        [HttpGet]
        public IActionResult SSOCallback()
        {
            return Redirect("/sso-callback" + Request.QueryString);
        }

        [HttpGet]
        public IActionResult SSOLogout([FromQuery] string? idToken = null, [FromQuery] string? postLogoutRedirectUri = null)
        {
            var redirectUri = !string.IsNullOrEmpty(postLogoutRedirectUri)
                ? postLogoutRedirectUri
                : $"{Request.Scheme}://{Request.Host}/login";

            var url =
                "https://keycloak.boldbidemo.com/realms/master/protocol/openid-connect/logout" +
                "?client_id=crm-app" +
                $"&post_logout_redirect_uri={Uri.EscapeDataString(redirectUri)}";

            if (!string.IsNullOrEmpty(idToken))
            {
                url += $"&id_token_hint={Uri.EscapeDataString(idToken)}";
            }

            return Redirect(url);
        }
    }
}
