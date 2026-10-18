"use client";
import { useEffect, useState } from "react";
import {
  House,
  LayoutDashboard,
  UsersRound,
  DoorOpen,
  Wallet,
  ReceiptText,
  Settings,
  UserRound,
  LogOut,
  Plus,
  ArrowUpRight,
  Check,
  Clock3,
  ShieldCheck,
  Download,
} from "lucide-react";
import type {
  Action,
  ActionResult,
  AppState,
  Bill,
  Payment,
  Profile,
  Room,
  Tenancy,
} from "@/lib/types";
import {
  billStatus,
  money,
  monthLabel,
} from "@/lib/domain";
import { pesos } from "@/lib/input";
import { FormDialog, type FormSpec, type Field, str } from "./forms";
async function request(url: string, body?: unknown): Promise<any> {
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error(data.error || "Unable to complete request."),
      { status: response.status },
    );
  return data;
}
const date = (value: string) =>
  new Date(value + "T12:00:00").toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const initials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
export default function RentmateApp() {
  const [state, setState] = useState<AppState | null>(null),
    [page, setPage] = useState("Overview"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [passwordGate, setPasswordGate] = useState(false),
    [setup, setSetup] = useState(false),
    [modal, setModal] = useState<FormSpec | null>(null),
    [month, setMonth] = useState(""),
    [install, setInstall] = useState<any>(null);
  async function refresh() {
    try {
      setState(await request("/api/state"));
      setPasswordGate(false);
      setError("");
    } catch (e: any) {
      setNotice("");
      setPage("Overview");
      setModal(null);
      if (e.status === 428) setPasswordGate(true);
      else if (e.status === 503) setSetup(true);
      else if (e.status !== 401) setError(e.message);
      setState(null);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
    const handler = (e: Event) => {
      e.preventDefault();
      setInstall(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  async function act(action: Action): Promise<ActionResult> {
    const result = await request("/api/actions", action);
    await refresh();
    setNotice("Saved successfully.");
    return result;
  }
  function showAction(
    title: string,
    fields: Field[],
    build: (d: FormData) => Action,
    description?: string,
    content?: React.ReactNode,
  ) {
    setModal({
      title,
      fields,
      description,
      content,
      run: async (d) => {
        const result = await act(build(d));
        if (result.temporary_password)
          setNotice(
            `Temporary password: ${result.temporary_password} — copy it now and share privately. It is shown only once.`,
          );
      },
    });
  }
  function changePassword() {
    setModal({
      title: "Change password",
      description: "Choose a new password with at least 12 characters.",
      fields: [
        { name: "password", label: "New password", type: "password" },
        { name: "confirm", label: "Confirm password", type: "password" },
      ],
      run: async (d) => {
        if (str(d, "password").length < 12)
          throw Error("Use at least 12 characters.");
        if (str(d, "password") !== str(d, "confirm"))
          throw Error("Passwords do not match.");
        await request("/api/auth/password", { password: str(d, "password") });
        await refresh();
        setNotice("Password changed.");
      },
    });
  }
  async function upload(data: FormData) {
    const response = await fetch("/api/upload", { method: "POST", body: data });
    const result = await response.json();
    if (!response.ok) throw Error(result.error);
    await refresh();
    setNotice("Upload saved.");
  }
  function imagePath(path: string) {
    return `/api/file?path=${encodeURIComponent(path)}`;
  }
  if (loading)
    return (
      <main className="login">
        <div className="brand">
          <img className="mark" src="/rentmate-brand-v1.webp" alt="" width={40} height={40} fetchPriority="high" />
          Rentmate
        </div>
        <p className="muted">Getting things ready…</p>
      </main>
    );
  const needsPassword = passwordGate || state?.viewer.must_change_password;
  if (!state || needsPassword)
    return (
      <main className="login">
        <div className="login-card">
          <div className="brand">
            <img className="mark" src="/rentmate-brand-v1.webp" alt="" width={40} height={40} fetchPriority="high" />
            Rentmate
          </div>
          <h1>{needsPassword ? "Make it yours." : "Welcome home."}</h1>
          <p className="muted">
            {needsPassword
              ? "Set your own password before opening your account."
              : setup
                ? "Connect your Supabase project to sign in."
                : "Your rent, all in one place."}
          </p>
          {needsPassword ? (
            <button className="button primary full" onClick={changePassword}>
              Set new password
            </button>
          ) : (
            !setup && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setLoading(true);
                  const d = new FormData(e.currentTarget);
                  try {
                    const result = await request("/api/auth/login", {
                      username: str(d, "username"),
                      password: str(d, "password"),
                    });
                    if (result.must_change_password) setPasswordGate(true);
                    else {
                      setPage("Overview");
                      setNotice("");
                      await refresh();
                    }
                  } catch (e: any) {
                    setError(e.message);
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <label className="field">
                  Username
                  <input name="username" required autoComplete="username" />
                </label>
                <label className="field">
                  Password
                  <input
                    name="password"
                    required
                    type="password"
                    autoComplete="current-password"
                  />
                </label>
                <button className="button primary full">
                  Sign in <ArrowUpRight size={16} />
                </button>
              </form>
            )
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <p className="fine">
            Forgot your password? Ask the owner for a new temporary password.
          </p>
        </div>
        {modal && <FormDialog spec={modal} close={() => setModal(null)} />}
      </main>
    );
  const view = state;
  const owner = state.viewer.role === "owner";
  const active = state.tenancies.filter((t) => t.status === "active");
  const currentMonth = month || state.today.slice(0, 7);
  const bills = state.bills.filter((b) => b.period.startsWith(currentMonth));
  const pending = state.payments.filter((p) => p.status === "pending");
  const collected = state.payments
    .filter(
      (p) => p.status === "approved" && p.received_on.startsWith(currentMonth),
    )
    .reduce((n, p) => n + p.amount, 0);
  const unpaid = bills
    .filter((b) => b.status === "unpaid")
    .reduce((n, b) => n + b.amount, 0);
  const person = (id: string) => state.profiles.find((p) => p.id === id);
  const room = (id: string) => state.rooms.find((r) => r.id === id);
  const tenancy = (id: string) =>
    state.tenancies.find((t) => t.renter_id === id);
  const name = (id: string) => person(id)?.full_name || "Renter";
  const roomName = (id: string) =>
    room(tenancy(id)?.room_id || "")?.name || "Unassigned";
  const mine = tenancy(state.viewer.id);
  const writable = owner || mine?.status === "active";
  function editRoom(r?: Room) {
    showAction(
      r ? "Edit room" : "Add room",
      [
        { name: "name", label: "Room name", value: r?.name },
        {
          name: "capacity",
          label: "Capacity",
          type: "number",
          min: "1",
          step: "1",
          value: r?.capacity || 1,
        },
        { name: "notes", label: "Notes", value: r?.notes, required: false },
      ],
      (d) => ({
        type: "room.save",
        id: r?.id,
        name: str(d, "name"),
        capacity: Number(str(d, "capacity")),
        notes: str(d, "notes"),
      }),
    );
  }
  function editRenter(p?: Profile) {
    const t = p ? tenancy(p.id) : undefined;
    showAction(
      p ? "Edit renter" : "Add renter",
      [
        { name: "full_name", label: "Full name", value: p?.full_name },
        { name: "phone", label: "Phone", value: p?.phone, required: false },
        ...(!p ? [{ name: "username", label: "Assigned username" }] : []),
        {
          name: "room_id",
          label: "Room",
          value: t?.room_id,
          options: view.rooms.map((r) => ({ value: r.id, label: r.name })),
        },
        {
          name: "monthly_rent",
          label: "Monthly rent (₱)",
          type: "number",
          min: "0.01",
          step: "0.01",
          value: t ? t.monthly_rent / 100 : undefined,
        },
        {
          name: "due_day",
          label: "Monthly due day",
          type: "number",
          min: "1",
          max: "31",
          step: "1",
          value: t?.due_day || 1,
        },
        ...(!p
          ? [
              {
                name: "start_date",
                label: "Move-in date",
                type: "date",
                value: view.today,
              },
              {
                name: "first_bill_month",
                label: "First billing month",
                type: "month",
                value: view.today.slice(0, 7),
              },
              {
                name: "advance_received",
                label: "One month advance received",
                type: "checkbox",
              },
              {
                name: "deposit_received",
                label: "One month deposit received",
                type: "checkbox",
              },
            ]
          : []),
      ],
      (d) =>
        p
          ? {
              type: "renter.update",
              id: p.id,
              full_name: str(d, "full_name"),
              phone: str(d, "phone"),
              room_id: str(d, "room_id"),
              monthly_rent: pesos(str(d, "monthly_rent")),
              due_day: Number(str(d, "due_day")),
            }
          : {
              type: "renter.create",
              username: str(d, "username"),
              full_name: str(d, "full_name"),
              phone: str(d, "phone"),
              room_id: str(d, "room_id"),
              monthly_rent: pesos(str(d, "monthly_rent")),
              due_day: Number(str(d, "due_day")),
              start_date: str(d, "start_date"),
              first_bill_month: str(d, "first_bill_month"),
              advance_received: d.has("advance_received"),
              deposit_received: d.has("deposit_received"),
            },
      p
        ? "Rent changes apply to bills that have not been generated yet."
        : "A temporary password will be shown after saving. First rent is a full month.",
    );
  }
  function pay(b?: Bill) {
    const choices = view.bills.filter(
      (b) =>
        billStatus(b, view.payments, view.today) !== "pending" &&
        b.status === "unpaid",
    );
    if (!choices.length) {
      setNotice("There are no unpaid bills available for payment.");
      return;
    }
    setModal({
      title: owner ? "Record payment" : "Submit payment",
      description: owner
        ? "Record a full payment you have already received."
        : "Transfer the full amount, then submit your proof. Your balance clears after the owner verifies it.",
      content: !owner ? (
        <div className="instructions">
          {view.settings.gcash_qr_path && (
            <img
              className="qr"
              src={imagePath(view.settings.gcash_qr_path)}
              alt="Owner GCash payment QR"
            />
          )}
          <strong>{view.settings.gcash_name || "GCash details not set"}</strong>
          <p>{view.settings.gcash_number}</p>
          {view.settings.bank_details && <p>{view.settings.bank_details}</p>}
        </div>
      ) : undefined,
      fields: [
        {
          name: "bill_id",
          label: "Month to pay",
          value: b?.id,
          options: choices.map((b) => ({
            value: b.id,
            label: `${owner ? name(b.renter_id) + " · " : ""}${monthLabel(b.period)} · ${money(b.amount)}`,
          })),
        },
        {
          name: "method",
          label: "Payment method",
          options: (owner ? ["cash", "gcash", "bank"] : ["gcash", "bank"]).map(
            (m) => ({
              value: m,
              label:
                m === "gcash"
                  ? "GCash"
                  : m === "cash"
                    ? "Cash"
                    : "Bank transfer",
            }),
          ),
        },
        {
          name: "received_on",
          label: "Payment date",
          type: "date",
          value: view.today,
          max: view.today,
        },
        { name: "reference", label: "Reference number", required: !owner },
        ...(!owner
          ? [{ name: "file", label: "Payment screenshot", type: "file" }]
          : []),
        { name: "note", label: "Note", required: false },
      ],
      submit: owner ? "Record full payment" : "Submit for review",
      run: async (d) => {
        if (owner)
          await act({
            type: "payment.record",
            bill_id: str(d, "bill_id"),
            method: str(d, "method") as "cash" | "gcash" | "bank",
            received_on: str(d, "received_on"),
            reference: str(d, "reference"),
            note: str(d, "note"),
          });
        else {
          d.set("kind", "proof");
          await upload(d);
        }
      },
    });
  }
  function review(p: Payment) {
    setModal({
      title: "Payment details",
      description: `${name(p.renter_id)} · ${money(p.amount)} · ${p.method.toUpperCase()} · ${date(p.received_on)}`,
      content: (
        <div className="receipt">
          <p>Reference: {p.reference || "—"}</p>
          <p>
            Status: <span className={`badge ${p.status}`}>{p.status}</span>
          </p>
          {p.note && <p>{p.note}</p>}
          {p.proof_path && (
            <a href={imagePath(p.proof_path)} target="_blank" rel="noreferrer">
              <img
                className="proof"
                src={imagePath(p.proof_path)}
                alt="Payment proof"
              />
            </a>
          )}
        </div>
      ),
      fields:
        owner && p.status === "pending"
          ? [
              {
                name: "decision",
                label: "Decision",
                options: [
                  { value: "approve", label: "Approve — payment received" },
                  { value: "reject", label: "Reject — request new proof" },
                ],
              },
              {
                name: "reason",
                label: "Reason (required when rejecting)",
                required: false,
              },
            ]
          : owner && p.status === "approved" && p.method !== "deposit"
            ? [{ name: "reason", label: "Reason for reversal" }]
            : [],
      submit:
        owner && p.status === "pending"
          ? "Save decision"
          : owner && p.status === "approved" && p.method !== "deposit"
            ? "Reverse payment"
            : "Close",
      run: async (d) => {
        if (owner && p.status === "pending")
          await act({
            type: "payment.review",
            id: p.id,
            approve: str(d, "decision") === "approve",
            reason: str(d, "reason"),
          });
        else if (owner && p.status === "approved" && p.method !== "deposit")
          await act({
            type: "payment.reverse",
            id: p.id,
            reason: str(d, "reason"),
          });
      },
    });
  }
  function funds(t: Tenancy) {
    showAction(
      "Advance & deposit",
      [
        {
          name: "kind",
          label: "Transaction",
          options: [
            { value: "advance_received", label: "Receive advance" },
            { value: "deposit_received", label: "Receive deposit" },
            { value: "advance_refunded", label: "Refund advance" },
            { value: "deposit_refunded", label: "Refund deposit" },
          ],
        },
        {
          name: "amount",
          label: "Amount (₱)",
          type: "number",
          min: "0.01",
          step: "0.01",
        },
        { name: "note", label: "Note", required: false },
      ],
      (d) => ({
        type: "fund.record",
        tenancy_id: t.id,
        kind: str(d, "kind") as any,
        amount: pesos(str(d, "amount")),
        note: str(d, "note"),
      }),
      `Held: advance ${money(t.advance_held)} · deposit ${money(t.deposit_held)}. Record only money already received or returned.`,
    );
  }
  function moveOut(t: Tenancy) {
    showAction(
      "Complete move-out",
      [
        {
          name: "end_date",
          label: "Move-out date",
          type: "date",
          value: view.today,
        },
        {
          name: "final_bill_id",
          label: "Final month",
          options: [
            { value: "", label: "No deposit application" },
            ...view.bills
              .filter((b) => b.tenancy_id === t.id && b.status === "unpaid")
              .map((b) => ({
                value: b.id,
                label: monthLabel(b.period) + " · " + money(b.amount),
              })),
          ],
          required: false,
        },
        {
          name: "apply_deposit",
          label: "Use deposit for the full final bill",
          type: "checkbox",
        },
        {
          name: "refund_advance",
          label: "Advance has been refunded",
          type: "checkbox",
        },
        {
          name: "refund_deposit",
          label: "Remaining deposit has been refunded",
          type: "checkbox",
        },
      ],
      (d) => ({
        type: "tenancy.end",
        id: t.id,
        end_date: str(d, "end_date"),
        final_bill_id: str(d, "final_bill_id") || null,
        apply_deposit: d.has("apply_deposit"),
        refund_advance: d.has("refund_advance"),
        refund_deposit: d.has("refund_deposit"),
      }),
      "Resolve pending payments first. The account becomes read-only. Refund selections record money you have already returned.",
    );
  }
  function ledger(list: Bill[]) {
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {owner && <th>Renter</th>}
              <th>Month</th>
              <th>Due date</th>
              <th>Amount</th>
              <th>Status</th>
              <th>
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((b) => {
              const status = billStatus(b, view.payments, view.today);
              return (
                <tr key={b.id}>
                  {owner && (
                    <td>
                      <strong>{name(b.renter_id)}</strong>
                      <small>{roomName(b.renter_id)}</small>
                    </td>
                  )}
                  <td>{monthLabel(b.period)}</td>
                  <td>{date(b.due_date)}</td>
                  <td className="amount">{money(b.amount)}</td>
                  <td>
                    <span className={`badge ${status}`}>{status}</span>
                  </td>
                  <td>
                    {b.status === "unpaid" &&
                      status !== "pending" &&
                      writable && (
                        <button className="text-button" onClick={() => pay(b)}>
                          {owner ? "Record" : "Pay"} <ArrowUpRight size={14} />
                        </button>
                      )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!list.length && (
          <p className="empty">
            No bills for this period. Bills appear three days before the due
            date.
          </p>
        )}
      </div>
    );
  }
  const nav = owner
    ? ([
        ["Overview", LayoutDashboard],
        ["Renters", UsersRound],
        ["Rooms", DoorOpen],
        ["Payments", Wallet],
        ["Reports", ReceiptText],
        ["Settings", Settings],
      ] as const)
    : ([
        ["Home", House],
        ["Bills", ReceiptText],
        ["Payments", Wallet],
        ["Account", UserRound],
      ] as const);
  const selected = owner
    ? nav.some(([label]) => label === page)
      ? page
      : "Overview"
    : nav.some(([label]) => label === page)
      ? page
      : "Home";
  return (
    <div className={owner ? "app owner" : "app renter"}>
      <aside className="sidebar">
        <div className="brand">
          <img className="mark" src="/rentmate-brand-v1.webp" alt="" width={40} height={40} fetchPriority="high" />
          Rentmate
        </div>
        <p className="property">{view.settings.property_name}</p>
        <nav>
          {nav.map(([label, Icon]) => (
            <button
              key={label}
              className={selected === label ? "active" : ""}
              onClick={() => setPage(label)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {label === "Payments" && pending.length > 0 && (
                <span className="count">{pending.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="avatar">{initials(view.viewer.full_name)}</span>
          <div>
            <strong>{view.viewer.full_name}</strong>
            <small>{owner ? "Property owner" : "Your space, simplified"}</small>
          </div>
          <button
            className="icon-button"
            aria-label="Sign out"
            onClick={async () => {
              try {
                await request("/api/auth/logout", {});
                setState(null);
                setNotice("");
                setError("");
                setModal(null);
                setPage("Overview");
                setPasswordGate(false);
              } catch (e: any) {
                setError(e.message);
              }
            }}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <main className="workspace">
        <header className="page-head">
          <div>
            <p className="eyebrow">
              {owner ? "YOUR PROPERTY, AT A GLANCE" : roomName(view.viewer.id)}
            </p>
            <h1>
              {selected === "Home" || selected === "Overview" ? (
                <>Hello, <strong>{view.viewer.full_name.split(" ")[0]}</strong>.</>
              ) : (
                selected
              )}
            </h1>
          </div>
          {owner && selected === "Overview" && (
            <button className="button primary" onClick={() => pay()}>
              <Plus size={17} />
              Record payment
            </button>
          )}
          {owner && selected === "Renters" && (
            <button
              className="button primary"
              disabled={!view.rooms.length}
              onClick={() => editRenter()}
            >
              <Plus size={17} />
              Add renter
            </button>
          )}
          {owner && selected === "Rooms" && (
            <button className="button primary" onClick={() => editRoom()}>
              <Plus size={17} />
              Add room
            </button>
          )}
        </header>
        {notice && (
          <div className="notice" role="status">
            <span>{notice}</span>
            <button onClick={() => setNotice("")}>Dismiss</button>
          </div>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {!writable && (
          <p className="notice">
            Your tenancy has ended. Your records remain available here.
          </p>
        )}
        {owner && (selected === "Overview" || selected === "Reports") && (
          <>
            <div className="section-heading">
              <h2>{monthLabel(currentMonth)}</h2>
              <input
                aria-label="Report month"
                type="month"
                value={currentMonth}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>
            <section className="metrics">
              <div>
                <p>Rent collected</p>
                <strong>{money(collected)}</strong>
                <small>
                  <span className="dot" /> Approved payments received this month
                </small>
              </div>
              <div>
                <p>Unpaid rent</p>
                <strong>{money(unpaid)}</strong>
                <small>
                  {bills.filter((b) => b.status === "unpaid").length} monthly
                  bills outstanding
                </small>
              </div>
              <div>
                <p>Awaiting review</p>
                <strong>{pending.length.toString().padStart(2, "0")}</strong>
                <small>Payment proofs to check</small>
              </div>
            </section>
            {selected === "Overview" && (
              <div className="columns">
                <section className="panel">
                  <div className="panel-head">
                    <h2>Ready for your review</h2>
                    <span className="count">{pending.length}</span>
                  </div>
                  {pending.slice(0, 4).map((p) => (
                    <button
                      className="list-row clickable"
                      key={p.id}
                      onClick={() => review(p)}
                    >
                      <span className="avatar">
                        {initials(name(p.renter_id))}
                      </span>
                      <div className="grow">
                        <strong>{name(p.renter_id)}</strong>
                        <small>
                          {roomName(p.renter_id)} · {p.method.toUpperCase()}
                        </small>
                      </div>
                      <div className="right">
                        <strong>{money(p.amount)}</strong>
                        <small>
                          Review <ArrowUpRight size={12} />
                        </small>
                      </div>
                    </button>
                  ))}
                  {!pending.length && (
                    <div className="empty">
                      <Check size={22} />
                      <p>All caught up. No payments to review.</p>
                    </div>
                  )}
                </section>
                <section className="panel">
                  <div className="panel-head">
                    <h2>Your rooms</h2>
                    <button
                      className="text-button"
                      onClick={() => setPage("Rooms")}
                    >
                      View all <ArrowUpRight size={14} />
                    </button>
                  </div>
                  {view.rooms.slice(0, 4).map((r) => (
                    <div className="list-row" key={r.id}>
                      <span className="room-icon">
                        <DoorOpen size={20} />
                      </span>
                      <div className="grow">
                        <strong>{r.name}</strong>
                        <small>
                          {active.filter((t) => t.room_id === r.id).length} of{" "}
                          {r.capacity} occupied
                        </small>
                      </div>
                      <span className="badge">
                        {active.filter((t) => t.room_id === r.id).length ===
                        r.capacity
                          ? "Full"
                          : "Available"}
                      </span>
                    </div>
                  ))}
                  {!view.rooms.length && (
                    <button
                      className="empty text-button"
                      onClick={() => editRoom()}
                    >
                      Add your first room
                    </button>
                  )}
                </section>
              </div>
            )}
            <section className="panel ledger">
              <div className="panel-head">
                <h2>Monthly ledger</h2>
                <span className="muted">{bills.length} bills</span>
              </div>
              {ledger(bills)}
            </section>
          </>
        )}
        {selected === "Rooms" && (
          <div className="card-grid">
            {view.rooms.map((r) => (
              <section className="panel detail-card" key={r.id}>
                <DoorOpen className="feature-icon" />
                <h2>{r.name}</h2>
                <p className="muted">
                  {active.filter((t) => t.room_id === r.id).length} /{" "}
                  {r.capacity} occupied
                </p>
                <p>{r.notes}</p>
                {active
                  .filter((t) => t.room_id === r.id)
                  .map((t) => (
                    <p key={t.id}>
                      {name(t.renter_id)}{" "}
                      <span className="muted">· <strong>{money(t.monthly_rent)}</strong></span>
                    </p>
                  ))}
                <button className="button" onClick={() => editRoom(r)}>
                  Edit room
                </button>
              </section>
            ))}
          </div>
        )}
        {selected === "Renters" && (
          <div className="card-grid">
            {view.profiles
              .filter((p) => p.role === "renter")
              .map((p) => {
                const t = tenancy(p.id);
                return (
                  <section className="panel detail-card" key={p.id}>
                    <div className="section-heading">
                      <span className="avatar large">
                        {initials(p.full_name)}
                      </span>
                      <span
                        className={`badge ${t?.status === "active" ? "approved" : ""}`}
                      >
                        {t?.status || "No tenancy"}
                      </span>
                    </div>
                    <h2>{p.full_name}</h2>
                    <p className="muted">
                      {p.username} · {p.phone || "No phone added"}
                    </p>
                    {t && (
                      <>
                        <p>
                          {roomName(p.id)} · <strong>{money(t.monthly_rent)}</strong> / month
                        </p>
                        <p className="fine">
                          Due day {t.due_day} · Moved in {date(t.start_date)}
                        </p>
                        <div className="held">
                          <span>
                            Advance <strong>{money(t.advance_held)}</strong>
                          </span>
                          <span>
                            Deposit <strong>{money(t.deposit_held)}</strong>
                          </span>
                        </div>
                        <div className="button-row">
                          {t.status === "active" && (
                            <button
                              className="button"
                              onClick={() => editRenter(p)}
                            >
                              Edit
                            </button>
                          )}
                          <button className="button" onClick={() => funds(t)}>
                            Funds
                          </button>
                          <button
                            className="button"
                            onClick={() =>
                              showAction(
                                "Reset password",
                                [],
                                () => ({
                                  type: "password.reset",
                                  renter_id: p.id,
                                }),
                                "A new temporary password will replace the current password.",
                              )
                            }
                          >
                            Reset password
                          </button>
                          {t.status === "active" && (
                            <button
                              className="text-button danger"
                              onClick={() => moveOut(t)}
                            >
                              Move out
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </section>
                );
              })}
            {!view.profiles.some((p) => p.role === "renter") && (
              <p className="empty">
                Add a room, then create your first renter account.
              </p>
            )}
          </div>
        )}
        {selected === "Payments" && (
          <section className="panel">
            <div className="panel-head">
              <h2>Payment history</h2>
              {owner && (
                <button className="text-button" onClick={() => pay()}>
                  <Plus size={15} />
                  Record payment
                </button>
              )}
            </div>
            {[...view.payments]
              .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))
              .map((p) => (
                <button
                  className="list-row clickable"
                  onClick={() => review(p)}
                  key={p.id}
                >
                  <span className={`payment-icon ${p.status}`}>
                    {p.status === "approved" ? (
                      <Check size={18} />
                    ) : (
                      <Clock3 size={18} />
                    )}
                  </span>
                  <div className="grow">
                    <strong>
                      {owner
                        ? name(p.renter_id)
                        : monthLabel(
                            view.bills.find((b) => b.id === p.bill_id)
                              ?.period || p.received_on.slice(0, 7),
                          )}
                    </strong>
                    <small>
                      {date(p.received_on)} · {p.method.toUpperCase()}
                    </small>
                  </div>
                  <div className="right">
                    <strong>{money(p.amount)}</strong>
                    <span className={`badge ${p.status}`}>{p.status}</span>
                  </div>
                </button>
              ))}
            {!view.payments.length && (
              <p className="empty">No payment records yet.</p>
            )}
          </section>
        )}
        {selected === "Home" && (
          <>
            {(() => {
              const next = [...view.bills]
                .filter((b) => b.status === "unpaid")
                .sort((a, b) => b.period.localeCompare(a.period))[0];
              const status = next
                ? billStatus(next, view.payments, view.today)
                : null;
              return (
                <section className="panel rent-card">
                  <div className="section-heading">
                    <span>{next ? monthLabel(next.period) : "Your rent"}</span>
                    <span className={`badge ${status || "paid"}`}>
                      {status || "All settled"}
                    </span>
                  </div>
                  <div className="rent-amount">{money(next?.amount || 0)}</div>
                  <p className="muted">
                    {next
                      ? `Due ${date(next.due_date)}`
                      : "You have no unpaid bills."}
                  </p>
                  {next && writable && status !== "pending" && (
                    <button
                      className="button primary full"
                      onClick={() => pay(next)}
                    >
                      Pay rent <ArrowUpRight size={17} />
                    </button>
                  )}
                  {status === "pending" && (
                    <p className="fine">
                      Your payment is waiting for the owner’s review.
                    </p>
                  )}
                  <p className="fine">
                    Full monthly payments · Verified by your owner
                  </p>
                </section>
              );
            })()}
            {view.bills.filter((b) => b.status === "unpaid").length > 1 && (
              <button className="older-bill" onClick={() => setPage("Bills")}>
                <Clock3 size={17} />
                You have other unpaid months. View bills{" "}
                <ArrowUpRight size={14} />
              </button>
            )}
            <div className="section-heading">
              <h2>Recent payments</h2>
              <button
                className="text-button"
                onClick={() => setPage("Payments")}
              >
                View all
              </button>
            </div>
            <section className="panel">
              {[...view.payments]
                .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))
                .slice(0, 3)
                .map((p) => (
                  <button
                    className="list-row clickable"
                    key={p.id}
                    onClick={() => review(p)}
                  >
                    <span className={`payment-icon ${p.status}`}>
                      {p.status === "approved" ? <Check size={17} /> : <Clock3 size={17} />}
                    </span>
                    <div className="grow">
                      <strong>
                        {monthLabel(
                          view.bills.find((b) => b.id === p.bill_id)?.period ||
                            p.received_on.slice(0, 7),
                        )}
                      </strong>
                      <small>{date(p.received_on)}</small>
                    </div>
                    <div className="right">
                      <strong>{money(p.amount)}</strong>
                      <small>{p.status}</small>
                    </div>
                  </button>
                ))}
              {!view.payments.length && (
                <p className="empty">Your payments will appear here.</p>
              )}
            </section>
            {mine && (
              <p className="holding">
                <ShieldCheck size={18} />
                <span>
                  Advance held: <strong>{money(mine.advance_held)}</strong>
                  <br />
                  Deposit held: <strong>{money(mine.deposit_held)}</strong>
                </span>
              </p>
            )}
          </>
        )}
        {selected === "Bills" && (
          <section className="panel">
            {ledger(
              [...view.bills].sort((a, b) => b.period.localeCompare(a.period)),
            )}
          </section>
        )}
        {(selected === "Settings" || selected === "Account") && (
          <>
            <section className="panel detail-card">
              <h2>{owner ? "Payment details" : "Your account"}</h2>
              {owner ? (
                <>
                  <p className="muted">Renter payment instructions</p>
                  <dl>
                    <dt>Property</dt>
                    <dd>{view.settings.property_name}</dd>
                    <dt>GCash name</dt>
                    <dd>{view.settings.gcash_name || "Not set"}</dd>
                    <dt>GCash number</dt>
                    <dd>{view.settings.gcash_number || "Not set"}</dd>
                    <dt>Bank details</dt>
                    <dd>{view.settings.bank_details || "Not set"}</dd>
                  </dl>
                  <div className="button-row">
                    <button
                      className="button"
                      onClick={() =>
                        showAction(
                          "Property & payment details",
                          [
                            {
                              name: "property_name",
                              label: "Property name",
                              value: view.settings.property_name,
                            },
                            {
                              name: "gcash_name",
                              label: "GCash account name",
                              value: view.settings.gcash_name,
                              required: false,
                            },
                            {
                              name: "gcash_number",
                              label: "GCash number",
                              value: view.settings.gcash_number,
                              required: false,
                            },
                            {
                              name: "bank_details",
                              label: "Bank transfer instructions",
                              type: "textarea",
                              value: view.settings.bank_details,
                              required: false,
                            },
                          ],
                          (d) => ({
                            type: "settings.save",
                            property_name: str(d, "property_name"),
                            gcash_name: str(d, "gcash_name"),
                            gcash_number: str(d, "gcash_number"),
                            bank_details: str(d, "bank_details"),
                          }),
                        )
                      }
                    >
                      Edit details
                    </button>
                    <button
                      className="button"
                      onClick={() =>
                        setModal({
                          title: "GCash QR code",
                          fields: [
                            { name: "file", label: "QR image", type: "file" },
                          ],
                          run: async (d) => {
                            d.set("kind", "qr");
                            await upload(d);
                          },
                        })
                      }
                    >
                      Upload QR
                    </button>
                  </div>
                  {view.settings.gcash_qr_path && (
                    <img
                      className="qr"
                      src={imagePath(view.settings.gcash_qr_path)}
                      alt="GCash QR code"
                    />
                  )}
                </>
              ) : (
                <dl>
                  <dt>Name</dt>
                  <dd>{view.viewer.full_name}</dd>
                  <dt>Username</dt>
                  <dd>{view.viewer.username}</dd>
                  <dt>Phone</dt>
                  <dd>{view.viewer.phone || "Not set"}</dd>
                  <dt>Room</dt>
                  <dd>{roomName(view.viewer.id)}</dd>
                  {mine && (
                    <>
                      <dt>Monthly rent</dt>
                      <dd><strong>{money(mine.monthly_rent)}</strong></dd>
                      <dt>Advance held</dt>
                      <dd><strong>{money(mine.advance_held)}</strong></dd>
                      <dt>Deposit held</dt>
                      <dd><strong>{money(mine.deposit_held)}</strong></dd>
                    </>
                  )}
                </dl>
              )}
            </section>
            <section className="panel detail-card">
              <h2>Security & app</h2>
              <p className="muted">
                Internet is required to access your records.
              </p>
              <div className="button-row">
                <button className="button" onClick={changePassword}>
                  Change password
                </button>
                <button
                  className="button"
                  onClick={async () => {
                    if (install) {
                      await install.prompt();
                      setInstall(null);
                    } else
                      setNotice(
                        "Install Rentmate using your browser menu → Install app or Add to Home Screen. On iPhone, use Safari → Share → Add to Home Screen.",
                      );
                  }}
                >
                  <Download size={16} />
                  Install app
                </button>
              </div>
            </section>
            {!owner && (
              <section className="panel detail-card">
                <h2>Fund history</h2>
                {view.fund_events.map((f) => (
                  <div className="list-row" key={f.id}>
                    <div className="grow">
                      <strong>{f.kind.replaceAll("_", " ")}</strong>
                      <small>
                        {date(f.date)} · {f.note}
                      </small>
                    </div>
                    <strong>{money(f.amount)}</strong>
                  </div>
                ))}
                {!view.fund_events.length && (
                  <p className="muted">No fund transactions yet.</p>
                )}
              </section>
            )}
          </>
        )}
        <footer>
          Rentmate <span>·</span> A little less paperwork.
        </footer>
      </main>
      {modal && <FormDialog spec={modal} close={() => setModal(null)} />}
    </div>
  );
}
