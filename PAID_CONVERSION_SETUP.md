# Paid Subscription Conversion Integration

This version reads two live Google Sheets:

1. **Lead Journey Sheet** (`GOOGLE_SHEET_URL`) — agent, stage, feedback and lead date.
2. **Paid Subscription Sheet** (`PAYMENT_GOOGLE_SHEET_URL`) — successful subscription payments.

Both sheets are fetched in memory. No Google Sheet file is stored in the backend folder.

## Matching rule

A record becomes a conversion when the same normalized 10-digit phone number exists in:

- MongoDB `submissions`
- Lead Journey Google Sheet
- Paid Subscription Google Sheet

The `matched_leads` document is updated with:

- `isConverted`
- `paymentAmount`
- `paymentDate`
- `paymentStudentName`
- `paymentCourse`
- `paymentPlan`
- `paymentStatus`
- `paymentTransactionId`
- `paymentTransactionCount`

When a payment row is removed from the paid sheet, the next sync resets the conversion fields for that lead.

## Supported payment-sheet headings

The parser supports common headings, including:

- Phone, Mobile, Mobile Number, Phone Number, Contact Number, WhatsApp Number
- Amount, Paid Amount, Payment Amount, Amount Paid, Fees, Subscription Amount
- Payment Date, Paid Date, Transaction Date, Subscription Date
- Student Name, Customer Name, Name
- Course, Course Name, Product, Subscription
- Payment Status, Status
- Transaction ID, Payment ID, Order ID, Receipt ID

If the payment sheet uses different headings, add them to `server/utils/matchCapturedLeadsWithExcel.js` in `getPaymentPhone()` or `summarizePayments()`.

## Run

```powershell
cd server
npm install
npm run dev
```

In another terminal:

```powershell
cd client
npm install
npm run dev
```

Both Google Sheets must be shared as **Anyone with the link → Viewer**.
