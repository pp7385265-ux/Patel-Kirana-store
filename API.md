# Backend API

The authenticated backend entry point is `api.php`. Send JSON bodies for POST requests and a bearer token for protected routes:

```http
Authorization: Bearer <token>
Content-Type: application/json
```

## Authentication

- `POST api.php?action=register`
- `POST api.php?action=login`
- `POST api.php?action=request_otp`
- `POST api.php?action=verify_otp`

`request_otp` stores a hashed, ten-minute OTP. SMS/email delivery is intentionally reported as unavailable until a provider is configured; the API does not return the OTP.

## Customer APIs

- `GET api.php?action=products&q=rice&category=Kirana`
- `GET api.php?action=addresses`
- `POST api.php?action=address_save`
- `GET api.php?action=cart`
- `POST api.php?action=cart_add`
- `POST api.php?action=cart_remove`
- `POST api.php?action=coupon_validate`
- `POST api.php?action=order_create`
- `GET api.php?action=orders`
- `GET api.php?action=order_status&order_id=123`
- `GET api.php?action=delivery_track&order_id=123`
- `GET api.php?action=notifications`
- `POST api.php?action=notification_read`
- `POST api.php?action=refund_request`
- `GET api.php?action=refunds`
- `POST api.php?action=support_ticket`
- `GET api.php?action=support_tickets`

## Admin APIs

Admin authentication uses the existing project admin credentials and returns an admin bearer token.

- `GET api.php?action=admin_users`
- `GET api.php?action=inventory`
- `POST api.php?action=inventory_update`
- `POST api.php?action=coupon_create`
- `POST api.php?action=order_update_status`
- `POST api.php?action=delivery_assign`
- `GET api.php?action=refunds`
- `POST api.php?action=refund_update`
- `GET api.php?action=support_tickets`
- `GET api.php?action=admin_report`
- `GET api.php?action=admin_roles`
- `GET api.php?action=admin_logs`

## Delivery Partner APIs

- `POST api.php?action=partner_register`
- `POST api.php?action=partner_login`
- `GET api.php?action=partner_profile`
- `POST api.php?action=partner_status`
- `GET api.php?action=available_orders`
- `POST api.php?action=partner_accept`
- `POST api.php?action=partner_reject`
- `POST api.php?action=partner_pickup`
- `POST api.php?action=partner_update_status`
- `GET api.php?action=partner_contact&order_id=123`
- `GET api.php?action=partner_earnings`
- `GET api.php?action=partner_payouts`
- `GET api.php?action=partner_history`
- Admin only: `POST api.php?action=partner_kyc_update`

Partner order acceptance requires `kyc_status = Approved`. The partner app uses Google Maps links for navigation and stores driver coordinates on status updates.

## Payments and operations

- `POST api.php?action=payment_create` supports COD.
- Online UPI/card payments return HTTP `501` until Razorpay, Stripe, or another provider is configured.
- Order creation uses a transaction, validates stock, decrements inventory, stores status events, and writes an audit log.
- `db.php` applies the required tables/columns automatically for existing installations.

Never expose database credentials or use the development admin password in production. Add rate limiting, HTTPS, CSRF protection for cookie sessions, and a real SMS/email/push/payment provider before deployment.
