import { NextResponse } from "next/server";
import versionData from "@/version.json";

export async function GET() {
  return NextResponse.json({
    success: true,
    version: versionData.versionName,
    build: versionData.versionCode,
    major: versionData.major,
    minor: versionData.minor,
    patch: versionData.patch,
  });
}
