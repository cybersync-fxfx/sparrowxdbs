const fs = require("fs");
let content = fs.readFileSync("src/styles.css", "utf8");

const addition = `

/* Vibe Coded & Humanized Aesthetics */
.vibe-mesh-bg {
  background-image:
    radial-gradient(ellipse 60% 50% at 20% 0%, rgba(240, 90, 40, 0.12) 0%, transparent 60%),
    radial-gradient(ellipse 50% 50% at 85% 15%, rgba(16, 185, 129, 0.08) 0%, transparent 60%),
    radial-gradient(ellipse 70% 60% at 50% 100%, rgba(240, 90, 40, 0.05) 0%, transparent 70%);
}

.vibe-subtle-grid {
  background-image: 
    linear-gradient(to right, rgba(255, 255, 255, 0.025) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
  background-size: 36px 36px;
  mask-image: radial-gradient(ellipse 75% 65% at 50% 40%, black 40%, transparent 95%);
  -webkit-mask-image: radial-gradient(ellipse 75% 65% at 50% 40%, black 40%, transparent 95%);
}

.vibe-glass-panel {
  background: rgba(26, 26, 26, 0.75);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.09);
  box-shadow: 
    0 0 0 1px rgba(0, 0, 0, 0.5),
    0 24px 48px -12px rgba(0, 0, 0, 0.75),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.07);
}

.vibe-feature-card {
  background: rgba(30, 30, 30, 0.5);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.07);
  box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.05);
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.vibe-feature-card:hover {
  background: rgba(36, 36, 36, 0.75);
  border-color: rgba(240, 90, 40, 0.35);
  transform: translateY(-2px);
  box-shadow: 
    0 12px 28px -10px rgba(240, 90, 40, 0.15),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.1);
}
`;

if (!content.includes("vibe-mesh-bg")) {
  fs.writeFileSync("src/styles.css", content + addition, "utf8");
  console.log("Appended vibe styles successfully");
}
