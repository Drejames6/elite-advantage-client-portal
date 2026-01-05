import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "public", "forms", "8879.pdf");
    const fileBuffer = await fs.readFile(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        // forces download instead of trying to render in-browser
        "Content-Disposition": 'attachment; filename="IRS-Form-8879.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    // return 404 instead of crashing the server
    return new NextResponse("8879 PDF not found", { status: 404 });
  }
}
