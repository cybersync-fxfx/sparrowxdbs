const fs = require("fs");
let code = fs.readFileSync("src/components/portals/ClientAndAdminPortals.tsx", "utf8");

const properHeader = `import { useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Check,
  CheckCircle2,
  Copy,
  Database,
  Eye,
  EyeOff,
  FileSearch,
  Globe2,
  KeyRound,
  LockKeyhole,
  Mail,
  Plus,
  RefreshCw,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  Terminal,
  Trash2,
  User,
  Users,
  Wrench,
  Zap,
} from "lucide-react";`;

// Replace lines 1 to 34
code = code.replace(/^import\s*\{[\s\S]*?from\s*"lucide-react";/m, properHeader);

fs.writeFileSync("src/components/portals/ClientAndAdminPortals.tsx", code, "utf8");
console.log("Fixed header imports properly");
