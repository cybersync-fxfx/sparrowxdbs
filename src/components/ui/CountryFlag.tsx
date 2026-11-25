import React from "react";
import AE from "country-flag-icons/react/3x2/AE";
import AU from "country-flag-icons/react/3x2/AU";
import BR from "country-flag-icons/react/3x2/BR";
import CA from "country-flag-icons/react/3x2/CA";
import CH from "country-flag-icons/react/3x2/CH";
import CL from "country-flag-icons/react/3x2/CL";
import CN from "country-flag-icons/react/3x2/CN";
import DE from "country-flag-icons/react/3x2/DE";
import ES from "country-flag-icons/react/3x2/ES";
import FI from "country-flag-icons/react/3x2/FI";
import FR from "country-flag-icons/react/3x2/FR";
import GB from "country-flag-icons/react/3x2/GB";
import HK from "country-flag-icons/react/3x2/HK";
import ID from "country-flag-icons/react/3x2/ID";
import IE from "country-flag-icons/react/3x2/IE";
import IL from "country-flag-icons/react/3x2/IL";
import IN from "country-flag-icons/react/3x2/IN";
import IT from "country-flag-icons/react/3x2/IT";
import JP from "country-flag-icons/react/3x2/JP";
import KR from "country-flag-icons/react/3x2/KR";
import MX from "country-flag-icons/react/3x2/MX";
import MY from "country-flag-icons/react/3x2/MY";
import NG from "country-flag-icons/react/3x2/NG";
import NL from "country-flag-icons/react/3x2/NL";
import NZ from "country-flag-icons/react/3x2/NZ";
import PH from "country-flag-icons/react/3x2/PH";
import PL from "country-flag-icons/react/3x2/PL";
import RU from "country-flag-icons/react/3x2/RU";
import SA from "country-flag-icons/react/3x2/SA";
import SE from "country-flag-icons/react/3x2/SE";
import SG from "country-flag-icons/react/3x2/SG";
import TH from "country-flag-icons/react/3x2/TH";
import TR from "country-flag-icons/react/3x2/TR";
import TW from "country-flag-icons/react/3x2/TW";
import UA from "country-flag-icons/react/3x2/UA";
import US from "country-flag-icons/react/3x2/US";
import VN from "country-flag-icons/react/3x2/VN";
import ZA from "country-flag-icons/react/3x2/ZA";

type FlagIconComponent = React.ComponentType<{ className?: string; title?: string }>;

// Explicit tree-shakeable subset instead of importing all 260+ country SVGs (~231 KB -> ~20 KB)
const FLAG_MAP: Record<string, FlagIconComponent> = {
  AE, AU, BR, CA, CH, CL, CN, DE, ES, FI, FR, GB, HK, ID, IE, IL, IN, IT,
  JP, KR, MX, MY, NG, NL, NZ, PH, PL, RU, SA, SE, SG, TH, TR, TW, UA, US, VN, ZA,
};

export interface CountryFlagProps extends React.HTMLAttributes<HTMLSpanElement> {
  code: string;
  className?: string;
  title?: string;
}

export function CountryFlag({ code, className = "size-4", title, ...props }: CountryFlagProps) {
  const normalized = (code || "").toUpperCase().trim();
  const FlagComponent = FLAG_MAP[normalized];

  if (!FlagComponent) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-xs bg-muted font-mono text-[9px] font-bold text-muted-foreground uppercase border border-border/60 ${className}`}
        title={title || normalized}
        {...props}
      >
        {normalized.slice(0, 2) || "??"}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xs shadow-2xs border border-white/10 ${className}`}
      title={title || normalized}
      {...props}
    >
      <FlagComponent className="h-full w-full object-cover" title={title || normalized} />
    </span>
  );
}
