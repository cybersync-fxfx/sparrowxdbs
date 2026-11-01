/**
 * SparrowX Error Documentation Registry
 * -------------------------------------------------------------
 * Single source of truth for every known, typed application error.
 * The runtime feedback system (src/lib/feedback.ts), the diagnostics
 * store (src/lib/diagnostics.ts) and the public Troubleshooting &
 * Error Center (/docs/errors) all read from this registry, so the
 * message a user sees in a toast is always the same article they
 * land on in the docs.
 *
 * When adding a new failure path in the app, add its code here first.
 */

export type ErrorSeverity = "critical" | "high" | "medium" | "low";

export type ErrorCategoryId =
  | "auth"
  | "connection"
  | "dns_ssl"
  | "scanner"
  | "firewall"
  | "ai_guardrail"
  | "sdk"
  | "api_webhook"
  | "payment"
  | "credits"
  | "reports"
  | "database"
  | "network"
  | "permissions"
  | "config"
  | "unknown";

export type ErrorCategory = {
  id: ErrorCategoryId;
  order: number;
  label: string;
  description: string;
};

export const ERROR_CATEGORIES: ErrorCategory[] = [
  {
    id: "auth",
    order: 1,
    label: "Authentication & Account",
    description: "Sign in, registration, sessions and profile changes.",
  },
  {
    id: "connection",
    order: 2,
    label: "Website & Domain Connection",
    description: "Connecting a website, app or domain to SparrowX.",
  },
  {
    id: "dns_ssl",
    order: 3,
    label: "DNS & SSL/TLS",
    description: "DNS resolution, propagation and HTTPS certificates.",
  },
  {
    id: "scanner",
    order: 4,
    label: "Security Scanner",
    description: "Live domain scans and posture checks.",
  },
  {
    id: "firewall",
    order: 5,
    label: "Firewall & WAF",
    description: "Blocklists, firewall rules and rule exports.",
  },
  {
    id: "ai_guardrail",
    order: 6,
    label: "AI Guardrail",
    description: "Prompt shield, PII redaction, tool firewall and AI Brain.",
  },
  {
    id: "sdk",
    order: 7,
    label: "SDK & Integration",
    description: "SDK handshake, ingestion keys and installation checks.",
  },
  {
    id: "api_webhook",
    order: 8,
    label: "API & Webhook",
    description: "Public API requests, webhooks and integrations.",
  },
  {
    id: "payment",
    order: 9,
    label: "Payment & Billing",
    description: "Payment validation and ledger confirmation.",
  },
  {
    id: "credits",
    order: 10,
    label: "Credit & Subscription",
    description: "Credit balance, plans and protection modules.",
  },
  {
    id: "reports",
    order: 11,
    label: "Report & Compliance",
    description: "Reports, downloads, compliance evidence and badges.",
  },
  {
    id: "database",
    order: 12,
    label: "Database",
    description: "Saving, loading and deleting records in SparrowX Cloud.",
  },
  {
    id: "network",
    order: 13,
    label: "Network & Server",
    description: "Connectivity, timeouts and server availability.",
  },
  {
    id: "permissions",
    order: 14,
    label: "Permissions & Access",
    description: "Role-based access and admin-only areas.",
  },
  {
    id: "config",
    order: 15,
    label: "Configuration",
    description: "Environment configuration and input validation.",
  },
  {
    id: "unknown",
    order: 16,
    label: "Unknown & Unexpected",
    description: "Errors SparrowX did not anticipate.",
  },
];

export type ErrorDoc = {
  /** Stable machine code, e.g. DOMAIN_VERIFICATION_FAILED */
  code: ErrorCode;
  /** Stable short documentation ID, e.g. SPX-E-0201 */
  id: string;
  title: string;
  category: ErrorCategoryId;
  /** Feature or module affected */
  module: string;
  severity: ErrorSeverity;
  /** Short user-facing toast message: what happened + what it means. */
  userMessage: string;
  /** What the user can do next (one line, shown in toasts). */
  nextStep: string;
  /** "What happened" long-form explanation. */
  explanation: string;
  /** "Why it happened" – only evidence-based, plausible causes. */
  causes: string[];
  /** "How to fix" – ordered steps. */
  steps: string[];
  expectedResult: string;
  prevention: string[];
  /** Whether a retry can safely succeed without user changes. */
  retryable: boolean;
  retryInstructions: string;
  related: ErrorCode[];
  links?: Array<{ label: string; href: string }>;
  updatedAt: string;
};

const UPDATED = "2026-11-01";

