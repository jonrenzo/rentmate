import { parseBankDetails } from "@/lib/bank-details";

export function BankDetails({ value }: { value: string }) {
  const details = parseBankDetails(value);
  return (
    <div className="bank-details">
      <dl>
        <dt>Bank</dt><dd>{details.bank || "Not provided"}</dd>
        <dt>Account name</dt><dd>{details.accountName || "Not provided"}</dd>
        <dt>Account number</dt><dd className="bank-account-number">{details.accountNumber || "Not provided"}</dd>
      </dl>
      {details.notes && <div className="bank-notes"><strong>Transfer instructions</strong><p>{details.notes}</p></div>}
    </div>
  );
}
