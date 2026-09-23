import { NextResponse } from "next/server";

// wood-master AI chat 已停用。
export async function GET() {
  return NextResponse.json({ available: false, disabled: true }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({ error: "wood-master disabled" }, { status: 410 });
}