// The `as const` list is the authoritative set of codes; ErrorCode is derived from it.
export const ERROR_CODES = [
  // 1. Auth
  "AUTH_INVALID_CREDENTIALS",
  "AUTH_ACCOUNT_NOT_FOUND",
  "AUTH_REGISTRATION_FAILED",
  "AUTH_SESSION_EXPIRED",
  "AUTH_PROFILE_UPDATE_FAILED",
  "AUTH_WORKSPACE_LOCKED",
  "AUTH_PASSWORD_RESET_UNAVAILABLE",
  // 2. Connection
  "WEBSITE_UNREACHABLE",
  "DOMAIN_VERIFICATION_FAILED",
  "DOMAIN_INVALID_TARGET",
  "DOMAIN_PRIVATE_IP_BLOCKED",
  // 3. DNS & TLS
  "DNS_RESOLUTION_FAILED",
  "DNS_PROPAGATION_PENDING",
  "TLS_NOT_ENABLED",
  // 4. Scanner
  "SCAN_FAILED",
  "SCAN_TIMEOUT",
  // 5. Firewall
  "FIREWALL_RULE_SAVE_FAILED",
  "FIREWALL_DEPLOY_UNCONFIRMED",
  "FIREWALL_EXPORT_FAILED",
  // 6. AI Guardrail
  "GUARDRAIL_POLICY_SAVE_FAILED",
  "AI_BRAIN_KEY_MISSING",
  "AI_BRAIN_REQUEST_FAILED",
  // 7. SDK
  "SDK_HANDSHAKE_FAILED",
  "SDK_INVALID_API_KEY",
  "SDK_KEY_ROTATION_FAILED",
  "SDK_VERIFIED_WITH_WARNINGS",
  // 8. API & Webhook
  "API_REQUEST_FAILED",
  "API_METHOD_NOT_ALLOWED",
  "API_INVALID_PAYLOAD",
  "WEBHOOK_DISPATCH_FAILED",
  "INTEGRATION_SAVE_FAILED",
  // 9. Payment
  "PAYMENT_CARD_DECLINED",
  "PAYMENT_VALIDATION_FAILED",
  "PAYMENT_LEDGER_UNCONFIRMED",
  // 10. Credits
  "CREDITS_INSUFFICIENT",
  "SUBSCRIPTION_UPDATE_FAILED",
  "MODULE_MINIMUM_REQUIRED",
  // 11. Reports
  "REPORT_GENERATION_FAILED",
  "REPORT_DOWNLOAD_FAILED",
  "BADGE_VERIFICATION_FAILED",
  // 12. Database
  "DB_WRITE_FAILED",
  "DB_READ_FAILED",
  "DB_DELETE_FAILED",
  "DB_NOT_CONFIGURED",
  "DB_SYNC_PARTIAL",
  // 13. Network
  "NETWORK_OFFLINE",
  "NETWORK_UNREACHABLE",
  "REQUEST_TIMEOUT",
  "SERVER_ERROR",
  "RATE_LIMITED",
  // 14. Permissions
  "PERMISSION_DENIED",
  "ADMIN_ONLY",
  // 15. Configuration
  "CONFIG_INVALID_INPUT",
  "CLIPBOARD_UNAVAILABLE",
  // 16. Unknown
  "UNEXPECTED_ERROR",
  "RENDER_ERROR",
  "UNHANDLED_REJECTION",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

type DocInput = Omit<ErrorDoc, "code" | "updatedAt"> & { updatedAt?: string };

const DOCS: Record<ErrorCode, DocInput> = {
  // ───────────────────────────── 1. AUTH ─────────────────────────────
  AUTH_INVALID_CREDENTIALS: {
    id: "SPX-E-0101",
    title: "Sign-in failed: incorrect password",
    category: "auth",
    module: "Authentication",
    severity: "medium",
    userMessage: "Sign-in failed. The password does not match this account.",
    nextStep: "Check your password (it is case-sensitive) and try again.",
    explanation:
      "SparrowX found an account for this email, but the password you entered did not match the stored credential. You have not been signed in.",
    causes: [
      "The password was mistyped or Caps Lock is on.",
      "The password was changed from another session.",
      "A password manager filled an outdated password.",
    ],
    steps: [
      "Re-type the password manually, checking Caps Lock.",
      "If you recently changed your password, use the new one.",
      "Retry sign-in.",
    ],
    expectedResult: "You are signed in and redirected to your Client Area or SOC Command.",
    prevention: ["Use a password manager and update it when you change passwords."],
    retryable: false,
    retryInstructions:
      "Retry only after correcting the password. Repeated failures do not unlock the account.",
    related: ["AUTH_ACCOUNT_NOT_FOUND", "AUTH_PASSWORD_RESET_UNAVAILABLE"],
  },
  AUTH_ACCOUNT_NOT_FOUND: {
    id: "SPX-E-0102",
    title: "No account exists for this email",
    category: "auth",
    module: "Authentication",
    severity: "low",
    userMessage: "No SparrowX account was found for this email address.",
    nextStep: "Check the email address, or create a new account.",
    explanation:
      "The email address you entered is not registered in SparrowX. Nothing has been created or changed.",
    causes: [
      "The email address contains a typo.",
      "You registered with a different work email.",
      "The account was removed by an administrator.",
    ],
    steps: [
      "Verify the spelling of your email address.",
      "Try any other work email you may have used.",
      "If you are new, choose “Create account” to onboard your organization.",
    ],
    expectedResult: "You sign in with the correct email, or a new account is created.",
    prevention: ["Use a single work email for your SparrowX workspace."],
    retryable: false,
    retryInstructions: "Retry with a corrected email address.",
    related: ["AUTH_INVALID_CREDENTIALS", "AUTH_REGISTRATION_FAILED"],
  },
  AUTH_REGISTRATION_FAILED: {
    id: "SPX-E-0103",
    title: "Account registration could not be saved",
    category: "auth",
    module: "Registration & Onboarding",
    severity: "high",
    userMessage:
      "Your account could not be created. SparrowX Cloud did not confirm the registration.",
    nextStep: "Check your connection and submit the registration form again.",
    explanation:
      "The registration request was sent, but SparrowX Cloud did not confirm that your user record was saved. To avoid creating a half-registered account, you have not been signed in.",
    causes: [
      "The network connection dropped during submission.",
      "SparrowX Cloud (database) was temporarily unavailable.",
      "The database rejected the record (for example a duplicate ID).",
    ],
    steps: [
      "Confirm you are online.",
      "Open System Status to check that Database and Authentication are Operational.",
      "Submit the registration form again.",
      "If it fails again, report the problem with the reference ID shown.",
    ],
    expectedResult: "“Account created” confirmation and you land in your Client Area.",
    prevention: ["Avoid submitting forms on unstable connections."],
    retryable: true,
    retryInstructions:
      "Safe to retry — registration uses an upsert, so retrying will not create duplicate accounts.",
    related: ["DB_WRITE_FAILED", "NETWORK_UNREACHABLE"],
  },
  AUTH_SESSION_EXPIRED: {
    id: "SPX-E-0104",
    title: "Session expired or invalid",
    category: "auth",
    module: "Sessions",
    severity: "medium",
    userMessage: "Your session has expired. Please sign in again.",
    nextStep: "Sign in again to continue.",
    explanation:
      "Your signed session token is missing, expired or failed its integrity check, so SparrowX cannot confirm who you are.",
    causes: [
      "The session reached its expiry time.",
      "Browser storage was cleared.",
      "The token was modified or copied from another browser.",
    ],
    steps: ["Sign in again with your email and password."],
    expectedResult: "A fresh session is issued and you return to your dashboard.",
    prevention: ["Do not clear site data while signed in."],
    retryable: false,
    retryInstructions: "Sign in again rather than retrying the failed action.",
    related: ["AUTH_INVALID_CREDENTIALS", "PERMISSION_DENIED"],
  },
  AUTH_PROFILE_UPDATE_FAILED: {
    id: "SPX-E-0105",
    title: "Profile changes were not saved",
    category: "auth",
    module: "Profile Management",
    severity: "medium",
    userMessage: "We couldn't save your profile changes. Your previous profile has been preserved.",
    nextStep: "Retry, or check System Status if this keeps happening.",
    explanation:
      "SparrowX Cloud did not confirm the profile update, so your name, email and password remain unchanged.",
    causes: [
      "Network interruption while saving.",
      "Database temporarily unavailable.",
      "The new email address conflicts with another account.",
    ],
    steps: [
      "Check your connection.",
      "Retry the update.",
      "If you changed your email, make sure no other account already uses it.",
    ],
    expectedResult: "“Account profile updated” confirmation.",
    prevention: ["Change one field at a time when troubleshooting."],
    retryable: true,
    retryInstructions: "Safe to retry — the update is idempotent.",
    related: ["DB_WRITE_FAILED"],
  },
  AUTH_WORKSPACE_LOCKED: {
    id: "SPX-E-0106",
    title: "Workspace is in emergency lockdown",
    category: "auth",
    module: "Authentication",
    severity: "high",
    userMessage: "Access denied: this workspace is under emergency lockdown.",
    nextStep: "Contact your SparrowX administrator to lift the lockdown.",
    explanation:
      "A SparrowX administrator triggered the tenant kill-switch for this workspace. Client sign-in is blocked until the lockdown is lifted.",
    causes: ["An administrator activated lockdown in response to a security incident."],
    steps: [
      "Contact your SparrowX security contact or administrator.",
      "Once the lockdown is lifted, sign in again.",
    ],
    expectedResult: "Sign-in succeeds after the workspace returns to Active.",
    prevention: ["Keep your administrator contact details up to date."],
    retryable: false,
    retryInstructions: "Retrying will not help until an administrator restores the workspace.",
    related: ["PERMISSION_DENIED"],
  },
  AUTH_PASSWORD_RESET_UNAVAILABLE: {
    id: "SPX-E-0107",
    title: "Self-service password reset is not available",
    category: "auth",
    module: "Authentication",
    severity: "low",
    userMessage: "Self-service password reset is not available yet.",
    nextStep: "Contact SparrowX support to verify your identity and reset your password.",
    explanation:
      "SparrowX does not currently offer an automated password-reset email flow. Resets are performed by support after identity verification.",
    causes: ["Feature not yet enabled for this deployment."],
    steps: [
      "Use the contact form on the SparrowX landing page.",
      "Include your account email (never your password).",
      "Support will verify ownership and reset the credential.",
    ],
    expectedResult: "Support confirms the reset and you sign in with a new password.",
    prevention: ["Store your password in a password manager."],
    retryable: false,
    retryInstructions: "Not applicable.",
    related: ["AUTH_INVALID_CREDENTIALS"],
  },

  // ─────────────────────────── 2. CONNECTION ───────────────────────────
  WEBSITE_UNREACHABLE: {
    id: "SPX-E-0201",
    title: "Website could not be reached",
    category: "connection",
    module: "Website / API Connection",
    severity: "high",
    userMessage: "Website connection failed. SparrowX could not reach your site over HTTPS.",
    nextStep: "Confirm the site is online and the domain is correct, then retry verification.",
    explanation:
      "SparrowX tried to open an HTTPS connection to your domain and did not get a response within the time limit. Protection has NOT been marked as active.",
    causes: [
      "The website is offline or still deploying.",
      "The domain has a typo or points to the wrong host.",
      "A firewall or geo-block is rejecting connections.",
      "DNS records do not resolve yet.",
    ],
    steps: [
      "Open your website in a new browser tab to confirm it loads.",
      "Check the domain saved in SparrowX matches exactly (no typos).",
      "If you use a firewall/CDN, allow HTTPS traffic from the public internet.",
      "Return to SparrowX and click “Re-Verify Live Connection”.",
    ],
    expectedResult: "“Connection verified … Protection Active” confirmation with a measured RTT.",
    prevention: ["Verify only after your production deployment completes."],
    retryable: true,
    retryInstructions: "Retry after confirming the site loads in your browser.",
    related: ["DNS_RESOLUTION_FAILED", "TLS_NOT_ENABLED", "DOMAIN_VERIFICATION_FAILED"],
  },
  DOMAIN_VERIFICATION_FAILED: {
    id: "SPX-E-0202",
    title: "Domain ownership could not be verified",
    category: "connection",
    module: "Domain Verification",
    severity: "high",
    userMessage: "Domain verification failed. SparrowX could not find your verification record.",
    nextStep:
      "Add the exact TXT record provided by SparrowX, wait for DNS propagation, then retry.",
    explanation:
      "SparrowX could not verify ownership of the domain because the expected verification token was not found.",
    causes: [
      "Missing DNS verification record.",
      "Incorrect TXT record value (extra quotes or spaces).",
      "DNS propagation is incomplete.",
      "The record was added to the wrong (sub)domain.",
    ],
    steps: [
      "Open your DNS provider.",
      "Locate your domain's DNS records.",
      "Add the exact TXT record provided by SparrowX.",
      "Save the configuration.",
      "Return to SparrowX.",
      "Retry domain verification.",
    ],
    expectedResult: "“Domain verified successfully.”",
    prevention: [
      "Copy the token with the copy button instead of typing it.",
      "Keep the TXT record in place after verification.",
    ],
    retryable: true,
    retryInstructions:
      "Retry after the record is visible publicly (propagation can take up to 1 hour, rarely 48 hours).",
    related: ["DNS_PROPAGATION_PENDING", "DNS_RESOLUTION_FAILED"],
  },
  DOMAIN_INVALID_TARGET: {
    id: "SPX-E-0203",
    title: "Invalid domain or URL",
    category: "connection",
    module: "Website / API Connection",
    severity: "low",
    userMessage: "That domain or URL is not valid for scanning or connection.",
    nextStep: "Enter a public domain like example.com (without paths or credentials).",
    explanation:
      "The value entered is not a valid, public hostname, so SparrowX did not start any network activity.",
    causes: [
      "The value includes spaces, credentials or an unsupported scheme.",
      "The value is an IP address or internal hostname.",
      "The domain is empty.",
    ],
    steps: [
      "Enter only the hostname, e.g. app.example.com.",
      "Remove any paths, ports or query strings.",
      "Submit again.",
    ],
    expectedResult: "The scan or connection starts normally.",
    prevention: ["Copy the domain from your browser's address bar."],
    retryable: false,
    retryInstructions: "Correct the input before retrying.",
    related: ["DOMAIN_PRIVATE_IP_BLOCKED", "CONFIG_INVALID_INPUT"],
  },
  DOMAIN_PRIVATE_IP_BLOCKED: {
    id: "SPX-E-0204",
    title: "Target resolves to a private or internal IP",
    category: "connection",
    module: "Security Scanner",
    severity: "medium",
    userMessage: "Scan blocked: the domain resolves to a private or internal IP address.",
    nextStep: "Use a publicly reachable domain. Internal hosts cannot be scanned.",
    explanation:
      "SparrowX's SSRF / DNS-rebinding protection stopped the request because the domain resolved to a loopback, private or cloud-metadata address.",
    causes: [
      "The domain points to an internal network.",
      "Split-horizon DNS returns an internal address.",
      "A DNS-rebinding attempt.",
    ],
    steps: [
      "Confirm the domain's public A/AAAA records point to a public IP.",
      "Retry with the public hostname.",
    ],
    expectedResult: "The scan runs against the public endpoint.",
    prevention: ["Do not register internal-only hostnames as protected targets."],
    retryable: false,
    retryInstructions: "Retry only after the DNS records point to a public IP.",
    related: ["DOMAIN_INVALID_TARGET"],
  },

  // ─────────────────────────── 3. DNS & TLS ───────────────────────────
  DNS_RESOLUTION_FAILED: {
    id: "SPX-E-0301",
    title: "DNS records could not be resolved",
    category: "dns_ssl",
    module: "DNS",
    severity: "high",
    userMessage: "DNS lookup failed. The domain has no reachable A/AAAA records.",
    nextStep: "Check your DNS provider has A or AAAA records for this domain.",
    explanation:
      "Public DNS (DNS-over-HTTPS) returned no address records for the domain, so it cannot be reached.",
    causes: [
      "The domain is not registered or has expired.",
      "A/AAAA records are missing.",
      "The DNS-over-HTTPS resolver was unreachable from your network.",
    ],
    steps: [
      "Check the domain registration is active.",
      "Add an A (IPv4) or AAAA (IPv6) record pointing to your server.",
      "Wait a few minutes and retry.",
    ],
    expectedResult: "The domain resolves and the connection check continues.",
    prevention: ["Enable auto-renew on your domain registration."],
    retryable: true,
    retryInstructions: "Retry after DNS changes have propagated.",
    related: ["DNS_PROPAGATION_PENDING", "WEBSITE_UNREACHABLE"],
  },
  DNS_PROPAGATION_PENDING: {
    id: "SPX-E-0302",
    title: "DNS changes have not propagated yet",
    category: "dns_ssl",
    module: "DNS",
    severity: "low",
    userMessage: "Your DNS change is not visible publicly yet.",
    nextStep: "Wait for propagation (usually minutes, up to 48 hours) and retry.",
    explanation:
      "Recently added DNS records can take time to reach public resolvers. SparrowX checks public DNS, so it may not see the change immediately.",
    causes: ["The record was added recently.", "A high TTL on the previous record."],
    steps: ["Wait 10–60 minutes.", "Retry verification."],
    expectedResult: "The record is found and verification succeeds.",
    prevention: ["Lower TTLs before planned DNS changes."],
    retryable: true,
    retryInstructions: "Retry periodically; there is no penalty for retrying.",
    related: ["DOMAIN_VERIFICATION_FAILED"],
  },
  TLS_NOT_ENABLED: {
    id: "SPX-E-0303",
    title: "Endpoint does not use HTTPS",
    category: "dns_ssl",
    module: "SSL/TLS",
    severity: "medium",
    userMessage: "Connected, but the endpoint uses unencrypted HTTP.",
    nextStep: "Enable HTTPS on your endpoint and update the URL in SparrowX.",
    explanation:
      "The connection works, but traffic is not encrypted. Production protection should run over TLS.",
    causes: ["The endpoint URL starts with http://.", "No TLS certificate is installed."],
    steps: [
      "Install a TLS certificate (e.g. Let's Encrypt or your CDN).",
      "Change the endpoint URL to https://.",
      "Re-run the diagnostic.",
    ],
    expectedResult: "TLS / SSL Verification shows success.",
    prevention: ["Enable HSTS once HTTPS works."],
    retryable: false,
    retryInstructions: "Retry after HTTPS is enabled.",
    related: ["WEBSITE_UNREACHABLE", "SDK_VERIFIED_WITH_WARNINGS"],
  },

  // ─────────────────────────── 4. SCANNER ───────────────────────────
  SCAN_FAILED: {
    id: "SPX-E-0401",
    title: "Security scan could not complete",
    category: "scanner",
    module: "Security Scanner",
    severity: "medium",
    userMessage: "The security scan failed before producing results.",
    nextStep: "Check the domain is valid and public, then rescan.",
    explanation:
      "The scan stopped because a required step (DNS lookup, HTTPS probe) could not run. No partial results were saved as a passing score.",
    causes: [
      "Invalid or private target.",
      "Network blocked requests to public DNS.",
      "The target refused the connection.",
    ],
    steps: [
      "Confirm the domain is public and correctly spelled.",
      "Check you are online.",
      "Run the scan again.",
    ],
    expectedResult: "A full scan report with findings.",
    prevention: ["Scan production domains rather than staging hosts behind VPNs."],
    retryable: true,
    retryInstructions: "Safe to retry — scans are read-only.",
    related: ["SCAN_TIMEOUT", "DOMAIN_INVALID_TARGET"],
  },
  SCAN_TIMEOUT: {
    id: "SPX-E-0402",
    title: "Security scan timed out",
    category: "scanner",
    module: "Security Scanner",
    severity: "low",
    userMessage: "The scan took too long and was stopped.",
    nextStep: "Retry the scan. If the site is slow, try again later.",
    explanation:
      "The target did not respond within SparrowX's time limit. Slow targets are reported as unreachable rather than passing.",
    causes: ["The target server is slow or overloaded.", "Your connection is slow."],
    steps: ["Retry the scan.", "Check your site's response time in a browser."],
    expectedResult: "The scan completes within the time limit.",
    prevention: ["Use a CDN to improve response time."],
    retryable: true,
    retryInstructions: "Safe to retry.",
    related: ["REQUEST_TIMEOUT", "SCAN_FAILED"],
  },

  // ─────────────────────────── 5. FIREWALL ───────────────────────────
  FIREWALL_RULE_SAVE_FAILED: {
    id: "SPX-E-0501",
    title: "Firewall rule was not saved",
    category: "firewall",
    module: "Firewall & IOC Blocklist",
    severity: "high",
    userMessage: "Firewall rule change failed. Your new rule has not been confirmed as active.",
    nextStep: "Retry. The previous blocklist state has been restored.",
    explanation:
      "SparrowX Cloud did not confirm the blocklist change, so the indicator's block status was reverted to avoid showing protection that isn't in effect.",
    causes: [
      "Database temporarily unavailable.",
      "Network interruption.",
      "Insufficient permissions.",
    ],
    steps: [
      "Check System Status for Firewall Services.",
      "Retry the action.",
      "If it repeats, report the problem with the reference ID.",
    ],
    expectedResult: "“… blocked at edge firewall” confirmation.",
    prevention: ["Avoid bulk changes during reported outages."],
    retryable: true,
    retryInstructions: "Safe to retry — the save is idempotent.",
    related: ["FIREWALL_DEPLOY_UNCONFIRMED", "DB_WRITE_FAILED"],
  },
  FIREWALL_DEPLOY_UNCONFIRMED: {
    id: "SPX-E-0502",
    title: "Firewall deployment not confirmed",
    category: "firewall",
    module: "Firewall Deployment",
    severity: "critical",
    userMessage: "Firewall deployment failed. Your new rules have not been confirmed as active.",
    nextStep: "Retry the deployment and check System Status.",
    explanation:
      "One or more rules in a bulk enforcement did not save. SparrowX reports exactly how many succeeded and failed.",
    causes: ["Partial database outage.", "Network interruption during a bulk operation."],
    steps: [
      "Review the count of failed rules in the message.",
      "Retry the enforcement.",
      "Verify affected indicators show “Blocked”.",
    ],
    expectedResult: "All rules confirmed as active.",
    prevention: ["Run bulk enforcement when System Status is Operational."],
    retryable: true,
    retryInstructions: "Safe to retry — already-applied rules are not duplicated.",
    related: ["FIREWALL_RULE_SAVE_FAILED"],
  },
  FIREWALL_EXPORT_FAILED: {
    id: "SPX-E-0503",
    title: "Firewall rule export failed",
    category: "firewall",
    module: "Firewall Rule Exporter",
    severity: "low",
    userMessage: "The firewall rule file could not be generated or downloaded.",
    nextStep: "Make sure at least one indicator is blocked and that downloads are allowed.",
    explanation: "The export could not be produced, or your browser blocked the download.",
    causes: [
      "No blocked indicators to export.",
      "Browser blocked automatic downloads.",
      "Clipboard access denied when copying.",
    ],
    steps: [
      "Block at least one indicator.",
      "Allow downloads for this site in browser settings.",
      "Export again.",
    ],
    expectedResult: "A rules file downloads in the selected format.",
    prevention: ["Allow downloads from SparrowX."],
    retryable: true,
    retryInstructions: "Safe to retry.",
    related: ["CLIPBOARD_UNAVAILABLE", "REPORT_DOWNLOAD_FAILED"],
  },

  // ─────────────────────────── 6. AI GUARDRAIL ───────────────────────────
  GUARDRAIL_POLICY_SAVE_FAILED: {
    id: "SPX-E-0601",
    title: "AI guardrail policy was not saved",
    category: "ai_guardrail",
    module: "AI Guardrail Configuration",
    severity: "high",
    userMessage:
      "AI guardrail change failed. Your previous guardrail settings are still in effect.",
    nextStep: "Retry the change.",
    explanation:
      "SparrowX Cloud did not confirm the guardrail/policy update (prompt shield, PII redaction, tool firewall or protection mode), so the previous configuration was restored.",
    causes: ["Database temporarily unavailable.", "Network interruption."],
    steps: ["Retry the toggle.", "Check System Status for AI Guardrail."],
    expectedResult: "“Updated service guardrail policy” confirmation.",
    prevention: ["Change one setting at a time."],
    retryable: true,
    retryInstructions: "Safe to retry.",
    related: ["DB_WRITE_FAILED"],
  },
  AI_BRAIN_KEY_MISSING: {
    id: "SPX-E-0602",
    title: "Gemini API key not configured",
    category: "ai_guardrail",
    module: "Gemini AI Brain",
    severity: "medium",
    userMessage: "AI Brain is not configured: no Gemini API key is set.",
    nextStep: "Add your Gemini API key in the AI Brain settings.",
    explanation: "AI Brain features need a Gemini API key. Without it, AI analysis cannot run.",
    causes: ["No key has been entered.", "The key was cleared from browser storage."],
    steps: [
      "Open Gemini AI Brain.",
      "Enter your API key in the vault field.",
      "Save, then retry the analysis.",
    ],
    expectedResult: "AI analysis runs and returns results.",
    prevention: ["Use a key restricted to the Gemini API."],
    retryable: false,
    retryInstructions: "Retry after adding a key.",
    related: ["AI_BRAIN_REQUEST_FAILED"],
  },
  AI_BRAIN_REQUEST_FAILED: {
    id: "SPX-E-0603",
    title: "AI Brain request failed",
    category: "ai_guardrail",
    module: "Gemini AI Brain",
    severity: "medium",
    userMessage: "The AI analysis request failed. No AI-generated rules were applied.",
    nextStep: "Check your API key and quota, then retry.",
    explanation: "The request to the AI model did not return a usable response.",
    causes: [
      "Invalid or revoked API key.",
      "Quota or rate limit exceeded.",
      "Network interruption.",
    ],
    steps: ["Verify your API key is valid.", "Check your quota in Google AI Studio.", "Retry."],
    expectedResult: "AI analysis completes.",
    prevention: ["Monitor API quota."],
    retryable: true,
    retryInstructions: "Retry after a short wait if rate limited.",
    related: ["AI_BRAIN_KEY_MISSING", "RATE_LIMITED"],
  },

  // ─────────────────────────── 7. SDK ───────────────────────────
  SDK_HANDSHAKE_FAILED: {
    id: "SPX-E-0701",
    title: "SDK handshake failed",
    category: "sdk",
    module: "SDK Installation Verification",
    severity: "high",
    userMessage: "SDK initialization failed. The API configuration could not be validated.",
    nextStep:
      "Review your integration settings and confirm the SPARROWX_API_KEY is set, then retry.",
    explanation:
      "SparrowX's verification endpoint did not confirm the handshake for this service, so the SDK has NOT been marked as verified.",
    causes: [
      "The ingestion key is missing, mistyped or rotated.",
      "The SparrowX verification API was unreachable.",
      "The service record has not been saved to SparrowX Cloud yet.",
    ],
    steps: [
      "Copy the current API key from the service's SDK panel.",
      "Set it as SPARROWX_API_KEY in your app's environment.",
      "Redeploy your app.",
      "Re-run the diagnostic.",
    ],
    expectedResult: "“SDK verified … live telemetry connected.”",
    prevention: ["Update environment variables immediately after rotating keys."],
    retryable: true,
    retryInstructions: "Safe to retry — verification is read-only.",
    related: ["SDK_INVALID_API_KEY", "API_REQUEST_FAILED"],
  },
  SDK_INVALID_API_KEY: {
    id: "SPX-E-0702",
    title: "Invalid or unknown ingestion key",
    category: "sdk",
    module: "SDK & API Keys",
    severity: "high",
    userMessage: "The SparrowX ingestion key was rejected.",
    nextStep: "Use the current key shown in your service's SDK panel.",
    explanation:
      "The key does not match any active service or tenant. It may have been rotated or mistyped.",
    causes: [
      "The key was rotated and the old key is still deployed.",
      "The key was truncated when copied.",
      "The key belongs to a deleted service.",
    ],
    steps: [
      "Open the service's SDK panel and copy the key with the copy button.",
      "Update SPARROWX_API_KEY in your deployment.",
      "Retry verification.",
    ],
    expectedResult: "The handshake returns verified.",
    prevention: ["Never hardcode keys in source; use environment variables."],
    retryable: false,
    retryInstructions: "Retry after updating the key.",
    related: ["SDK_HANDSHAKE_FAILED", "SDK_KEY_ROTATION_FAILED"],
  },
  SDK_KEY_ROTATION_FAILED: {
    id: "SPX-E-0703",
    title: "API key rotation failed",
    category: "sdk",
    module: "API Key Management",
    severity: "high",
    userMessage: "API key rotation failed. Your existing key remains active.",
    nextStep: "Retry the rotation. Do not update your deployment until it succeeds.",
    explanation:
      "SparrowX Cloud did not confirm the new key, so the previous key was kept to avoid breaking your integration.",
    causes: ["Database temporarily unavailable.", "Network interruption."],
    steps: [
      "Keep the current key deployed.",
      "Retry the rotation.",
      "After success, update SPARROWX_API_KEY in your deployment.",
    ],
    expectedResult: "“Rotated API key …” confirmation.",
    prevention: ["Rotate keys during low-traffic windows."],
    retryable: true,
    retryInstructions: "Safe to retry.",
    related: ["SDK_INVALID_API_KEY", "DB_WRITE_FAILED"],
  },
  SDK_VERIFIED_WITH_WARNINGS: {
    id: "SPX-E-0704",
    title: "Connected with warnings",
    category: "sdk",
    module: "SDK Installation Verification",
    severity: "low",
    userMessage: "Connected, but some checks need attention.",
    nextStep: "Review the warning steps in the diagnostic report.",
    explanation:
      "The handshake succeeded, but at least one recommended check (such as HTTPS) did not pass.",
    causes: [
      "Endpoint uses HTTP instead of HTTPS.",
      "Endpoint reachability could not be confirmed from the browser.",
    ],
    steps: [
      "Open the diagnostic report.",
      "Fix each step marked as warning.",
      "Re-run the diagnostic.",
    ],
    expectedResult: "All diagnostic steps show success.",
    prevention: ["Use HTTPS endpoints in production."],
    retryable: false,
    retryInstructions: "Re-run after resolving warnings.",
    related: ["TLS_NOT_ENABLED"],
  },

  // ─────────────────────────── 8. API & WEBHOOK ───────────────────────────
  API_REQUEST_FAILED: {
    id: "SPX-E-0801",
    title: "SparrowX API request failed",
    category: "api_webhook",
    module: "Public API",
    severity: "medium",
    userMessage: "Unable to communicate with the security service.",
    nextStep: "Check your connection and retry.",
    explanation: "A request to a SparrowX API endpoint failed or returned an unexpected response.",
    causes: [
      "The API is temporarily unavailable.",
      "Network interruption.",
      "The request was rejected by validation.",
    ],
    steps: ["Check System Status for API Services.", "Retry the action."],
    expectedResult: "The action completes with a confirmation.",
    prevention: ["Implement retries with backoff in SDK clients."],
    retryable: true,
    retryInstructions: "Retry with backoff (1s, 2s, 4s).",
    related: ["SERVER_ERROR", "NETWORK_UNREACHABLE"],
  },
  API_METHOD_NOT_ALLOWED: {
    id: "SPX-E-0802",
    title: "HTTP method not allowed",
    category: "api_webhook",
    module: "Public API",
    severity: "low",
    userMessage: "This API endpoint does not accept that HTTP method.",
    nextStep: "Use POST for /api/v1/verify, /api/v1/telemetry and /api/v1/diagnostics.",
    explanation: "The endpoint received a request with an unsupported HTTP method (HTTP 405).",
    causes: ["Using GET instead of POST in your integration code."],
    steps: [
      "Change the request method to POST.",
      "Send a JSON body with Content-Type: application/json.",
    ],
    expectedResult: "The endpoint returns 200/202.",
    prevention: ["Use the generated SDK snippets."],
    retryable: false,
    retryInstructions: "Fix the request method before retrying.",
    related: ["API_INVALID_PAYLOAD"],
  },
  API_INVALID_PAYLOAD: {
    id: "SPX-E-0803",
    title: "Invalid request payload",
    category: "api_webhook",
    module: "Public API",
    severity: "low",
    userMessage: "The request body is not valid JSON or is missing required fields.",
    nextStep: "Send a valid JSON body with Content-Type: application/json.",
    explanation: "SparrowX could not parse the request body (HTTP 400). Nothing was ingested.",
    causes: ["Malformed JSON.", "Missing Content-Type header.", "Payload exceeds size limits."],
    steps: [
      "Validate the JSON payload.",
      "Set Content-Type: application/json.",
      "Retry the request.",
    ],
    expectedResult: "HTTP 200 with status “ingested”.",
    prevention: ["Serialize payloads with JSON.stringify."],
    retryable: false,
    retryInstructions: "Fix the payload before retrying.",
    related: ["API_METHOD_NOT_ALLOWED"],
  },
  WEBHOOK_DISPATCH_FAILED: {
    id: "SPX-E-0804",
    title: "Webhook alert could not be delivered",
    category: "api_webhook",
    module: "Webhooks",
    severity: "medium",
    userMessage: "One or more webhook alerts could not be sent.",
    nextStep: "Check the webhook URL and that the receiving service is online.",
    explanation:
      "SparrowX attempted to POST an alert to your webhook channel, but the request failed at the network level.",
    causes: [
      "The webhook URL is wrong or revoked.",
      "The receiving service (Slack, Discord, PagerDuty) is down.",
      "Network interruption.",
    ],
    steps: [
      "Open Integrations & Webhooks.",
      "Verify the webhook URL.",
      "Re-enable the channel and send a test alert.",
    ],
    expectedResult: "“Alert broadcast to N webhook channel(s).”",
    prevention: ["Rotate webhook URLs in SparrowX when you regenerate them upstream."],
    retryable: true,
    retryInstructions: "Retry after confirming the URL.",
    related: ["INTEGRATION_SAVE_FAILED"],
  },
  INTEGRATION_SAVE_FAILED: {
    id: "SPX-E-0805",
    title: "Integration change was not saved",
    category: "api_webhook",
    module: "Integrations",
    severity: "medium",
    userMessage: "We couldn't save the integration change. The previous state has been restored.",
    nextStep: "Retry the change.",
    explanation: "SparrowX Cloud did not confirm the integration update.",
    causes: ["Database temporarily unavailable.", "Network interruption."],
    steps: ["Retry.", "Check System Status."],
    expectedResult: "Confirmation that the integration was connected/paused/removed.",
    prevention: [],
    retryable: true,
    retryInstructions: "Safe to retry.",
    related: ["DB_WRITE_FAILED"],
  },

  // ─────────────────────────── 9. PAYMENT ───────────────────────────
  PAYMENT_CARD_DECLINED: {
    id: "SPX-E-0901",
    title: "Card payment declined",
    category: "payment",
    module: "Payment Gateway",
    severity: "high",
    userMessage: "Your payment could not be verified. Your credits have not been activated.",
    nextStep: "Check your card details, or use a different payment method.",
    explanation:
      "The card failed validation or authorization. No credits were added and no charge was confirmed.",
    causes: [
      "Card number failed checksum validation.",
      "Card expired.",
      "Issuer declined the transaction.",
    ],
    steps: [
      "Re-enter the card number carefully.",
      "Confirm the expiry date (MM/YY) and CVV.",
      "Try another payment method if the issuer declines.",
    ],
    expectedResult: "“Payment succeeded” with a receipt number.",
    prevention: ["Keep card details up to date."],
    retryable: false,
    retryInstructions:
      "Payments are never retried automatically. Check your payment status before trying again to avoid duplicate charges.",
    related: ["PAYMENT_VALIDATION_FAILED", "PAYMENT_LEDGER_UNCONFIRMED"],
  },
  PAYMENT_VALIDATION_FAILED: {
    id: "SPX-E-0902",
    title: "Payment details are incomplete or invalid",
    category: "payment",
    module: "Payment Gateway",
    severity: "low",
    userMessage: "Payment details are invalid. No payment was attempted.",
    nextStep: "Correct the highlighted field and submit again.",
    explanation:
      "A field (expiry, CVV or UPI reference) failed validation, so the payment was not submitted.",
    causes: [
      "Expiry in the wrong format.",
      "CVV too short.",
      "UPI UTR reference has the wrong length.",
    ],
    steps: ["Fix the field described in the error.", "Submit again."],
    expectedResult: "The payment proceeds to verification.",
    prevention: [],
    retryable: false,
    retryInstructions: "Correct the details before retrying.",
    related: ["PAYMENT_CARD_DECLINED"],
  },
  PAYMENT_LEDGER_UNCONFIRMED: {
    id: "SPX-E-0903",
    title: "Payment ledger entry not confirmed",
    category: "payment",
    module: "Billing Ledger",
    severity: "critical",
    userMessage: "Your payment record could not be confirmed by the SparrowX ledger.",
    nextStep:
      "Do not pay again. Check Billing & Credits history, then contact support with the reference ID.",
    explanation:
      "The transaction was recorded on this device, but SparrowX Cloud did not confirm the ledger entry.",
    causes: ["Database temporarily unavailable.", "Network interruption after payment."],
    steps: [
      "Do NOT submit another payment.",
      "Open Billing & Credits and check the transaction history.",
      "Contact support with the reference ID and receipt number.",
    ],
    expectedResult: "Support confirms the ledger entry.",
    prevention: ["Keep the receipt number from every payment."],
    retryable: false,
    retryInstructions: "Never retry payments automatically — this could cause a duplicate charge.",
    related: ["PAYMENT_CARD_DECLINED", "DB_WRITE_FAILED"],
  },

  // ─────────────────────────── 10. CREDITS ───────────────────────────
  CREDITS_INSUFFICIENT: {
    id: "SPX-E-1001",
    title: "Insufficient credits",
    category: "credits",
    module: "Credits",
    severity: "medium",
    userMessage: "Not enough credits to complete this action.",
    nextStep: "Top up credits in Billing & Credits.",
    explanation: "This action costs more credits than your current balance. Nothing was deducted.",
    causes: ["Balance is lower than the action cost."],
    steps: ["Open Billing & Credits.", "Purchase a credit package.", "Retry the action."],
    expectedResult: "The action completes and credits are deducted.",
    prevention: ["Monitor your balance."],
    retryable: false,
    retryInstructions: "Retry after topping up.",
    related: ["SUBSCRIPTION_UPDATE_FAILED"],
  },
  SUBSCRIPTION_UPDATE_FAILED: {
    id: "SPX-E-1002",
    title: "Subscription or service change not saved",
    category: "credits",
    module: "Subscriptions & Modules",
    severity: "medium",
    userMessage:
      "We couldn't save your subscription change. Your previous plan and modules are unchanged.",
    nextStep: "Retry the change.",
    explanation:
      "SparrowX Cloud did not confirm the plan, module or service update, so the previous configuration was restored.",
    causes: ["Database temporarily unavailable.", "Network interruption."],
    steps: ["Retry.", "Check System Status if it fails again."],
    expectedResult: "Confirmation that the module/plan was updated.",
    prevention: [],
    retryable: true,
    retryInstructions: "Safe to retry.",
    related: ["DB_WRITE_FAILED", "MODULE_MINIMUM_REQUIRED"],
  },
  MODULE_MINIMUM_REQUIRED: {
    id: "SPX-E-1003",
    title: "At least one protection module is required",
    category: "credits",
    module: "Subscriptions & Modules",
    severity: "low",
    userMessage: "At least one protection module must remain active.",
    nextStep: "Enable another module before disabling this one.",
    explanation:
      "A service with no modules would have no protection, so SparrowX blocked the change.",
    causes: ["Attempted to disable the last enabled module."],
    steps: ["Enable the module you want to keep.", "Then disable the other one."],
    expectedResult: "Module change confirmed.",
    prevention: [],
    retryable: false,
    retryInstructions: "Not applicable.",
    related: ["SUBSCRIPTION_UPDATE_FAILED"],
  },

  // ─────────────────────────── 11. REPORTS ───────────────────────────
  REPORT_GENERATION_FAILED: {
    id: "SPX-E-1101",
    title: "Report could not be saved",
    category: "reports",
    module: "Reports & Compliance",
    severity: "medium",
    userMessage: "The report was not saved to SparrowX Cloud.",
    nextStep: "Retry report generation.",
    explanation:
      "The report was generated but SparrowX Cloud did not confirm it was saved, so it was removed from the list.",
    causes: ["Database temporarily unavailable.", "Network interruption."],
    steps: ["Retry.", "Check System Status."],
    expectedResult: "“… report generated and saved.”",
    prevention: [],
    retryable: true,
    retryInstructions: "Safe to retry.",
    related: ["DB_WRITE_FAILED", "REPORT_DOWNLOAD_FAILED"],
  },
  REPORT_DOWNLOAD_FAILED: {
    id: "SPX-E-1102",
    title: "Report download failed",
    category: "reports",
    module: "Reports & Data Export",
    severity: "low",
    userMessage: "The file could not be downloaded.",
    nextStep: "Allow downloads for this site and try again.",
    explanation: "Your browser blocked or failed the download.",
    causes: ["Browser download permission denied.", "Pop-up/download blocker.", "Low disk space."],
    steps: ["Allow downloads for this site.", "Retry the download."],
    expectedResult: "The file is saved to your downloads folder.",
    prevention: [],
    retryable: true,
    retryInstructions: "Safe to retry.",
    related: ["FIREWALL_EXPORT_FAILED"],
  },
  BADGE_VERIFICATION_FAILED: {
    id: "SPX-E-1103",
    title: "Protection badge could not be verified",
    category: "reports",
    module: "Badges",
    severity: "medium",
    userMessage: "The protection badge could not be verified for this domain.",
    nextStep: "Complete SDK verification first, then regenerate the badge.",
    explanation: "Badges are issued only to services whose connection has been verified.",
    causes: [
      "The service's SDK is not verified.",
      "The domain on the badge does not match the service.",
    ],
    steps: ["Complete Protection Verification.", "Regenerate the badge."],
    expectedResult: "A badge with a valid certificate ID.",
    prevention: [],
    retryable: false,
    retryInstructions: "Retry after verification.",
    related: ["SDK_HANDSHAKE_FAILED"],
  },

  // ─────────────────────────── 12. DATABASE ───────────────────────────
  DB_WRITE_FAILED: {
    id: "SPX-E-1201",
    title: "Changes could not be saved",
    category: "database",
    module: "SparrowX Cloud Database",
    severity: "high",
    userMessage: "We couldn't save your changes. Your previous settings have been preserved.",
    nextStep: "Retry. If it keeps failing, check System Status.",
    explanation:
      "SparrowX Cloud rejected or did not respond to a save request. The interface was reverted so it matches what is actually stored.",
    causes: [
      "Database temporarily unavailable.",
      "Network interruption.",
      "The record failed a database constraint or permission policy.",
    ],
    steps: [
      "Check you are online.",
      "Retry the action.",
      "Open System Status and confirm Database is Operational.",
      "Report the problem with the reference ID if it persists.",
    ],
    expectedResult: "A green confirmation that the change was saved.",
    prevention: [],
    retryable: true,
    retryInstructions: "Safe to retry — SparrowX saves use upserts.",
    related: ["DB_READ_FAILED", "NETWORK_UNREACHABLE"],
  },
  DB_READ_FAILED: {
    id: "SPX-E-1202",
    title: "Data could not be loaded",
    category: "database",
    module: "SparrowX Cloud Database",
    severity: "medium",
    userMessage: "Some data could not be loaded from SparrowX Cloud.",
    nextStep: "Use “Sync” to retry. Data shown may be from this device's cache.",
    explanation:
      "A request to load records failed. SparrowX may show cached records from this device until the next successful sync.",
    causes: [
      "Database temporarily unavailable.",
      "Network interruption.",
      "A table permission policy blocked the read.",
    ],
    steps: ["Click Sync to reload.", "Check System Status."],
    expectedResult: "“Synced live records from SparrowX Cloud.”",
    prevention: [],
    retryable: true,
    retryInstructions: "Safe to retry.",
    related: ["DB_SYNC_PARTIAL"],
  },
  DB_DELETE_FAILED: {
    id: "SPX-E-1203",
    title: "Record could not be deleted",
    category: "database",
    module: "SparrowX Cloud Database",
    severity: "medium",
    userMessage: "The record was not deleted. It has been restored to the list.",
    nextStep: "Retry the deletion.",
    explanation:
      "SparrowX Cloud did not confirm the deletion, so the record was restored to avoid hiding data that still exists.",
    causes: [
      "Database temporarily unavailable.",
      "Network interruption.",
      "Permission policy prevents deletion.",
    ],
    steps: ["Retry.", "Check System Status."],
    expectedResult: "Deletion confirmation.",
    prevention: [],
    retryable: true,
    retryInstructions: "Safe to retry — deletes are idempotent.",
    related: ["DB_WRITE_FAILED"],
  },
  DB_NOT_CONFIGURED: {
    id: "SPX-E-1204",
    title: "Saved on this device only",
    category: "database",
    module: "SparrowX Cloud Database",
    severity: "medium",
    userMessage: "Saved on this device only. SparrowX Cloud is not configured.",
    nextStep: "Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to sync changes.",
    explanation:
      "This deployment has no cloud database configured, so changes are stored in this browser and will not sync to other devices.",
    causes: ["Missing database environment variables."],
    steps: ["Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.", "Redeploy SparrowX."],
    expectedResult: "Changes show “saved to SparrowX Cloud”.",
    prevention: [],
    retryable: false,
    retryInstructions: "Not applicable until configured.",
    related: ["CONFIG_INVALID_INPUT"],
  },
  DB_SYNC_PARTIAL: {
    id: "SPX-E-1205",
    title: "Workspace sync partially failed",
    category: "database",
    module: "Workspace Sync",
    severity: "medium",
    userMessage: "Some workspace data could not be synced from SparrowX Cloud.",
    nextStep: "Retry Sync. The affected sections may show cached or empty data.",
    explanation:
      "Loading the workspace succeeded for some record types but failed for others. The message lists which data sets failed.",
    causes: [
      "A specific table is unavailable or blocked by policy.",
      "Intermittent network issues.",
    ],
    steps: ["Click Sync to retry.", "If the same tables keep failing, report the problem."],
    expectedResult: "All sections load from SparrowX Cloud.",
    prevention: [],
    retryable: true,
    retryInstructions: "Safe to retry.",
    related: ["DB_READ_FAILED"],
  },

  // ─────────────────────────── 13. NETWORK ───────────────────────────
  NETWORK_OFFLINE: {
    id: "SPX-E-1301",
    title: "You are offline",
    category: "network",
    module: "Network",
    severity: "high",
    userMessage: "You appear to be offline. The action was not completed.",
    nextStep: "Reconnect to the internet and retry.",
    explanation:
      "Your browser reports no network connection, so SparrowX could not contact its services.",
    causes: ["Wi-Fi or network cable disconnected.", "VPN dropped.", "Airplane mode."],
    steps: ["Reconnect to the internet.", "Retry the action."],
    expectedResult: "The action completes with a confirmation.",
    prevention: [],
    retryable: true,
    retryInstructions: "Retry once you are back online.",
    related: ["NETWORK_UNREACHABLE"],
  },
  NETWORK_UNREACHABLE: {
    id: "SPX-E-1302",
    title: "Service unreachable",
    category: "network",
    module: "Network",
    severity: "high",
    userMessage: "Unable to communicate with the security service.",
    nextStep: "Check your connection and retry.",
    explanation: "The request could not reach the server (DNS, TLS or connection failure).",
    causes: [
      "Network interruption.",
      "Corporate firewall or ad-blocker blocking requests.",
      "The service is down.",
    ],
    steps: [
      "Check your connection.",
      "Disable extensions that block network requests for this site.",
      "Check System Status.",
      "Retry.",
    ],
    expectedResult: "The action completes.",
    prevention: [],
    retryable: true,
    retryInstructions: "Retry with a short wait.",
    related: ["NETWORK_OFFLINE", "SERVER_ERROR"],
  },
  REQUEST_TIMEOUT: {
    id: "SPX-E-1303",
    title: "Request timed out",
    category: "network",
    module: "Network",
    severity: "medium",
    userMessage: "The request took too long and was cancelled.",
    nextStep: "Retry. If the problem continues, check System Status.",
    explanation:
      "SparrowX stops waiting after a time limit so the interface never hangs. The operation's outcome was not confirmed.",
    causes: ["Slow network.", "Service under heavy load."],
    steps: ["Retry.", "Check System Status for degraded services."],
    expectedResult: "The action completes within the time limit.",
    prevention: [],
    retryable: true,
    retryInstructions: "Idempotent actions are safe to retry. For payments, check status first.",
    related: ["NETWORK_UNREACHABLE", "SCAN_TIMEOUT"],
  },
  SERVER_ERROR: {
    id: "SPX-E-1304",
    title: "Server error",
    category: "network",
    module: "SparrowX Server",
    severity: "high",
    userMessage: "The SparrowX server hit an error and could not complete the request.",
    nextStep: "Retry shortly. Report the problem if it continues.",
    explanation: "The server returned an HTTP 5xx error. This is not caused by your input.",
    causes: ["Temporary server or database outage.", "A bug in SparrowX."],
    steps: ["Wait a moment and retry.", "Report the problem with the reference ID."],
    expectedResult: "The action completes.",
    prevention: [],
    retryable: true,
    retryInstructions: "Retry with backoff.",
    related: ["API_REQUEST_FAILED", "UNEXPECTED_ERROR"],
  },
  RATE_LIMITED: {
    id: "SPX-E-1305",
    title: "Too many requests",
    category: "network",
    module: "SparrowX Server",
    severity: "low",
    userMessage: "Too many requests. Please wait a moment.",
    nextStep: "Wait 30–60 seconds and retry.",
    explanation: "The service returned HTTP 429 to protect itself from overload.",
    causes: ["Many rapid requests from your account or network."],
    steps: ["Wait about a minute.", "Retry."],
    expectedResult: "The action completes.",
    prevention: ["Avoid rapid repeated clicks."],
    retryable: true,
    retryInstructions: "Retry after waiting.",
    related: ["AI_BRAIN_REQUEST_FAILED"],
  },

  // ─────────────────────────── 14. PERMISSIONS ───────────────────────────
  PERMISSION_DENIED: {
    id: "SPX-E-1401",
    title: "Permission denied",
    category: "permissions",
    module: "Access Control",
    severity: "medium",
    userMessage: "You don't have permission to perform this action.",
    nextStep: "Ask a workspace administrator for access.",
    explanation: "The server or database rejected the request for your role (HTTP 401/403).",
    causes: [
      "Your role does not include this permission.",
      "Database access policy blocked the operation.",
      "Your session expired.",
    ],
    steps: ["Sign out and sign in again.", "Ask an administrator to grant the required role."],
    expectedResult: "The action is allowed.",
    prevention: [],
    retryable: false,
    retryInstructions: "Retry after access is granted.",
    related: ["ADMIN_ONLY", "AUTH_SESSION_EXPIRED"],
  },
  ADMIN_ONLY: {
    id: "SPX-E-1402",
    title: "Administrator access required",
    category: "permissions",
    module: "Access Control",
    severity: "low",
    userMessage: "This area is restricted to SparrowX administrators.",
    nextStep: "Sign in with an administrator account to continue.",
    explanation:
      "Admin areas (such as Error Monitoring) contain operational diagnostics for all workspaces and are hidden from client accounts.",
    causes: ["You are signed in with a client account."],
    steps: ["Sign in with an administrator account."],
    expectedResult: "The admin area loads.",
    prevention: [],
    retryable: false,
    retryInstructions: "Not applicable.",
    related: ["PERMISSION_DENIED"],
  },

  // ─────────────────────────── 15. CONFIG ───────────────────────────
  CONFIG_INVALID_INPUT: {
    id: "SPX-E-1501",
    title: "Required information is missing or invalid",
    category: "config",
    module: "Forms & Validation",
    severity: "low",
    userMessage: "Some required fields are missing or invalid. Nothing was submitted.",
    nextStep: "Complete the highlighted fields and submit again.",
    explanation: "The form failed validation before submission, so no changes were made.",
    causes: ["A required field is empty.", "A value is in the wrong format."],
    steps: [
      "Fill in every required field.",
      "Check formats (emails, domains, numbers).",
      "Submit again.",
    ],
    expectedResult: "The form submits and shows a confirmation.",
    prevention: [],
    retryable: false,
    retryInstructions: "Correct the input before retrying.",
    related: ["DOMAIN_INVALID_TARGET"],
  },
  CLIPBOARD_UNAVAILABLE: {
    id: "SPX-E-1502",
    title: "Clipboard access unavailable",
    category: "config",
    module: "Clipboard",
    severity: "low",
    userMessage: "Couldn't copy to the clipboard.",
    nextStep: "Select the text and copy it manually (Ctrl/Cmd + C).",
    explanation: "Your browser denied clipboard access, or the page is not served over HTTPS.",
    causes: [
      "Clipboard permission denied.",
      "Insecure (non-HTTPS) context.",
      "Browser does not support the Clipboard API.",
    ],
    steps: ["Allow clipboard access for this site.", "Or copy the text manually."],
    expectedResult: "“Copied” confirmation.",
    prevention: [],
    retryable: true,
    retryInstructions: "Retry after granting permission.",
    related: [],
  },

  // ─────────────────────────── 16. UNKNOWN ───────────────────────────
  UNEXPECTED_ERROR: {
    id: "SPX-E-1601",
    title: "Unexpected error",
    category: "unknown",
    module: "Application",
    severity: "high",
    userMessage: "SparrowX hit an unexpected problem and could not complete the action.",
    nextStep: "Retry. If it happens again, report the problem with the reference ID.",
    explanation:
      "An error occurred that SparrowX does not have a specific explanation for yet. A reference ID and safe diagnostic details were recorded so the team can investigate.",
    causes: ["A bug in SparrowX.", "An unusual combination of data or browser state."],
    steps: [
      "Retry the action.",
      "Refresh the page.",
      "Report the problem with the reference ID shown.",
    ],
    expectedResult: "The action completes.",
    prevention: ["Keep your browser up to date."],
    retryable: true,
    retryInstructions: "Retry once; report if it repeats.",
    related: ["RENDER_ERROR", "SERVER_ERROR"],
  },
  RENDER_ERROR: {
    id: "SPX-E-1602",
    title: "Page failed to render",
    category: "unknown",
    module: "Application",
    severity: "critical",
    userMessage: "This page didn't load correctly.",
    nextStep: "Try again or go back home. Report the problem with the reference ID.",
    explanation:
      "A part of the interface crashed while rendering. Your data was not changed by this error.",
    causes: ["A bug in SparrowX.", "Unexpected data shape from the server."],
    steps: ["Click “Try again”.", "Refresh the page.", "Report the problem with the reference ID."],
    expectedResult: "The page loads normally.",
    prevention: [],
    retryable: true,
    retryInstructions: "Retry once.",
    related: ["UNEXPECTED_ERROR"],
  },
  UNHANDLED_REJECTION: {
    id: "SPX-E-1603",
    title: "Background task failed",
    category: "unknown",
    module: "Background Workers",
    severity: "medium",
    userMessage: "A background task failed unexpectedly.",
    nextStep: "Check Activity History for the affected operation and retry it.",
    explanation:
      "An asynchronous task failed without being handled. SparrowX recorded it with a reference ID.",
    causes: ["Network failure in a background request.", "A bug in SparrowX."],
    steps: [
      "Check Activity History.",
      "Retry the related action.",
      "Report the problem if it repeats.",
    ],
    expectedResult: "The background task completes.",
    prevention: [],
    retryable: true,
    retryInstructions: "Retry the related action.",
    related: ["UNEXPECTED_ERROR"],
  },
};

export const ERROR_REGISTRY: Record<ErrorCode, ErrorDoc> = Object.fromEntries(
  ERROR_CODES.map((code) => {
    const raw = DOCS[code];
    return [
      code,
      {
        ...raw,
        code,
        prevention:
          Array.isArray(raw.prevention) && raw.prevention.length > 0
            ? raw.prevention
            : [
                "Follow SparrowX operational security guidelines and verify configuration before deployment.",
              ],
        updatedAt: raw.updatedAt ?? UPDATED,
      },
    ];
  }),
) as Record<ErrorCode, ErrorDoc>;

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && (ERROR_CODES as readonly string[]).includes(value);
}

