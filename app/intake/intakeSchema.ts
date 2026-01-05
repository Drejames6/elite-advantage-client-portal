export type FilingStatus =
  | "Single"
  | "Married Filing Jointly"
  | "Married Filing Separately"
  | "Head of Household"
  | "Qualifying Surviving Spouse";

export type Dependent = {
  id: string;
  name: string;
  relationship: string;
  dob: string;
  ssn: string;
  months_in_home: string;
  claimed_by_someone_else: boolean;
};

export type IncomeSources = {
  w2: boolean;
  unemployment_1099g: boolean;
  ssa_1099: boolean;
  self_employed: boolean; // toggles business section
  interest_1099int: boolean;
  dividends_1099div: boolean;
  ira_pension_1099r: boolean;
  brokerage_1099b: boolean;
  other: string;
};

export type BusinessInfo = {
  business_name: string;
  legal_name: string;
  ein: string;
  business_address: string;
  business_type: string;
  started_date: string;
  bookkeeping_method: "Cash" | "Accrual" | "";
};

export type Deductions = {
  student_loan_interest: boolean;
  ira_contributions: boolean;
  hsa_contributions: boolean;
  educator_expenses: boolean;
  mortgage_interest_1098: boolean;
  property_taxes: boolean;
  charitable_contributions: boolean;
  medical_expenses: boolean;
  other: string;
};

export type Credits = {
  child_tax_credit: boolean;
  child_care: boolean;
  education: boolean;
  retirement_savers: boolean;
  earned_income: boolean;
  ev_credit: boolean;
  other: string;
};

export type Banking = {
  routing_number: string;
  account_number: string;
  account_type: "Checking" | "Savings" | "";
  bank_name: string;
};

export type Consent = {
  agree_to_esign: boolean;
  agree_to_disclosures: boolean;
  signature_name: string;
  signature_date: string; // mm/dd/yyyy
};

export type IntakeData = {
  tax_year: string;

  // page 1 identity
  legal_name: string;
  phone: string;
  email: string;
  ssn: string; // FULL SSN
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;

  filing_status: FilingStatus | "";

  spouse_name: string;
  spouse_dob: string;
  spouse_ssn: string;

  dependents: Dependent[];

  income_sources: IncomeSources;
  business: BusinessInfo;

  deductions: Deductions;
  deductions_notes: string;

  credits: Credits;
  credits_notes: string;

  banking: Banking;

  notes: string;

  consent: Consent;
};

export function defaultIntakeData(): IntakeData {
  return {
    tax_year: new Date().getFullYear().toString(),

    legal_name: "",
    phone: "",
    email: "",
    ssn: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    zip: "",

    filing_status: "",

    spouse_name: "",
    spouse_dob: "",
    spouse_ssn: "",

    dependents: [],

    income_sources: {
      w2: false,
      unemployment_1099g: false,
      ssa_1099: false,
      self_employed: false,
      interest_1099int: false,
      dividends_1099div: false,
      ira_pension_1099r: false,
      brokerage_1099b: false,
      other: "",
    },

    business: {
      business_name: "",
      legal_name: "",
      ein: "",
      business_address: "",
      business_type: "",
      started_date: "",
      bookkeeping_method: "",
    },

    deductions: {
      student_loan_interest: false,
      ira_contributions: false,
      hsa_contributions: false,
      educator_expenses: false,
      mortgage_interest_1098: false,
      property_taxes: false,
      charitable_contributions: false,
      medical_expenses: false,
      other: "",
    },
    deductions_notes: "",

    credits: {
      child_tax_credit: false,
      child_care: false,
      education: false,
      retirement_savers: false,
      earned_income: false,
      ev_credit: false,
      other: "",
    },
    credits_notes: "",

    banking: {
      routing_number: "",
      account_number: "",
      account_type: "",
      bank_name: "",
    },

    notes: "",

    consent: {
      agree_to_esign: false,
      agree_to_disclosures: false,
      signature_name: "",
      signature_date: "",
    },
  };
}

// Merge helper (prevents old rows from breaking UI)
export function mergeDefault(incoming: any): IntakeData {
  const base = defaultIntakeData();
  if (!incoming || typeof incoming !== "object") return base;

  return {
    ...base,
    ...incoming,
    dependents: Array.isArray(incoming.dependents) ? incoming.dependents : [],
    income_sources: { ...base.income_sources, ...(incoming.income_sources || {}) },
    business: { ...base.business, ...(incoming.business || {}) },
    deductions: { ...base.deductions, ...(incoming.deductions || {}) },
    credits: { ...base.credits, ...(incoming.credits || {}) },
    banking: { ...base.banking, ...(incoming.banking || {}) },
    consent: { ...base.consent, ...(incoming.consent || {}) },
    deductions_notes: typeof incoming.deductions_notes === "string" ? incoming.deductions_notes : "",
    credits_notes: typeof incoming.credits_notes === "string" ? incoming.credits_notes : "",
  };
}
