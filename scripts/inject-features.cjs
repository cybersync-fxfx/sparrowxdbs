const fs = require("fs");

let code = fs.readFileSync("src/routes/index.tsx", "utf8");

// 1. Add component imports
const compImportMarker = 'import { AiGuardrailSandbox } from "@/components/AiGuardrailSandbox";';
if (!code.includes(compImportMarker)) {
  const target = "import {";
  const replacement = `import { AiGuardrailSandbox } from "@/components/AiGuardrailSandbox";
import { FirewallRuleExporter } from "@/components/FirewallRuleExporter";
import { IncidentTimelineView } from "@/components/IncidentTimelineView";
import { LiveWebhookDispatcherManager } from "@/components/LiveWebhookDispatcherManager";
import {`;
  code = code.replace(target, replacement);
  console.log("Component imports added");
}

// 2. Insert AiGuardrailSandbox under Web & AI Shield
const sandboxCode = `              {/* Interactive AI Guardrail Sandbox */}
              <AiGuardrailSandbox />

`;
if (!code.includes("<AiGuardrailSandbox />")) {
  const srvListTarget = "{/* Protected Services & AI Agents List */}";
  code = code.replace(srvListTarget, sandboxCode + srvListTarget);
  console.log("AiGuardrailSandbox injected");
}

// 3. Insert FirewallRuleExporter under Threat intel
const exporterCode = `              {/* Perimeter WAF & Firewall Exporter */}
              <FirewallRuleExporter indicators={threatIndicators} showToast={showToast} />

`;
if (!code.includes("<FirewallRuleExporter")) {
  const iocListTarget = '<section className="border border-border bg-card">';
  // Find the one inside Threat intel
  const threatIntelIndex = code.indexOf('{activeNav === "Threat intel" && (');
  if (threatIntelIndex !== -1) {
    const targetSub = code.slice(threatIntelIndex);
    const subReplacement = targetSub.replace(iocListTarget, exporterCode + iocListTarget);
    code = code.slice(0, threatIntelIndex) + subReplacement;
    console.log("FirewallRuleExporter injected");
  }
}

// 4. Insert LiveWebhookDispatcherManager under Integrations
const webhookCode = `              {/* Real-Time Alert Dispatchers (Slack / Discord / PagerDuty) */}
              <LiveWebhookDispatcherManager showToast={showToast} />

`;
if (!code.includes("<LiveWebhookDispatcherManager")) {
  const integrListTarget = "{/* External Telemetry Connectors List */}";
  code = code.replace(integrListTarget, webhookCode + integrListTarget);
  console.log("LiveWebhookDispatcherManager injected");
}

// 5. Insert IncidentTimelineView inside selectedIncident modal
const timelineCode = `                {/* Forensic Incident Timeline & Remediation Log */}
                <IncidentTimelineView
                  incident={selectedIncident}
                  currentOperator={primaryOperator?.name ?? "SecOps Responder"}
                  showToast={showToast}
                />
`;
if (!code.includes("<IncidentTimelineView")) {
  const timelineTarget =
    '<div className="mt-6 flex items-center justify-between border-t border-border pt-4">';
  code = code.replace(timelineTarget, timelineCode + "\n                " + timelineTarget);
  console.log("IncidentTimelineView injected");
}

// 6. Connect auto webhook dispatch on incident creation
const dispatchCall = `    // Auto-dispatch High & Critical security alerts to Slack/Discord/PagerDuty
    void dispatchIncidentWebhook(created).then((res) => {
      if (res.dispatched > 0) {
        showToast(\`Alert broadcast to \${res.dispatched} webhook channel(s)\`);
      }
    });
`;
if (!code.includes("dispatchIncidentWebhook(created)")) {
  const incCreatedTarget = "await persistIncidentToBackend(created);";
  code = code.replace(incCreatedTarget, incCreatedTarget + "\n" + dispatchCall);
  console.log("dispatchIncidentWebhook connected on create");
}

// 7. Connect timeline stage append on incident resolve / contain
const resolveTimelineCall = `    appendIncidentTimelineEvent(id, {
      stage: "Contained",
      actor: primaryOperator?.name ?? "SecOps Responder",
      summary: "Containment executed. Perimeter firewall updated and target isolated.",
    });
`;
if (!code.includes('stage: "Contained",')) {
  const resolveTarget = "showToast(`${id} marked as contained`);";
  code = code.replace(resolveTarget, resolveTimelineCall + "    " + resolveTarget);
  console.log("appendIncidentTimelineEvent connected on resolve");
}

// 8. Connect signed JWT token issuance on authentication
const jwtIssuance = `          // Issue signed cryptographic session token
          issueSignedSessionToken({
            id: createdUser.id,
            email: createdUser.email,
            fullName: createdUser.fullName,
            role: "client",
            tenantId: createdTenant?.id ?? null,
          });
`;
if (!code.includes("issueSignedSessionToken({") && code.includes("setCurrentUser(createdUser);")) {
  code = code.replace(
    "setCurrentUser(createdUser);",
    jwtIssuance + "          setCurrentUser(createdUser);",
  );
  console.log("JWT issuance added to registration");
}

const jwtLoginIssuance = `          issueSignedSessionToken({
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.admin === "yes" ? "admin" : "client",
            tenantId: user.tenantId,
          });
`;
if (
  !code.includes("issueSignedSessionToken({\n            id: user.id") &&
  code.includes("setCurrentUser(user);")
) {
  code = code.replace(
    "setCurrentUser(user);",
    jwtLoginIssuance + "          setCurrentUser(user);",
  );
  console.log("JWT issuance added to user login");
}

fs.writeFileSync("src/routes/index.tsx", code, "utf8");
console.log("index.tsx updated successfully with all advanced features!");
