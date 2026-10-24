<template>
  <div id="app">
    <div id="dashboard">
      <div id="errorModal" class="modal" v-show="showErrorModal">
        <p class="error-message">
          {{ errorMessage }}
          Please use this
          <a href="https://help.boldbi.com/site-administration/embed-settings/" target="_blank">
            link
          </a>
          to obtain the Json file from the Bold BI server.
        </p>
      </div>
    </div>
  </div>
</template>

<script>
import { BoldBI } from "@boldbi/boldbi-embedded-sdk";

export default {
  name: "Dashboard",

  data() {
    return {
      errorMessage: "",
      showErrorModal: false
    };
  },

  watch: {
    '$route.query.mode': {
      handler(newMode, oldMode) {
        if (newMode === 'designer') {
          this.openDesigner();
        } else if (oldMode === 'designer' && !newMode) {
          // Switching from designer back to dashboard
          this.renderDashboardFromRoute();
        }
      }
    }
  },

  async mounted() {
    this.renderDashboardFromRoute();
  },

  methods: {
    async renderDashboardFromRoute() {
      const ApiHost = "http://localhost:8080";
      try {
        const response = await fetch(ApiHost + "/getdetails");
        const data = await response.json();
        if (this.$route.query.mode === 'designer') {
          this.openDesigner();
        } else {
          this.renderDashboard(data, ApiHost);
        }
      } catch (error) {
        this.errorMessage = "To compile and run the project, an embed config file needs to be required.";
        this.showErrorModal = true;
      }
    },

    async getEmbedToken(ApiHost) {
      const response = await fetch(ApiHost + "/tokengeneration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });

      if (!response.ok) throw new Error("Token fetch failed");

      return await response.text();
    },

    async renderDashboard(data, ApiHost) {

      // ✅ Destroy previous instance BEFORE creating new
      this.destroyDashboard();

      try {
        const token = await this.getEmbedToken(ApiHost);

        const dashboard = BoldBI.create({
          serverUrl: data.ServerUrl + "/" + data.SiteIdentifier,
          dashboardId: data.DashboardId,
          embedContainerId: "dashboard",
          embedToken: token,
          width: "100%",
          height: window.innerHeight + "px"
        });

        dashboard.loadDashboard();

      } catch (err) {
        console.error("Dashboard render error:", err);
      }
    },

    // ✅ ✅ FINAL CLEANUP METHOD
    destroyDashboard() {
      try {
        const instance = BoldBI.getInstance("dashboard");
        if (instance) {
          instance.destroy();
        }
      } catch (e) {
        console.warn("Destroy error:", e);
      }

      const el = document.getElementById("dashboard");
      if (el) {
        el.innerHTML = "";
      }
    },

    async openDesigner() {
      const ApiHost = "http://localhost:8080";

      try {
        const response = await fetch(ApiHost + "/getdetails");
        const data = await response.json();

        this.destroyDashboard();

        const token = await this.getEmbedToken(ApiHost);

        const dashboard = BoldBI.create({
          serverUrl: data.ServerUrl + "/" + data.SiteIdentifier,
          mode: BoldBI.Mode.Design,
          embedContainerId: "dashboard",
          embedToken: token,
          width: "100%",
          height: window.innerHeight + "px"
        });

        dashboard.loadDesigner();

      } catch (err) {
        console.error("Designer render error:", err);
      }
    }
  },

  beforeUnmount() {
    this.destroyDashboard();
  },

  unmounted() {
    this.destroyDashboard(); // ✅ extra safety
  }
};
</script>

<style>
.error-message {
  color: red;
  text-align: center;
  font-size: 20px;
  margin-top: 300px;
}
</style>
