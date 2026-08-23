import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result instanceof NextResponse) return result;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const search = searchParams.get("search") || "";
  const role = searchParams.get("role") || "";
  const goal = searchParams.get("goal") || "";
  const profileComplete = searchParams.get("profileComplete") || "";
  const isBanned = searchParams.get("isBanned") || "";
  const sortField = searchParams.get("sortField") || "createdAt";
  const sortDir = searchParams.get("sortDir") === "asc" ? 1 : -1;

  await getDb();

  const filter: any = {};

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }
  if (role) filter.role = role;
  if (goal) filter["fitnessProfile.goal"] = goal;
  if (profileComplete !== "") filter.isProfileComplete = profileComplete === "true";
  if (isBanned !== "") filter.isBanned = isBanned === "true";

  const validSortFields: Record<string, string> = {
    name: "name",
    email: "email",
    createdAt: "createdAt",
    lastLoginAt: "lastLoginAt",
    role: "role",
  };
  const sort: any = { [validSortFields[sortField] || "createdAt"]: sortDir };

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .select("-passwordHash")
      .lean(),
    User.countDocuments(filter),
  ]);

  return NextResponse.json({
    success: true,
    users,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}
