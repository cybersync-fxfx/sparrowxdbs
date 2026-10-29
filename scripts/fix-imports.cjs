const fs = require("fs");
let code = fs.readFileSync("src/components/portals/ClientAndAdminPortals.tsx", "utf8");

code = code.replace(/import\s*\{([\s\S]*?)\}\s*from\s*["']lucide-react["'];/, (match, p1) => {
  const icons = p1
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const needed = ["ArrowUpRight", "CheckCircle2", "EyeOff", "Mail", "Shield", "User", "Zap"];
  for (const n of needed) {
    if (!icons.includes(n)) icons.push(n);
  }
  icons.sort();
  return "import {\n  " + icons.join(",\n  ") + ',\n} from "lucide-react";';
});

fs.writeFileSync("src/components/portals/ClientAndAdminPortals.tsx", code, "utf8");
console.log("Successfully updated lucide-react imports");
