import { useState } from "react";
import {
  PermissionRequest,
  type RequestDecision,
  type PermissionRequestSpec,
} from "../permission-request";

/* The two requests the reference demo stacks: a push to main already granted for an hour,
 * and a sales send still waiting on an answer. */

const GitHubMark = (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    style={{ color: "var(--ui-prc-strong, var(--ui-pr-ink, #000))" }}
  >
    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
  </svg>
);

const GitHubTool = (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    style={{ color: "var(--ui-prc-strong, var(--ui-pr-ink, #181717))" }}
  >
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

const SalesMark = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    style={{ color: "var(--ui-prc-warn-fg, var(--ui-pr-warn-fg, #cc4e00))" }}
  >
    <path
      d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  </svg>
);

const GmailTool = (
  <svg viewBox="0 49.4 512 399.42" aria-hidden="true">
    <g fill="none" fillRule="evenodd">
      <g fillRule="nonzero">
        <path fill="#4285f4" d="M34.91 448.818h81.454V251L0 163.727V413.91c0 19.287 15.622 34.91 34.91 34.91z" />
        <path fill="#34a853" d="M395.636 448.818h81.455c19.287 0 34.909-15.622 34.909-34.909V163.727L395.636 251z" />
        <path fill="#fbbc04" d="M395.636 99.727V251L512 163.727v-46.545c0-43.142-49.25-67.782-83.782-41.891z" />
      </g>
      <path fill="#ea4335" d="M116.364 251V99.727L256 204.455 395.636 99.727V251L256 355.727z" />
      <path
        fill="#c5221f"
        fillRule="nonzero"
        d="M0 117.182v46.545L116.364 251V99.727L83.782 75.291C49.25 49.4 0 74.04 0 117.18z"
      />
    </g>
  </svg>
);

const ROCKET_ICON = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12.9998 17L11.9998 21L9.99977 19L6.99977 17L4.99977 15L2.99977 12L6.99977 11M14.9998 6.50009C16.9998 4.50009 18.9998 3.00009 20.9998 3.00009C20.9998 5.00009 19.4998 7.00009 17.4998 9.00009C16.4998 10.0001 14.5998 12.4001 12.9998 13.0001L11.4998 13.5001L10.4998 12.5001L10.9998 11.0001C11.5998 9.40009 13.9998 7.50009 14.9998 6.50009Z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
  </svg>
);

const MAIL_ICON = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="m4.5 7.5 7.5 5.6 7.5-5.6"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
  </svg>
);

const CLOCK_ICON = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M12 7.2V12l3.2 1.9" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
  </svg>
);

const CODER: PermissionRequestSpec = {
  agent: { name: "Coder", mark: GitHubMark },
  action: "push to main",
  target: "acme/web",
  tool: GitHubTool,
  risk: "risky",
  reason: "The fix for the flaky checkout test passed review and all 214 checks.",
  preview: {
    rows: [
      { id: "cart", label: "src/checkout/cart.ts", diff: { added: 12, removed: 4 } },
      { id: "spec", label: "tests/checkout.spec.ts", diff: { added: 31, removed: 2 } },
      { id: "deploy", label: "Deploys to production after the merge", icon: ROCKET_ICON },
    ],
  },
};

const SALES: PermissionRequestSpec = {
  agent: { name: "Sales agent", mark: SalesMark },
  action: "send 40 emails",
  target: "Gmail · to customers",
  tool: GmailTool,
  risk: "risky",
  reason: "The October segment is warmed up and capped at 40 contacts, well inside today's sending limit.",
  preview: {
    rows: [
      { id: "to", label: "Customers · EU (40)", meta: "40 recipients", icon: MAIL_ICON },
      { id: "subject", label: "Subject: What's new in October", icon: MAIL_ICON },
      { id: "send", label: "Sends today at 9:00 AM", icon: CLOCK_ICON },
    ],
  },
};

export default function Demo() {
  /* Both start pending: that is the state the reference DOM captures, and it is the state a
   * reader needs to see first. Allowing either card shows the resolved row it folds into. */
  const [coder, setCoder] = useState<RequestDecision | null>(null);
  const [sales, setSales] = useState<RequestDecision | null>(null);

  return (
    <div style={{ display: "grid", gap: 14, width: "100%", maxWidth: 400, justifyItems: "stretch" }}>
      <PermissionRequest
        request={CODER}
        decision={coder}
        onAllow={(grant) => setCoder({ state: "allowed", ...grant })}
        onDeny={() => setCoder({ state: "denied", at: Date.now() })}
        onRevoke={() => setCoder(null)}
      />

      <PermissionRequest
        request={SALES}
        decision={sales}
        onAllow={(grant) => setSales({ state: "allowed", ...grant })}
        onDeny={() => setSales({ state: "denied", at: Date.now() })}
        onRevoke={() => setSales(null)}
      />
    </div>
  );
}
