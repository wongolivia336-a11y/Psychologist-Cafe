"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ADULT_SESSION_KEY, NOTICE_POINTS, NOTICE_TITLE } from "@/lib/notice";

type GateState = "checking" | "needs-confirmation" | "confirmed";

export default function AdultGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GateState>("checking");

  useEffect(() => {
    if (window.location.pathname === "/notice") {
      setState("confirmed");
      return;
    }
    setState(sessionStorage.getItem(ADULT_SESSION_KEY) === "yes" ? "confirmed" : "needs-confirmation");
  }, []);

  if (state === "confirmed") return <>{children}</>;
  if (state === "checking") return <div className="adult-gate" aria-busy="true" />;

  return (
    <div className="adult-gate" role="dialog" aria-labelledby="adult-gate-title" aria-modal="true">
      <section className="adult-gate__panel">
        <div className="scene-kicker">Before you sit down</div>
        <h1 id="adult-gate-title">{NOTICE_TITLE}</h1>
        <div className="adult-gate__copy">
          {NOTICE_POINTS.slice(0, 3).map((point) => <p key={point}>{point}</p>)}
        </div>
        <div className="adult-gate__actions">
          <button
            type="button"
            onClick={() => {
              sessionStorage.setItem(ADULT_SESSION_KEY, "yes");
              setState("confirmed");
            }}
            className="adult-gate__confirm"
          >
            我已达到法定成年年龄，并理解这是什么
          </button>
          <Link href="/notice" className="quiet-link">阅读完整说明</Link>
        </div>
      </section>
    </div>
  );
}
