import { NextResponse } from "next/server";
import getDb from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";

export async function GET() {
    // await getDb();
    return NextResponse.json({ success: true });
}