import { createRouter, createWebHashHistory } from 'vue-router';
import { BoldBI } from "@boldbi/boldbi-embedded-sdk";

import Dashboard from './views/Dashboard.vue';
import ReportViewer from './views/ReportViewer.vue';
import ReportDesigner from './views/ReportDesigner.vue';

const BOLD_REPORTS_VERSION = "13.1.26";

const RESOURCES = {
  common: {
    css: [
      `https://cdn.boldreports.com/${BOLD_REPORTS_VERSION}/content/v2.0/tailwind-light/bold.report-viewer.min.css`
    ],
    js: [
      `https://cdn.boldreports.com/${BOLD_REPORTS_VERSION}/scripts/v2.0/common/bold.reports.common.min.js`,
      `https://cdn.boldreports.com/${BOLD_REPORTS_VERSION}/scripts/v2.0/common/bold.reports.widgets.min.js`
    ]
  },
  viewer: {
    css: [],
    js: [
      `https://cdn.boldreports.com/${BOLD_REPORTS_VERSION}/scripts/v2.0/bold.report-viewer.min.js`
    ]
  },
  designer: {
    css: [
      `https://cdn.boldreports.com/${BOLD_REPORTS_VERSION}/content/v2.0/tailwind-light/bold.report-designer.min.css`,
      "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.37.0/codemirror.min.css",
      "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.37.0/addon/hint/show-hint.min.css"
    ],
    js: [
      "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.37.0/codemirror.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.37.0/addon/hint/show-hint.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.37.0/addon/hint/sql-hint.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.37.0/mode/sql/sql.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.37.0/mode/vb/vb.min.js",
      `https://cdn.boldreports.com/${BOLD_REPORTS_VERSION}/scripts/v2.0/bold.report-viewer.min.js`,
      `https://cdn.boldreports.com/${BOLD_REPORTS_VERSION}/scripts/v2.0/bold.report-designer.min.js`
    ]
  }
};

function loadScript(url) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${url}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = url;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve();
    script.onerror = (err) => {
      console.error("Failed to load script:", url, err);
      reject(err);
    };
    document.head.appendChild(script);
  });
}

function loadStyle(url) {
  return new Promise((resolve) => {
    const existing = document.querySelector(`link[href="${url}"]`);
    if (existing) {
      resolve();
      return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    link.onload = () => resolve();
    link.onerror = () => resolve();
    document.head.appendChild(link);
  });
}

async function loadBoldReportsResources(type) {
  // Load styles
  const styles = [...RESOURCES.common.css, ...(RESOURCES[type].css || [])];
  await Promise.all(styles.map(url => loadStyle(url)));

  // Load scripts sequentially
  const scripts = [...RESOURCES.common.js, ...RESOURCES[type].js];
  for (const url of scripts) {
    await loadScript(url);
  }
}

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: Dashboard },
    { path: '/viewer', component: ReportViewer },
    { path: '/designer', component: ReportDesigner }
  ]
});

router.beforeEach(async (to, from, next) => {
  // Destroy BoldBI dashboard instance
  try {
    const instance = BoldBI.getInstance("dashboard");
    if (instance) {
      instance.destroy();
    }
  } catch (e) {
    console.warn("BoldBI destroy:", e);
  }

  // Clean up Bold Report Viewer
  const $ = window.jQuery;
  if ($ && $.fn && $.fn.boldReportViewer) {
    try {
      if ($("#viewer").data("boldReportViewer")) {
        $("#viewer").boldReportViewer("destroy");
      }
    } catch (e) {
      console.warn("ReportViewer destroy:", e);
    }
  }

  // Clean up Bold Report Designer
  if ($ && $.fn && $.fn.boldReportDesigner) {
    try {
      if ($("#designer").data("boldReportDesigner")) {
        $("#designer").boldReportDesigner("destroy");
      }
    } catch (e) {
      console.warn("ReportDesigner destroy:", e);
    }
  }

  // Clear containers
  const dashEl = document.getElementById("dashboard");
  if (dashEl) dashEl.innerHTML = "";
  const viewerEl = document.getElementById("viewer");
  if (viewerEl) viewerEl.innerHTML = "";
  const designerEl = document.getElementById("designer");
  if (designerEl) designerEl.innerHTML = "";

  // Preload Bold Reports resources before mounting component
  try {
    if (to.path === '/viewer') {
      await loadBoldReportsResources('viewer');
    } else if (to.path === '/designer') {
      await loadBoldReportsResources('designer');
    }
  } catch (error) {
    console.error("Error preloading Bold Reports resources:", error);
  }

  next();
});

export default router;
