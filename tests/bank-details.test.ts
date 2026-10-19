import { strict as assert } from "node:assert";
import { test } from "node:test";
import { formatBankDetails, parseBankDetails } from "../lib/bank-details";

test("bank details round-trip without losing leading zeros or multiline notes", () => {
  const details = { bank: "BPI", accountName: "Sample Owner", accountNumber: "0012 3456 7890", notes: "Use your rental month.\nKeep the reference number." };
  assert.deepEqual(parseBankDetails(formatBankDetails(details)), details);
});
test("legacy two-line details preserve the number and leave the unknown account name blank", () => {
  assert.deepEqual(parseBankDetails("BPI\r\n001234567890"), { bank: "BPI", accountName: "", accountNumber: "001234567890", notes: "" });
});
test("ambiguous legacy instructions are preserved instead of guessing account fields", () => {
  for (const notes of ["Contact owner for details", "BPI\nAccount A: 0123\nBDO\nAccount B: 0456", "Bank: BPI\nAccount number: 0123"]) {
    assert.deepEqual(parseBankDetails(notes), { bank: "", accountName: "", accountNumber: "", notes });
    assert.equal(formatBankDetails(parseBankDetails(notes)), notes);
  }
});
test("new bank details must be complete and cannot contain ambiguous line breaks", () => {
  const details = { bank: "BPI", accountName: "", accountNumber: "012345", notes: "" };
  assert.throws(() => formatBankDetails(details), /account name/);
  assert.throws(() => formatBankDetails({ ...details, accountName: "Owner\nExtra" }), /single line/);
  assert.throws(() => formatBankDetails({ ...details, accountName: "Owner", notes: "a".repeat(2000) }), /2,000/);
  assert.equal(formatBankDetails({ bank: "", accountName: "", accountNumber: "", notes: "" }), "");
});
