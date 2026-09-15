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

            var url =
                "https://keycloak.boldbidemo.com/realms/master/protocol/openid-connect/auth" +
                "?client_id=DemoRealm" +
                "&response_type=token" +
                "&scope=openid" +
                $"&redirect_uri={Uri.EscapeDataString(redirectUri)}";

            return Redirect(url);
        }

        [HttpGet]
        public IActionResult SSOCallback()
        {
            return Redirect("/sso-callback" + Request.QueryString);
        }
    }
}
