<template>
  <div id="viewer" style="height:100vh;"></div>
</template>

<script>
export default {
  name: "ReportViewer",

  mounted() {
    $(() => {
      if ($.fn.boldReportViewer) {
        $("#viewer").boldReportViewer({
          serviceUrl: "https://cloud.boldreports.com/reporting/reportservice/api/Viewer",
          reportServerUrl: "https://cloud.boldreports.com/reporting/api/site/b1159695",
          serviceAuthorizationToken: "bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImRoYW5hc2VrYXJhbi5la2FtYmFyYW1Ac3luY2Z1c2lvbi5jb20iLCJuYW1laWQiOiIyNDc5NSIsInVuaXF1ZV9uYW1lIjoiZGM5NDI1YTYtNjgyOC00NGQ4LWIyOWUtYmRmZjNhNWVmN2JkIiwiSVAiOiIxMC4yNDQuMS4yMTQiLCJpc3N1ZWRfZGF0ZSI6IjE3ODIyNDQxMzEiLCJuYmYiOjE3ODIyNDQxMzEsImV4cCI6MTc4NjE0NzIwMCwiaWF0IjoxNzgyMjQ0MTMxLCJpc3MiOiJodHRwczovL2Nsb3VkLmJvbGRyZXBvcnRzLmNvbS9yZXBvcnRpbmcvc2l0ZS9iMTE1OTY5NSIsImF1ZCI6Imh0dHBzOi8vY2xvdWQuYm9sZHJlcG9ydHMuY29tL3JlcG9ydGluZy9zaXRlL2IxMTU5Njk1In0.RKTK595hn708_HlGCOt9Vpy2h1xU4nHs6fYTp8cwb0w",
          reportPath: "/Sample Reports/Sales Order Detail",
          width: "100%",
          height: "100%"
        });
      } else {
        console.error("boldReportViewer not available on jQuery");
      }
    });
  },

  beforeUnmount() {
    if ($.fn.boldReportViewer && $("#viewer").data("boldReportViewer")) {
      $("#viewer").boldReportViewer("destroy");
    }
  }
};
</script>
