import { createCase, listCases } from "@/lib/suitecrm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const cases = await listCases();
    return NextResponse.json(cases);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load cases";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const created = await createCase(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create case";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
