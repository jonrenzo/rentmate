"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, CalendarDays, Check, CheckCircle2, Clock3, HandCoins, ImagePlus, Landmark, Wallet } from "lucide-react";
import { money } from "@/lib/domain";
import type { AppState } from "@/lib/types";

const steps = ["Your rent", "Try a payment", "Track it"];
const methods = [
  { value: "gcash", label: "GCash", icon: Wallet },
  { value: "bank", label: "Bank", icon: Landmark },
  { value: "cash", label: "Cash", icon: HandCoins },
] as const;

export function RenterOnboarding({ state, complete, signOut }: {
  state: AppState;
  complete: () => Promise<void>;
  signOut: () => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [rentOpen, setRentOpen] = useState(false);
  const [method, setMethod] = useState<"gcash" | "bank" | "cash" | null>(null);
  const [proof, setProof] = useState(false);
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const tenancy = state.tenancies.find(t => t.renter_id === state.viewer.id && t.status === "active");
  const room = state.rooms.find(r => r.id === tenancy?.room_id);
  const amount = tenancy ? money(tenancy.monthly_rent) : "Sample rent";

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "nearest" });
  }, [step]);

  async function finish(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your progress. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function go(next: number) {
    setError("");
    setStep(next);
  }

  return (
    <main className="onboarding">
      <header className="onboarding-header">
        <div className="brand">
          <img className="mark" src="/rentmate-brand-v1.webp" alt="" width={40} height={40} />
          Rentmate
        </div>
        <button className="text-button" disabled={busy} onClick={() => void finish(signOut)}>Sign out</button>
      </header>
      <section className="onboarding-card" aria-labelledby="onboarding-title" aria-busy={busy}>
        <ol className="onboarding-steps" aria-label="Getting started">
          {steps.map((label, index) => (
            <li key={label} aria-current={index === step ? "step" : undefined} className={index < step ? "complete" : ""}>
              <span aria-hidden="true">{index < step ? <Check size={14} /> : index + 1}</span>
              {label}
            </li>
          ))}
        </ol>

        <div className="onboarding-body">
          {step === 0 && (
            <>
              <img className="onboarding-mascot" src="/rentmate-brand-v1.webp" alt="" width={64} height={64} />
              <h1 id="onboarding-title" ref={heading} tabIndex={-1}>Let’s try it, {state.viewer.full_name.split(" ")[0]}.</h1>
              <p className="onboarding-intro">Tap your rent card to see when it’s due.</p>
              <button className="onboarding-rent" aria-expanded={rentOpen} aria-controls="tour-due-date" disabled={busy} onClick={() => setRentOpen(!rentOpen)}>
                <span>{room?.name || "Your room"}</span>
                <strong>{amount}</strong>
                <span>per month</span>
                <span className="onboarding-card-hint"><CalendarDays size={18} aria-hidden="true" />{rentOpen ? "Hide due date" : "When is it due?"}</span>
              </button>
              <div id="tour-due-date" hidden={!rentOpen}>
                <p className="onboarding-reveal">{tenancy ? <>Due on day <strong>{tenancy.due_day}</strong> each month.</> : "Ask the owner to confirm your due date."}</p>
                {tenancy && tenancy.due_day > 28 && <p className="fine">Shorter month? Use its last day.</p>}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1 id="onboarding-title" ref={heading} tabIndex={-1}>How would you pay?</h1>
              <p className="onboarding-intro">Choose one to try.</p>
              <p className="onboarding-practice">Practice only. Nothing is paid or sent.</p>
              <fieldset className="onboarding-methods" disabled={busy}>
                <legend className="sr-only">Practice payment method</legend>
                {methods.map(({ value, label, icon: Icon }) => (
                  <label key={value}>
                    <input type="radio" name="practice-method" value={value} checked={method === value} onChange={() => { setMethod(value); setProof(false); }} />
                    <span><Icon size={24} aria-hidden="true" />{label}</span>
                  </label>
                ))}
              </fieldset>
              {method === "cash" ? (
                <div className="onboarding-cash">
                  <HandCoins size={42} aria-hidden="true" />
                  <h2>Give cash to the owner.</h2>
                  <p>The owner records it in Rentmate.</p>
                </div>
              ) : method && (
                <>
                  <p className="onboarding-prompt">In real life, pay in {method === "gcash" ? "GCash" : "your bank app"} first.</p>
                  <button className="onboarding-proof" disabled={busy || proof} onClick={() => setProof(true)}>
                    {proof ? <CheckCircle2 size={30} aria-hidden="true" /> : <ImagePlus size={30} aria-hidden="true" />}
                    <strong>{proof ? "Sample screenshot attached" : "Use a sample screenshot"}</strong>
                    <span>{proof ? amount + " · Reference: SAMPLE-001" : "Try attaching payment proof"}</span>
                  </button>
                  {proof && <p className="onboarding-prompt" role="status">Ready. Now submit the sample proof below.</p>}
                </>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <h1 id="onboarding-title" ref={heading} tabIndex={-1}>{approved ? "That’s how it works." : "Sent. What happens next?"}</h1>
              <p className="onboarding-intro">{approved ? "Find your payment status in Payments." : "The owner checks your payment proof."}</p>
              <p className="onboarding-practice">Practice only. Nothing is paid or sent.</p>
              <div className={"onboarding-receipt" + (approved ? " is-approved" : "")} role="status" aria-atomic="true">
                {approved ? <CheckCircle2 size={40} aria-hidden="true" /> : <Clock3 size={40} aria-hidden="true" />}
                <p>{approved ? "Sample receipt" : "Sample payment"}</p>
                <strong>{amount}</strong>
                <span className={"badge " + (approved ? "approved" : "pending")}>{approved ? "Approved" : "Pending review"}</span>
                <p>{approved ? "Recorded by the owner" : "Waiting for the owner"}</p>
              </div>
            </>
          )}
        </div>

        {error && <p className="error" role="alert">{error}</p>}
        <div className="onboarding-actions">
          {step > 0 && <button className="button" disabled={busy} onClick={() => go(step - 1)}>Back</button>}
          <button className="button primary" disabled={busy || (step === 0 && !rentOpen) || (step === 1 && (!method || (method !== "cash" && !proof)))} onClick={() => {
            if (step === 2 && !approved) setApproved(true);
            else if (step === 2) void finish(complete);
            else {
              if (step === 1) setApproved(method === "cash");
              go(step + 1);
            }
          }}>
            {busy ? "Please wait…" : step === 0 ? "Try a payment" : step === 1 ? method === "cash" ? "See a cash example" : "Submit sample proof" : approved ? "Go to my home" : "See approved example"}
            {!busy && <ArrowRight size={16} aria-hidden="true" />}
          </button>
        </div>
      </section>
      <button className="text-button onboarding-skip" disabled={busy} onClick={() => void finish(complete)}>Skip tour</button>
    </main>
  );
}

