// src/lib/qr-token.ts
//
// Signs and verifies QR tokens for table identification.
// These are NOT auth tokens — they identify a table, not a user.
// Uses jsonwebtoken with a dedicated QR signing secret.

import { sign, verify } from "jsonwebtoken";

// ─── Secret Validation ────────────────────────────────────────────────────────

const QR_SIGNING_SECRET = process.env.QR_SIGNING_SECRET ?? process.env.JWT_SECRET ?? "";

if (!QR_SIGNING_SECRET) {
  throw new Error(
    "[QR Token] Missing required environment variable: QR_SIGNING_SECRET\n" +
    "Set QR_SIGNING_SECRET in your .env.local file.\n" +
    "Generate a secure value with: openssl rand -base64 32"
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TableQrTokenPayload {
  typ:          "table_qr";
  v:            1;
  restaurantId: string;
  branchId?:    string | null;
  tableId:      string;
  tableNumber?: number | string;
  iat?:         number;
  exp?:         number;
}

// ─── Token Lifetime ───────────────────────────────────────────────────────────
// QR codes are printed and physical — 365 days is intentional.
// Table validity is always re-verified against Firestore on each scan,
// so a deleted table's QR will be rejected even if the token is not expired.

const QR_TOKEN_EXPIRY = "365d";

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * Signs a new QR token for a table.
 * The token encodes restaurantId, tableId, and tableNumber.
 */
export function signTableQrToken(input: {
  restaurantId: string;
  branchId?:    string | null;
  tableId:      string;
  tableNumber?: number | string;
}): string {
  return sign(
    {
      typ: "table_qr",
      v:   1,
      ...input,
    },
    QR_SIGNING_SECRET,
    { expiresIn: QR_TOKEN_EXPIRY }
  );
}

/**
 * Verifies and decodes a QR token.
 * Throws if the token is invalid, expired, or has wrong type/version.
 */
export function verifyTableQrToken(token: string): TableQrTokenPayload {
  const decoded = verify(token, QR_SIGNING_SECRET) as TableQrTokenPayload;

  if (decoded.typ !== "table_qr" || decoded.v !== 1) {
    throw new Error("Invalid QR token type or version");
  }

  return decoded;
}