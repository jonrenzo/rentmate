"use client";

import { useState } from "react";
import { Copy, Download, Landmark, Wallet } from "lucide-react";

type PaymentDetails = {
  gcash_name: string;
  gcash_number: string;
  gcash_qr_path: string | null;
  bank_details: string;
};

export function PaymentMethod({ settings }: { settings: PaymentDetails }) {
  const [method, setMethod] = useState("gcash");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const qrUrl = settings.gcash_qr_path
    ? `/api/file?path=${encodeURIComponent(settings.gcash_qr_path)}`
    : null;

  async function copyNumber() {
    setStatus("");
    setError("");
    try {
      await navigator.clipboard.writeText(settings.gcash_number.trim());
      setStatus("GCash number copied.");
    } catch {
      setError("Copy is unavailable. Press and hold the number above to copy it manually.");
    }
  }

  async function saveQr() {
    if (!qrUrl) return;
    setSaving(true);
    setStatus("");
    setError("");
    try {
      const response = await fetch(qrUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("QR download failed");
      const blob = await response.blob();
      const extension = ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" })[blob.type];
      if (!extension) throw new Error("Invalid QR image");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `rentmate-gcash-qr.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setStatus("QR download started. In GCash, tap QR, then upload the saved image.");
    } catch {
      setError("Couldn't save the QR. Use the Open QR image link and save it from your browser.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <label className="field">
        Payment method
        <select name="method" value={method} required onChange={(event) => {
          setMethod(event.target.value);
          setStatus("");
          setError("");
        }}>
          <option value="gcash">GCash</option>
          <option value="bank">Bank transfer</option>
        </select>
      </label>
      <section className="instructions payment-instructions" aria-label={`${method === "bank" ? "Bank transfer" : "GCash"} instructions`}>
        <h3>{method === "bank" ? <Landmark size={18} /> : <Wallet size={18} />}
          {method === "bank" ? "Pay by bank transfer" : "Pay with GCash"}
        </h3>
        {method === "bank" ? (
          <>
            <p>{settings.bank_details.trim() || "Bank details haven't been added. Ask the owner before transferring."}</p>
            <p className="fine">Use these bank details for your transfer, then submit the bank reference number and payment screenshot below.</p>
          </>
        ) : (
          <>
            <strong>{settings.gcash_name || "GCash account name not set"}</strong>
            <p className="payment-number">{settings.gcash_number || "Ask the owner for their GCash number."}</p>
            {qrUrl && <img className="qr" src={qrUrl} alt="Owner GCash payment QR" />}
            <div className="button-row">
              {settings.gcash_number.trim() && <button type="button" className="button" onClick={copyNumber}><Copy size={16} />Copy number</button>}
              {qrUrl && <button type="button" className="button" onClick={saveQr} disabled={saving}><Download size={16} />{saving ? "Saving QR…" : "Save QR"}</button>}
            </div>
            {qrUrl && <p className="fine">In GCash, tap QR and upload your saved image, or scan it from another screen. <a href={qrUrl} target="_blank" rel="noreferrer">Open QR image</a></p>}
          </>
        )}
        {method === "gcash" && status && <p role="status">{status}</p>}
        {method === "gcash" && error && <p role="alert" className="error">{error}</p>}
      </section>
    </>
  );
}
