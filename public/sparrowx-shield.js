/**
 * SPARROWX AUTONOMOUS CYBER DEFENSE & AI GUARDRAIL CONNECTOR
 * Version: 2.4.0
 * 
 * Simple HTML Profile Drop-In Script:
 * <script 
 *   src="https://sparrowx.net/sparrowx-shield.js" 
 *   data-spx-key="YOUR_API_KEY" 
 *   data-spx-tenant="YOUR_TENANT_ID" 
 *   data-spx-domain="yourdomain.com"
 *   async>
 * </script>
 */

(function () {
  'use strict';

  if (typeof window === 'undefined') return;
  if (window.__SPARROWX_LOADED__) return;
  window.__SPARROWX_LOADED__ = true;

  // Locate current script element to read configuration attributes
  var scriptTag =
    document.currentScript ||
    document.querySelector('script[src*="sparrowx-shield.js"]') ||
    document.querySelector('script[data-site-id]') ||
    document.querySelector('script[data-api-key]') ||
    document.querySelector('script[data-spx-key]');

  var apiKey = scriptTag
    ? scriptTag.getAttribute('data-api-key') || scriptTag.getAttribute('data-spx-key') || ''
    : '';
  var tenantId = scriptTag
    ? scriptTag.getAttribute('data-site-id') || scriptTag.getAttribute('data-spx-tenant') || ''
    : '';
  var rawDomain = scriptTag
    ? scriptTag.getAttribute('data-endpoint') || scriptTag.getAttribute('data-spx-domain') || window.location.hostname
    : window.location.hostname;
  var domain = String(rawDomain || window.location.hostname)
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '');

  var scriptOrigin = 'https://sparrowx.net';
  try {
    if (scriptTag && scriptTag.src) {
      scriptOrigin = new URL(scriptTag.src, window.location.origin).origin;
    }
  } catch (e) {
    scriptOrigin = 'https://sparrowx.net';
  }

  var apiEndpoint =
    scriptTag && scriptTag.getAttribute('data-spx-endpoint')
      ? scriptTag.getAttribute('data-spx-endpoint')
      : scriptOrigin + '/api/v1/telemetry/ingest';

  var SparrowX = {
    version: '2.4.0',
    apiKey: apiKey,
    tenantId: tenantId,
    domain: domain,
    status: 'Initializing',
    connected: false,
    handshakeLatencyMs: 0,
    blockedThreatsCount: 0,

    init: function () {
      if (!this.apiKey && !this.tenantId) {
        console.warn('[SparrowX Shield] Missing data-spx-key or data-spx-tenant. Obtain your connector key from SparrowX Settings.');
        this.status = 'Missing Credentials';
        return;
      }

      this.sendHandshake();
      this.setupClientGuards();
    },

    sendHandshake: function () {
      var self = this;
      var startTime = Date.now();

      try {
        var payload = {
          apiKey: self.apiKey,
          tenantId: self.tenantId,
          service_id: self.tenantId,
          domain: self.domain,
          source: self.domain,
          title: 'SDK Live Beacon Verified (' + self.domain + ')',
          severity: 'Low',
          status: 'Resolved',
          summary: 'Autonomous Web Shield active on ' + window.location.href,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          type: 'html_profile_connector_heartbeat'
        };

        var xhr = new XMLHttpRequest();
        xhr.open('POST', apiEndpoint, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        if (self.apiKey) {
          xhr.setRequestHeader('x-sparrowx-key', self.apiKey);
        }

        xhr.onreadystatechange = function () {
          if (xhr.readyState === 4) {
            self.handshakeLatencyMs = Date.now() - startTime;
            if (xhr.status >= 200 && xhr.status < 300) {
              self.connected = true;
              self.status = 'Active & Guarding';
              console.log('[SparrowX Shield] Autonomous Defense Active on ' + self.domain + ' (' + self.handshakeLatencyMs + 'ms)');
            } else {
              self.connected = false;
              self.status = 'Connection Failed (' + xhr.status + ')';
              console.warn('[SparrowX Shield] Ingestion Handshake Failed with status ' + xhr.status);
            }
          }
        };

        xhr.onerror = function () {
          self.connected = false;
          self.status = 'Network Error';
          console.warn('[SparrowX Shield] Unable to reach ingestion endpoint.');
        };

        xhr.send(JSON.stringify(payload));
      } catch (err) {
        self.connected = false;
        self.status = 'Error: ' + err.message;
      }
    },

    reportTelemetry: function (eventData) {
      if (!this.apiKey && !this.tenantId) return;
      try {
        var telemetryUrl = apiEndpoint.replace('/verify', '/telemetry');
        var payload = Object.assign({
          apiKey: this.apiKey,
          tenantId: this.tenantId,
          domain: this.domain,
          timestamp: new Date().toISOString(),
        }, eventData);

        if (navigator.sendBeacon) {
          navigator.sendBeacon(telemetryUrl, JSON.stringify(payload));
        }
      } catch (e) {
        // Safe fail
      }
    },

    setupClientGuards: function () {
      var self = this;

      // Guard 1: Detect XSS payloads in DOM insertions
      if (typeof MutationObserver !== 'undefined') {
        var observer = new MutationObserver(function (mutations) {
          mutations.forEach(function (m) {
            for (var i = 0; i < m.addedNodes.length; i++) {
              var node = m.addedNodes[i];
              if (node.nodeType === 1 && node.tagName === 'SCRIPT' && !node.getAttribute('data-spx-key')) {
                var content = node.innerHTML || '';
                if (/eval\(|document\.cookie|window\.location\s*=|onerror\s*=/i.test(content)) {
                  self.blockedThreatsCount++;
                  self.reportTelemetry({
                    title: 'Suspicious Client-Side Script Injection Intercepted',
                    severity: 'High',
                    summary: 'Script injection attempt detected via DOM mutation observer.'
                  });
                }
              }
            }
          });
        });

        if (document.documentElement) {
          observer.observe(document.documentElement, { childList: true, subtree: true });
        }
      }

      // Guard 2: Report unhandled security errors
      window.addEventListener('error', function (event) {
        if (event && event.message && /Content Security Policy|blocked script|CORS/i.test(event.message)) {
          self.reportTelemetry({
            title: 'Security Boundary Triggered: ' + event.message,
            severity: 'Medium',
            summary: event.filename ? 'At file ' + event.filename + ':' + event.lineno : 'Client security violation.'
          });
        }
      });
    }
  };

  // Expose global SparrowX instance
  window.SparrowX = SparrowX;

  // Auto-initialize when DOM is interactive
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      SparrowX.init();
    });
  } else {
    SparrowX.init();
  }
})();
