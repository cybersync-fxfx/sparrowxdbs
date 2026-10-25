const fs = require("fs");
let code = fs.readFileSync("src/routes/index.tsx", "utf8");

const targetImport = 'import supabaseSchemaSql from "../../supabase/schema.sql?raw";';
const newImports = `import supabaseSchemaSql from "../../supabase/schema.sql?raw";
import {
  analyzePromptInSandbox,
  dispatchIncidentWebhook,
  exportFirewallBlocklist,
  getIncidentTimeline,
  appendIncidentTimelineEvent,
  getSavedWebhooks,
  saveWebhooks,
  issueSignedSessionToken,
  verifySessionToken,
  type WebhookConfig,
  type AiGuardrailTestResult,
  type FirewallFormat,
} from "@/lib/advanced-features";`;

if (!code.includes("analyzePromptInSandbox")) {
  code = code.replace(targetImport, newImports);
  fs.writeFileSync("src/routes/index.tsx", code, "utf8");
  console.log("Imports added successfully");
} else {
  console.log("Imports already present");
}