export function getErrorDoc(code: string | undefined | null): ErrorDoc {
  return isErrorCode(code) ? ERROR_REGISTRY[code] : ERROR_REGISTRY.UNEXPECTED_ERROR;
}

export function docsUrlFor(code: string, referenceId?: string): string {
  const params = new URLSearchParams({ code });
  if (referenceId) params.set("ref", referenceId);
  return `/docs/errors?${params.toString()}`;
}

/** Plain-text troubleshooting instructions (used by the "copy instructions" button). */
export function formatTroubleshootingText(
  docOrCode: ErrorDoc | ErrorCode | string,
  referenceId?: string,
): string {
  const doc = typeof docOrCode === "string" ? getErrorDoc(docOrCode) : docOrCode;
  return [
    `ERROR: ${doc.code} (${doc.id})`,
    referenceId ? `Reference ID: ${referenceId}` : null,
    "",
    "What happened:",
    doc.explanation,
    "",
    "Why it happened:",
    ...doc.causes.map((c) => `- ${c}`),
    "",
    "How to fix:",
    ...doc.steps.map((s, i) => `${i + 1}. ${s}`),
    "",
    "Expected result:",
    `"${doc.expectedResult}"`,
    "",
    "Prevention & Best Practices:",
    ...(Array.isArray(doc.prevention) ? doc.prevention.map((p) => `- ${p}`) : [`- ${doc.prevention}`]),
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/** Search errors by text query, category, or severity filter */
export function searchErrors(options?: {
  query?: string;
  category?: ErrorCategoryId | string;
  severity?: ErrorSeverity;
}): ErrorDoc[] {
  const query = options?.query?.trim().toLowerCase();
  const category = options?.category;
  const severity = options?.severity;

  return Object.values(ERROR_REGISTRY).filter((doc) => {
    if (category && category !== "all" && doc.category !== category) {
      const catObj = ERROR_CATEGORIES.find((c) => c.label === category || c.id === category);
      if (!catObj || doc.category !== catObj.id) {
        return false;
      }
    }
    if (severity && doc.severity !== severity) {
      return false;
    }
    if (query) {
      const match =
        doc.code.toLowerCase().includes(query) ||
        doc.title.toLowerCase().includes(query) ||
        doc.explanation.toLowerCase().includes(query) ||
        doc.causes.some((c) => c.toLowerCase().includes(query)) ||
        doc.steps.some((s) => s.toLowerCase().includes(query));
      if (!match) return false;
    }
    return true;
  });
}

/** Map an HTTP status (or network failure) to the most specific known code. */
export function errorCodeFromHttpStatus(
  status: number | undefined,
  fallback: ErrorCode = "API_REQUEST_FAILED",
): ErrorCode {
  if (status === undefined || status === 0) return "NETWORK_UNREACHABLE";
  if (status === 401 || status === 403) return "PERMISSION_DENIED";
  if (status === 405) return "API_METHOD_NOT_ALLOWED";
  if (status === 400 || status === 422) return "API_INVALID_PAYLOAD";
  if (status === 408) return "REQUEST_TIMEOUT";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "SERVER_ERROR";
  return fallback;
}
