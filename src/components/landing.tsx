import Link from "next/link";
import { REPO_URL } from "@/lib/repo";
import Footer from "./footer";

export type LandingMode = "ready" | "setup" | "demo-only";

function Rings() {
  // Static echo of the dashboard's activity rings.
  return (
    <svg viewBox="0 0 200 200" className="size-full" aria-hidden>
      {[
        { r: 88, color: "var(--move)", p: 0.72 },
        { r: 66, color: "var(--zone)", p: 0.48 },
        { r: 44, color: "var(--sleep)", p: 0.86 },
      ].map(({ r, color, p }) => {
        const len = 2 * Math.PI * r;
        return (
          <g key={r}>
            <circle cx="100" cy="100" r={r} fill="none" stroke={color} strokeOpacity={0.14} strokeWidth={14} />
            <circle
              cx="100"
              cy="100"
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={14}
              strokeLinecap="round"
              strokeDasharray={`${len * p} ${len}`}
              transform="rotate(-90 100 100)"
            />
          </g>
        );
      })}
    </svg>
  );
}

const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[12px] text-primary">{children}</code>
);

function SetupGuide({ redirectUri }: { redirectUri: string }) {
  const steps = [
    <>
      Create a project in the{" "}
      <a className="underline underline-offset-2" href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noreferrer">
        Google Cloud console
      </a>
      .
    </>,
    <>
      Enable the{" "}
      <a className="underline underline-offset-2" href="https://console.cloud.google.com/apis/library" target="_blank" rel="noreferrer">
        Google Health API
      </a>
      .
    </>,
    <>
      On the{" "}
      <a className="underline underline-offset-2" href="https://console.cloud.google.com/auth/overview" target="_blank" rel="noreferrer">
        OAuth consent screen
      </a>
      , choose External, add yourself as a test user, and add the four <Code>googlehealth.*.readonly</Code> scopes for
      activity, health metrics, sleep and nutrition.
    </>,
    <>
      Create a{" "}
      <a className="underline underline-offset-2" href="https://console.cloud.google.com/auth/clients" target="_blank" rel="noreferrer">
        Web application client
      </a>{" "}
      with this redirect URI: <Code>{redirectUri}</Code>
    </>,
    <>
      Set <Code>GOOGLE_CLIENT_ID</Code>, <Code>GOOGLE_CLIENT_SECRET</Code> and <Code>SESSION_SECRET</Code> (any random
      string of 32+ characters), then restart or redeploy.
    </>,
  ];
  return (
    <div className="card max-w-lg space-y-4 p-6 text-sm">
      <p className="font-medium">Connect your Google account in five steps</p>
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 leading-relaxed text-secondary">
            <span className="tabular grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-medium text-primary">
              {i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function Landing({
  mode,
  error,
  redirectUri,
}: {
  mode: LandingMode;
  error?: string;
  redirectUri: string;
}) {
  const repo = REPO_URL;
  const primary =
    "rounded-full bg-ink px-6 py-3 text-sm font-medium text-ink-contrast transition hover:opacity-90 active:scale-[0.98]";
  const secondary = "card !rounded-full px-6 py-3 text-sm font-medium transition active:scale-[0.98]";

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-[1100px] flex-col px-4 py-12 sm:px-6">
      <div className="grid flex-1 items-center gap-12 py-8 md:grid-cols-[1.1fr_1fr]">
        <div className="space-y-8">
          <div className="space-y-4">
            <p className="font-mono text-[11px] tracking-[0.14em] text-muted uppercase">
              <span className="text-primary">Wristside</span> · for Fitbit &amp; Google Health
            </p>
            <h1 className="text-4xl leading-[1.05] font-semibold tracking-tighter md:text-6xl">
              Your body,
              <br />
              <span className="text-muted">on the big screen.</span>
            </h1>
            <p className="max-w-[46ch] text-base leading-relaxed text-secondary">
              Steps, sleep stages, resting heart rate and workouts from your band, on any computer. Your data stays
              between you and Google.
            </p>
          </div>

          {error && (
            <p role="alert" className="card max-w-md px-4 py-3 text-sm">
              <span className="font-medium text-bad">Sign-in failed.</span> <span className="text-secondary">{error}</span>
            </p>
          )}

          {mode === "ready" && (
            <div className="flex flex-wrap gap-3">
              <a href="/api/auth/login" className={primary}>
                Connect Google Health
              </a>
              <Link href="/?demo=1" className={secondary}>
                View demo
              </Link>
            </div>
          )}

          {mode === "demo-only" && (
            <div className="flex flex-wrap gap-3">
              <Link href="/?demo=1" className={primary}>
                Explore the demo
              </Link>
              {repo && (
                <a href={repo} className={secondary} target="_blank" rel="noreferrer">
                  Run your own
                </a>
              )}
            </div>
          )}

          {mode === "setup" && (
            <div className="space-y-4">
              <SetupGuide redirectUri={redirectUri} />
              <Link href="/?demo=1" className={`${secondary} inline-block`}>
                View demo meanwhile
              </Link>
            </div>
          )}
        </div>

        <div className="card relative mx-auto hidden aspect-square w-full max-w-[420px] p-10 md:block">
          <Rings />
        </div>
      </div>
      <Footer />
    </main>
  );
}
