"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import UploadPanel from "@/app/UploadPanel";
import {
  defaultIntakeData,
  mergeDefault,
  IntakeData,
  FilingStatus,
  Dependent,
} from "./intakeSchema";

type SubmissionRow = {
  id: string;
  status: string;
  data: any;
};

const steps = [
  "Contact & Identity", // page 1
  "Filing Info",
  "Dependents",
  "Income",
  "Deductions",
  "Credits",
  "Banking",
  "Consents & Signatures",
] as const;

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function isFullSSN(v: string) {
  const digits = (v || "").replace(/\D/g, "");
  return digits.length === 9;
}

export default function IntakePage() {
  const router = useRouter();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Draft");
  const [stepIndex, setStepIndex] = useState(0);

  const [data, setData] = useState<IntakeData>(() => defaultIntakeData());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const currentStep = steps[stepIndex];

  // Guard: require login
  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) {
        router.replace("/login");
        return;
      }
      setCheckingAuth(false);
    })();
  }, [router]);

  // Load or create draft
  useEffect(() => {
    if (checkingAuth) return;

    (async () => {
      setErr(null);
      const { data: s } = await supabase.auth.getSession();
      const user = s.session?.user;
      if (!user) return;

      // find most recent submission for user
      const found = await supabase
        .from("intake_files")
        .select("id, storage_path, status,data")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (found.error) {
        setErr(found.error.message);
        return;
      }

      if (found.data && found.data.length > 0) {
        const row = found.data[0] as SubmissionRow;
        setSubmissionId(row.id);
        setStatus(row.status);
        setData(mergeDefault(row.data));
        return;
      }

      // create new draft
      const created = await supabase
        .from("intake_files")
        .insert({ user_id: user.id, status: "Draft", data: defaultIntakeData() })
        .select("id, storage_path, status,data")
        .single();

      if (created.error) {
        setErr(created.error.message);
        return;
      }

      setSubmissionId(created.data.id);
      setStatus(created.data.status);
      setData(mergeDefault(created.data.data));
    })();
  }, [checkingAuth]);

  // Autosave (debounced-ish)
  useEffect(() => {
    if (!submissionId) return;
    if (checkingAuth) return;

    const t = setTimeout(async () => {
      setSaving(true);
      setErr(null);

      const { error } = await supabase
        .from("intake_files")
        .update({ data, updated_at: new Date().toISOString() })
        .eq("id", submissionId);

      if (error) setErr(error.message);
      setSaving(false);
    }, 700);

    return () => clearTimeout(t);
  }, [data, submissionId, checkingAuth]);

  const locked = useMemo(() => status !== "Draft", [status]);

  function updateField<K extends keyof IntakeData>(key: K, value: IntakeData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function updateNested(path: string, value: any) {
    // simple helper for nested objects
    setData((prev) => {
      const clone: any = structuredClone(prev);
      const parts = path.split(".");
      let cur = clone;
      for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
      cur[parts[parts.length - 1]] = value;
      return clone;
    });
  }

  function addDependent() {
  const d: Dependent = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: "",
    relationship: "",
    dob: "",
    ssn: "",
    months_in_home: "",
    claimed_by_someone_else: false,
  };

  setData((prev) => ({
    ...prev,
    dependents: [...(prev.dependents ?? []), d],
  }));
}


  function removeDependent(i: number) {
    setData((p) => ({ ...p, dependents: p.dependents.filter((_, idx) => idx !== i) }));
  }

  function canGoNext(): boolean {
    setErr(null);

    if (currentStep === "Contact & Identity") {
      if (!data.legal_name.trim()) return false;
      if (!data.phone.trim()) return false;
      if (!data.email.trim() || !isValidEmail(data.email)) return false;
      if (!isFullSSN(data.ssn)) return false;
      if (!data.address1.trim() || !data.city.trim() || !data.state.trim() || !data.zip.trim())
        return false;
      // Require at least one ID upload file (we check via DB on Next click)
      return true;
    }

    if (currentStep === "Consents & Signatures") {
      if (!data.consent.agree_to_esign || !data.consent.agree_to_disclosures) return false;
      if (!data.consent.signature_name.trim()) return false;
      if (!data.consent.signature_date.trim()) return false;
    }

    return true;
  }

  async function ensureIdUploaded(): Promise<boolean> {
    if (!submissionId) return false;

    const { data: rows, error } = await supabase
      .from("storage_path")
      .select("id, storage_path")
      .eq("intake_files", submissionId)
      .eq("category", "id")
      .limit(1);

    if (error) {
      setErr(error.message);
      return false;
    }
    return (rows || []).length > 0;
  }

  async function onNext() {
    if (locked) return;

    // normal validation
    if (!canGoNext()) {
      setErr("Please complete required fields before continuing.");
      return;
    }

    // extra validation for ID uploads on page 1
    if (currentStep === "Contact & Identity") {
      const ok = await ensureIdUploaded();
      if (!ok) {
        setErr("Please upload your Driver’s License/ID before continuing.");
        return;
      }
    }

    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }

  function onBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function submitIntake() {
    if (!submissionId) return;
    if (locked) return;

    if (!canGoNext()) {
      setErr("Please complete required fields before submitting.");
      return;
    }

    setSaving(true);
    setErr(null);

    const { data, error } = await supabase
  .from("storage_path")
  .select("id, storage_path")
  .eq("intake_files",  submissionId)
  .eq("category", "id")
  .limit(1);


    if (error) {
      setErr(error.message);
      setSaving(false);
      return;
    }

    setStatus("Submitted");
    setSaving(false);
  }

  if (checkingAuth) return null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Tax Intake</h1>
          <p className="text-sm text-gray-600">
            Status: <span className="font-medium">{status}</span>{" "}
            {saving ? <span className="ml-2 text-gray-500">(Saving...)</span> : null}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="rounded border px-3 py-2 text-sm"
          >
            Exit
          </button>

          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              router.replace("/");
            }}
            className="rounded border px-3 py-2 text-sm"
          >
            Sign out
          </button>
        </div>
      </div>

      {err ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      ) : null}

      {/* Step tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {steps.map((s, idx) => (
          <button
            key={s}
            type="button"
            className={`rounded px-3 py-2 text-sm border ${
              idx === stepIndex ? "bg-teal-700 text-white border-teal-700" : "bg-white"
            }`}
            onClick={() => setStepIndex(idx)}
          >
            {idx + 1}. {s}
          </button>
        ))}
      </div>

      <section className="rounded border bg-white p-6">
        {/* STEP 1 */}
        {currentStep === "Contact & Identity" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium">Legal Name *</label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={data.legal_name}
                  disabled={locked}
                  onChange={(e) => updateField("legal_name", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Phone *</label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={data.phone}
                  disabled={locked}
                  onChange={(e) => updateField("phone", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Email *</label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={data.email}
                  disabled={locked}
                  onChange={(e) => updateField("email", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Taxpayer SSN (Full) *</label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={data.ssn}
                  disabled={locked}
                  onChange={(e) => updateField("ssn", e.target.value)}
                  placeholder="XXX-XX-XXXX"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium">Address Line 1 *</label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={data.address1}
                  disabled={locked}
                  onChange={(e) => updateField("address1", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Address Line 2</label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={data.address2}
                  disabled={locked}
                  onChange={(e) => updateField("address2", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium">City *</label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={data.city}
                  disabled={locked}
                  onChange={(e) => updateField("city", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium">State *</label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={data.state}
                  disabled={locked}
                  onChange={(e) => updateField("state", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium">ZIP *</label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={data.zip}
                  disabled={locked}
                  onChange={(e) => updateField("zip", e.target.value)}
                />
              </div>
            </div>

            {submissionId ? (
              <div className="pt-2">
                <UploadPanel
                  intakeSubmissionId={submissionId}
                  category="id"
                  disabled={locked}
                  title="Upload Driver’s License / ID (Required)"
                  helpText="Upload at least one image or PDF of your ID to continue."
                />
              </div>
            ) : null}
          </div>
        )}

        {/* STEP 2 */}
        {currentStep === "Filing Info" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Filing Status *</label>
              <select
                className="mt-1 w-full rounded border px-3 py-2"
                value={data.filing_status}
                disabled={locked}
                onChange={(e) => updateField("filing_status", e.target.value as FilingStatus)}
              >
                <option value="">Select...</option>
                <option value="Single">Single</option>
                <option value="Married Filing Jointly">Married Filing Jointly</option>
                <option value="Married Filing Separately">Married Filing Separately</option>
                <option value="Head of Household">Head of Household</option>
                <option value="Qualifying Surviving Spouse">Qualifying Surviving Spouse</option>
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium">Spouse Name</label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={data.spouse_name}
                  disabled={locked}
                  onChange={(e) => updateField("spouse_name", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Spouse DOB</label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={data.spouse_dob}
                  disabled={locked}
                  onChange={(e) => updateField("spouse_dob", e.target.value)}
                  placeholder="mm/dd/yyyy"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Spouse SSN (Full)</label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={data.spouse_ssn}
                  disabled={locked}
                  onChange={(e) => updateField("spouse_ssn", e.target.value)}
                  placeholder="XXX-XX-XXXX"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {currentStep === "Dependents" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Dependents</h2>
              <button
                type="button"
                onClick={addDependent}
                disabled={locked}
                className="rounded bg-teal-700 px-3 py-2 text-sm text-white disabled:opacity-60"
              >
                Add Dependent
              </button>
            </div>

            {data.dependents.length === 0 ? (
              <p className="text-sm text-gray-600">No dependents added.</p>
            ) : (
              <div className="space-y-4">
                {data.dependents.map((d, i) => (
                  <div key={i} className="rounded border p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-sm font-medium">Dependent #{i + 1}</div>
                      <button
                        type="button"
                        onClick={() => removeDependent(i)}
                        disabled={locked}
                        className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div>
                        <label className="block text-sm font-medium">Full Name</label>
                        <input
                          className="mt-1 w-full rounded border px-3 py-2"
                          value={d.name}
                          disabled={locked}
                          onChange={(e) =>
                            setData((p) => {
                              const copy = structuredClone(p);
                              copy.dependents[i].name = e.target.value;
                              return copy;
                            })
                          }
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium">Relationship</label>
                        <input
                          className="mt-1 w-full rounded border px-3 py-2"
                          value={d.relationship}
                          disabled={locked}
                          onChange={(e) =>
                            setData((p) => {
                              const copy = structuredClone(p);
                              copy.dependents[i].relationship = e.target.value;
                              return copy;
                            })
                          }
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium">DOB</label>
                        <input
                          className="mt-1 w-full rounded border px-3 py-2"
                          value={d.dob}
                          disabled={locked}
                          placeholder="mm/dd/yyyy"
                          onChange={(e) =>
                            setData((p) => {
                              const copy = structuredClone(p);
                              copy.dependents[i].dob = e.target.value;
                              return copy;
                            })
                          }
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium">SSN (Full)</label>
                        <input
                          className="mt-1 w-full rounded border px-3 py-2"
                          value={d.ssn}
                          disabled={locked}
                          placeholder="XXX-XX-XXXX"
                          onChange={(e) =>
                            setData((p) => {
                              const copy = structuredClone(p);
                              copy.dependents[i].ssn = e.target.value;
                              return copy;
                            })
                          }
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium">Months in Home</label>
                        <input
                          className="mt-1 w-full rounded border px-3 py-2"
                          value={d.months_in_home}
                          disabled={locked}
                          onChange={(e) =>
                            setData((p) => {
                              const copy = structuredClone(p);
                              copy.dependents[i].months_in_home = e.target.value;
                              return copy;
                            })
                          }
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-6">
                        <input
                          type="checkbox"
                          checked={d.claimed_by_someone_else}
                          disabled={locked}
                          onChange={(e) =>
                            setData((p) => {
                              const copy = structuredClone(p);
                              copy.dependents[i].claimed_by_someone_else = e.target.checked;
                              return copy;
                            })
                          }
                        />
                        <label className="text-sm">
                          Claimed by someone else?
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 4 */}
        {currentStep === "Income" && (
          <div className="space-y-6">
            <div className="rounded border p-4">
              <h2 className="text-sm font-semibold">Income Sources</h2>

              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                {[
                  ["W-2", "income_sources.w2"],
                  ["Unemployment (1099-G)", "income_sources.unemployment_1099g"],
                  ["Social Security (SSA-1099)", "income_sources.ssa_1099"],
                  ["Self-employed / Business income", "income_sources.self_employed"],
                  ["Interest (1099-INT)", "income_sources.interest_1099int"],
                  ["Dividends (1099-DIV)", "income_sources.dividends_1099div"],
                  ["IRA/Pension (1099-R)", "income_sources.ira_pension_1099r"],
                  ["Brokerage (1099-B)", "income_sources.brokerage_1099b"],
                ].map(([label, path]) => (
                  <label key={path} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      disabled={locked}
                      checked={Boolean((data as any).income_sources?.[path.split(".")[1]])}
                      onChange={(e) => updateNested(path, e.target.checked)}
                    />
                    {label}
                  </label>
                ))}
              </div>

              <div className="mt-3">
                <label className="block text-sm font-medium">Other Income Notes</label>
                <textarea
                  className="mt-1 w-full rounded border px-3 py-2"
                  rows={3}
                  disabled={locked}
                  value={data.income_sources.other}
                  onChange={(e) => updateNested("income_sources.other", e.target.value)}
                />
              </div>
            </div>

            {/* upload income forms on same step */}
            {submissionId ? (
              <UploadPanel
                intakeSubmissionId={submissionId}
                category="income"
                disabled={locked}
                title="Upload Income Forms"
                helpText="Upload W-2, 1099s, SSA-1099, 1099-R, 1099-B, etc."
              />
            ) : null}

            {/* business section if self-employed */}
            {data.income_sources.self_employed ? (
              <div className="rounded border bg-white p-4">
                <h3 className="text-sm font-semibold">Business Information</h3>

                <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium">Business Name</label>
                    <input
                      className="mt-1 w-full rounded border px-3 py-2"
                      disabled={locked}
                      value={data.business.business_name}
                      onChange={(e) => updateNested("business.business_name", e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium">Legal Name (if different)</label>
                    <input
                      className="mt-1 w-full rounded border px-3 py-2"
                      disabled={locked}
                      value={data.business.legal_name}
                      onChange={(e) => updateNested("business.legal_name", e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium">EIN</label>
                    <input
                      className="mt-1 w-full rounded border px-3 py-2"
                      disabled={locked}
                      value={data.business.ein}
                      onChange={(e) => updateNested("business.ein", e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium">Business Type</label>
                    <input
                      className="mt-1 w-full rounded border px-3 py-2"
                      disabled={locked}
                      value={data.business.business_type}
                      onChange={(e) => updateNested("business.business_type", e.target.value)}
                      placeholder="Sole Prop, LLC, S-Corp, etc."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium">Business Address</label>
                    <input
                      className="mt-1 w-full rounded border px-3 py-2"
                      disabled={locked}
                      value={data.business.business_address}
                      onChange={(e) => updateNested("business.business_address", e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium">Start Date</label>
                    <input
                      className="mt-1 w-full rounded border px-3 py-2"
                      disabled={locked}
                      value={data.business.started_date}
                      onChange={(e) => updateNested("business.started_date", e.target.value)}
                      placeholder="mm/dd/yyyy"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium">Bookkeeping Method</label>
                    <select
                      className="mt-1 w-full rounded border px-3 py-2"
                      disabled={locked}
                      value={data.business.bookkeeping_method}
                      onChange={(e) =>
                        updateNested("business.bookkeeping_method", e.target.value)
                      }
                    >
                      <option value="">Select...</option>
                      <option value="Cash">Cash</option>
                      <option value="Accrual">Accrual</option>
                    </select>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* STEP 5 */}
        {currentStep === "Deductions" && (
          <div className="space-y-6">
            <div className="rounded border p-4">
              <h2 className="text-sm font-semibold">Deductions</h2>

              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                {[
                  ["Student loan interest", "deductions.student_loan_interest"],
                  ["IRA contributions", "deductions.ira_contributions"],
                  ["HSA contributions", "deductions.hsa_contributions"],
                  ["Educator expenses", "deductions.educator_expenses"],
                  ["Mortgage interest (1098)", "deductions.mortgage_interest_1098"],
                  ["Property taxes", "deductions.property_taxes"],
                  ["Charitable contributions", "deductions.charitable_contributions"],
                  ["Medical expenses", "deductions.medical_expenses"],
                ].map(([label, path]) => (
                  <label key={path} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      disabled={locked}
                      checked={Boolean((data as any).deductions?.[path.split(".")[1]])}
                      onChange={(e) => updateNested(path, e.target.checked)}
                    />
                    {label}
                  </label>
                ))}
              </div>

              <div className="mt-3">
                <label className="block text-sm font-medium">Other deductions</label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  disabled={locked}
                  value={data.deductions.other}
                  onChange={(e) => updateNested("deductions.other", e.target.value)}
                />
              </div>

              <div className="mt-3">
                <label className="block text-sm font-medium">Deductions Notes</label>
                <textarea
                  className="mt-1 w-full rounded border px-3 py-2"
                  rows={3}
                  disabled={locked}
                  value={data.deductions_notes}
                  onChange={(e) => updateField("deductions_notes", e.target.value)}
                />
              </div>
            </div>

            {submissionId ? (
              <UploadPanel
                intakeSubmissionId={submissionId}
                category="deductions"
                disabled={locked}
                title="Upload Deductions Documents"
                helpText="Upload receipts, 1098, donation receipts, medical totals, etc."
              />
            ) : null}
          </div>
        )}

        {/* STEP 6 */}
        {currentStep === "Credits" && (
          <div className="space-y-6">
            <div className="rounded border p-4">
              <h2 className="text-sm font-semibold">Credits</h2>

              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                {[
                  ["Child Tax Credit", "credits.child_tax_credit"],
                  ["Child Care", "credits.child_care"],
                  ["Education", "credits.education"],
                  ["Retirement Saver’s", "credits.retirement_savers"],
                  ["Earned Income", "credits.earned_income"],
                  ["EV Credit", "credits.ev_credit"],
                ].map(([label, path]) => (
                  <label key={path} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      disabled={locked}
                      checked={Boolean((data as any).credits?.[path.split(".")[1]])}
                      onChange={(e) => updateNested(path, e.target.checked)}
                    />
                    {label}
                  </label>
                ))}
              </div>

              <div className="mt-3">
                <label className="block text-sm font-medium">Other credits</label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  disabled={locked}
                  value={data.credits.other}
                  onChange={(e) => updateNested("credits.other", e.target.value)}
                />
              </div>

              <div className="mt-3">
                <label className="block text-sm font-medium">Credits Notes</label>
                <textarea
                  className="mt-1 w-full rounded border px-3 py-2"
                  rows={3}
                  disabled={locked}
                  value={data.credits_notes}
                  onChange={(e) => updateField("credits_notes", e.target.value)}
                />
              </div>
            </div>

            {submissionId ? (
              <UploadPanel
                intakeSubmissionId={submissionId}
                category="credits"
                disabled={locked}
                title="Upload Credits Documents"
                helpText="Upload 1098-T, childcare provider info, EV purchase docs, etc."
              />
            ) : null}
          </div>
        )}

        {/* STEP 7 */}
        {currentStep === "Banking" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium">Routing Number</label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  disabled={locked}
                  value={data.banking.routing_number}
                  onChange={(e) => updateNested("banking.routing_number", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Account Number</label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  disabled={locked}
                  value={data.banking.account_number}
                  onChange={(e) => updateNested("banking.account_number", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Account Type</label>
                <select
                  className="mt-1 w-full rounded border px-3 py-2"
                  disabled={locked}
                  value={data.banking.account_type}
                  onChange={(e) => updateNested("banking.account_type", e.target.value)}
                >
                  <option value="">Select...</option>
                  <option value="Checking">Checking</option>
                  <option value="Savings">Savings</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium">Bank Name</label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  disabled={locked}
                  value={data.banking.bank_name}
                  onChange={(e) => updateNested("banking.bank_name", e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 8 */}
        {currentStep === "Consents & Signatures" && (
          <div className="space-y-4">
            <div className="rounded border p-4">
              <h2 className="text-sm font-semibold">Consents</h2>

              <label className="mt-3 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={locked}
                  checked={data.consent.agree_to_esign}
                  onChange={(e) => updateNested("consent.agree_to_esign", e.target.checked)}
                />
                I agree to e-sign.
              </label>

              <label className="mt-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={locked}
                  checked={data.consent.agree_to_disclosures}
                  onChange={(e) =>
                    updateNested("consent.agree_to_disclosures", e.target.checked)
                  }
                />
                I agree to disclosures.
              </label>

              {/* 8879 ONLY HERE */}
              <div className="mt-4">
                <a href="/forms/8879.pdf" className="text-blue-600 underline" target="_blank">
                  Download IRS Form 8879 (E-File Authorization)
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium">Signature Name *</label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  disabled={locked}
                  value={data.consent.signature_name}
                  onChange={(e) => updateNested("consent.signature_name", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Signature Date *</label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  disabled={locked}
                  value={data.consent.signature_date}
                  onChange={(e) => updateNested("consent.signature_date", e.target.value)}
                  placeholder="mm/dd/yyyy"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={submitIntake}
                disabled={locked || saving}
                className="rounded bg-teal-700 px-4 py-2 text-white disabled:opacity-60"
              >
                {locked ? "Submitted" : saving ? "Submitting..." : "Submit Intake"}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Nav */}
      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={stepIndex === 0}
          className="rounded border px-4 py-2 disabled:opacity-60"
        >
          Back
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={stepIndex === steps.length - 1}
          className="rounded bg-teal-700 px-4 py-2 text-white disabled:opacity-60"
        >
          Next
        </button>
      </div>
    </main>
  );
}
