import { sign, verify } from "jsonwebtoken";

const QR_SIGNING_SECRET =
  process.env.QR_SIGNING_SECRET ||
  process.env.JWT_SECRET ||
  "restaurant-saas-qr-secret-change-me";

export interface TableQrTokenPayload {
  typ: "table_qr";
  v: 1;
  restaurantId: string;
  branchId?: string | null;
  tableId: string;
  tableNumber?: number | string;
  iat?: number;
  exp?: number;
}

export function signTableQrToken(input: {
  restaurantId: string;
  branchId?: string | null;
  tableId: string;
  tableNumber?: number | string;
}) {
  return sign(
    {
      typ: "table_qr",
      v: 1,
      ...input,
    },
    QR_SIGNING_SECRET,
    { expiresIn: "365d" }
  );
}

export function verifyTableQrToken(token: string): TableQrTokenPayload {
  const decoded = verify(token, QR_SIGNING_SECRET) as TableQrTokenPayload;

  if (decoded.typ !== "table_qr" || decoded.v !== 1) {
    throw new Error("Invalid QR token");
  }

  return decoded;
}