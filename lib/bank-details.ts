export type BankDetails = {
  bank: string;
  accountName: string;
  accountNumber: string;
  notes: string;
};

export function parseBankDetails(value: string): BankDetails {
  const text = value.trim();
  const lines = text.split(/\r?\n/);
  // Labeled text keeps the existing settings storage readable by older versions.
  const labeled = /^Bank: ([^\r\n]+)\r?\nAccount name: ([^\r\n]+)\r?\nAccount number: ([^\r\n]+)(?:\r?\n\r?\n([\s\S]*))?$/.exec(text);
  if (labeled) return { bank: labeled[1], accountName: labeled[2], accountNumber: labeled[3], notes: labeled[4] || "" };
  // Preserve the old two-line bank/number format without inventing an account name.
  if (lines.length === 2 && /^[\p{L} .&()-]+$/u.test(lines[0]) && /^[0-9][0-9 -]*$/.test(lines[1])) {
    return { bank: lines[0], accountName: "", accountNumber: lines[1], notes: "" };
  }
  return { bank: "", accountName: "", accountNumber: "", notes: text };
}

export function formatBankDetails(details: BankDetails): string {
  const bank = details.bank.trim();
  const accountName = details.accountName.trim();
  const accountNumber = details.accountNumber.trim();
  const notes = details.notes.trim();
  if (!bank && !accountName && !accountNumber) return notes;
  if (!bank || !accountName || !accountNumber) {
    throw new Error("Enter the bank, account name, and account number to complete the bank transfer details.");
  }
  if ([bank, accountName, accountNumber].some(value => /[\r\n]/.test(value))) {
    throw new Error("Keep each bank account field on a single line. Use transfer notes for extra instructions.");
  }
  const result = `Bank: ${bank}\nAccount name: ${accountName}\nAccount number: ${accountNumber}${notes ? `\n\n${notes}` : ""}`;
  if (result.length > 2000) throw new Error("Bank transfer details must be 2,000 characters or fewer.");
  return result;
}
