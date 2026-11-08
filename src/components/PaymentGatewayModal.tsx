import React from "react";

export interface PaymentGatewayModalProps {
  currentBalance: number;
  neededCredits?: number | undefined;
  tenantId?: string | undefined;
  tenantName?: string | undefined;
  userEmail?: string | undefined;
  onClose: () => void;
  onCreditsAdded: (newBalance: number, creditsAdded: number) => void;
  showToast: (msg: string) => void;
}

/**
 * Legacy Payment Gateway Modal has been removed.
 * Plan activation and workspace provisioning operate directly on the self-hosted server.
 */
export function PaymentGatewayModal(_props: PaymentGatewayModalProps): React.ReactElement | null {
  return null;
}
