export type Case = {
  id: string;
  title: string;
  status: string;
  description: string;
  createdAt: string; // read-only — SuiteCRM date_entered
  updatedAt: string; // read-only — SuiteCRM date_modified
};

type CaseInput = Pick<Case, "title" | "status" | "description">;

// SuiteCRM status values are NOT the same as our dropdown labels.
// Example: we show "Open" but CRM saves "Open_New".
// One list = one place to map both directions (no need for 2 separate objects).
const STATUSES = [
  { label: "Open", crm: "Open_New" },
  { label: "In Progress", crm: "Open_Assigned" },
  { label: "Closed", crm: "Closed_Closed" },
];

function appStatusToCrm(label: string) {
  const found = STATUSES.find((s) => s.label === label);
  return found ? found.crm : "Open_New";
}

function crmStatusToApp(crmValue: string) {
  const found = STATUSES.find((s) => s.crm === crmValue);
  return found ? found.label : crmValue || "Open";
}

let token = "";
let tokenExpires = 0;

function crmUrl() {
  return process.env.SUITECRM_URL!.replace(/\/$/, "");
}

// SuiteCRM on WAMP may add HTML before JSON — find and parse the JSON part.
function readJson(text: string) {
  try {
    return JSON.parse(text.trim());
  } catch {
    const start = text.indexOf("{");
    if (start === -1) throw new Error("Bad response from SuiteCRM");
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === "{") depth++;
      if (text[i] === "}") depth--;
      if (depth === 0) return JSON.parse(text.slice(start, i + 1));
    }
    throw new Error("Bad response from SuiteCRM");
  }
}

async function getToken() {
  if (token && Date.now() < tokenExpires) return token;

  const body = new URLSearchParams({
    grant_type: "password",
    client_id: process.env.SUITECRM_CLIENT_ID!,
    client_secret: process.env.SUITECRM_CLIENT_SECRET!,
    username: process.env.SUITECRM_USERNAME!,
    password: process.env.SUITECRM_PASSWORD!,
  });

  const res = await fetch(`${crmUrl()}/Api/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = readJson(await res.text());
  if (!res.ok) throw new Error(data.error_description || "Login failed");

  token = data.access_token;
  tokenExpires = Date.now() + (data.expires_in - 60) * 1000;
  return token;
}

async function crmFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${crmUrl()}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${await getToken()}`,
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      ...options.headers,
    },
  });

  const data = readJson(await res.text());
  if (!res.ok) {
    throw new Error(data?.errors?.[0]?.detail || data?.message || "SuiteCRM error");
  }
  return data;
}

function formatDateTime(value?: string) {
  if (!value) return "";
  return value.slice(0, 16).replace("T", " ");
}

function toCase(row: { id: string; attributes: Record<string, string> }): Case {
  const a = row.attributes;
  return {
    id: row.id,
    title: a.name || "",
    status: crmStatusToApp(a.status),
    description: a.description || "",
    createdAt: formatDateTime(a.date_entered),
    updatedAt: formatDateTime(a.date_modified),
  };
}

function toCrmFields(input: CaseInput) {
  return {
    name: input.title,
    status: appStatusToCrm(input.status),
    description: input.description,
  };
}

export async function listCases(): Promise<Case[]> {
  const data = await crmFetch(
    "/Api/V8/module/Cases?fields[Cases]=name,status,description,date_entered,date_modified&page[size]=50&sort=-date_modified"
  );
  return (data.data || []).map(toCase);
}

export async function createCase(input: CaseInput): Promise<Case> {
  const data = await crmFetch("/Api/V8/module", {
    method: "POST",
    body: JSON.stringify({ data: { type: "Cases", attributes: toCrmFields(input) } }),
  });
  return toCase(data.data);
}

export async function updateCase(id: string, input: CaseInput): Promise<Case> {
  const data = await crmFetch("/Api/V8/module", {
    method: "PATCH",
    body: JSON.stringify({ data: { type: "Cases", id, attributes: toCrmFields(input) } }),
  });
  return toCase(data.data);
}

export async function deleteCase(id: string): Promise<void> {
  await crmFetch(`/Api/V8/module/Cases/${id}`, { method: "DELETE" });
}
