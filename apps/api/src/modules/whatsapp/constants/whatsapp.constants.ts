export const WHATSAPP_QUEUE_NAME = 'whatsapp-notifications';
export const WHATSAPP_JOB_NAME = 'send-whatsapp-notification';

export const DEFAULT_MSG91_BASE_URL =
  'https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/';

export const DEFAULT_HTTP_TIMEOUT_MS = 10000;

export enum WhatsAppEvent {
  // Authentication
  AUTH_REGISTER_OTP = 'AUTH_REGISTER_OTP',
  AUTH_LOGIN_OTP = 'AUTH_LOGIN_OTP',
  AUTH_PASSWORD_RESET_OTP = 'AUTH_PASSWORD_RESET_OTP',

  // Orders
  ORDER_CONFIRMED = 'ORDER_CONFIRMED',
  ORDER_PACKED = 'ORDER_PACKED',
  ORDER_DELIVERED = 'ORDER_DELIVERED',
  ORDER_TAKEN_AWAY = 'ORDER_TAKEN_AWAY',

  // Properties
  PROPERTY_LISTING_CONFIRMED = 'PROPERTY_LISTING_CONFIRMED',
  PROPERTY_QUERY_RECEIVED = 'PROPERTY_QUERY_RECEIVED',
  PROPERTY_MESSAGE_RECEIVED = 'PROPERTY_MESSAGE_RECEIVED',

  // Customer Appointments
  APPOINTMENT_REQUEST_RECEIVED = 'APPOINTMENT_REQUEST_RECEIVED',
  APPOINTMENT_CONFIRMED = 'APPOINTMENT_CONFIRMED',
  APPOINTMENT_REMINDER = 'APPOINTMENT_REMINDER',
  APPOINTMENT_CANCELLED = 'APPOINTMENT_CANCELLED',
  APPOINTMENT_RESCHEDULED = 'APPOINTMENT_RESCHEDULED',

  // Service Provider Appointments
  SERVICE_PROVIDER_NEW_APPOINTMENT = 'SERVICE_PROVIDER_NEW_APPOINTMENT',
  SERVICE_PROVIDER_APPOINTMENT_CONFIRMED = 'SERVICE_PROVIDER_APPOINTMENT_CONFIRMED',
  SERVICE_PROVIDER_APPOINTMENT_REMINDER = 'SERVICE_PROVIDER_APPOINTMENT_REMINDER',
  SERVICE_PROVIDER_APPOINTMENT_CANCELLED = 'SERVICE_PROVIDER_APPOINTMENT_CANCELLED',
}

export enum WhatsAppTemplateStatus {
  APPROVED = 'APPROVED',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
}

/**
 * Fields that must never be stored in logs or exposed in logging pipelines.
 */
export const SENSITIVE_FIELD_PATTERNS = [
  /otp/i,
  /password/i,
  /secret/i,
  /token/i,
  /code/i,
  /pin/i,
  /credential/i,
  /authkey/i,
  /auth_key/i,
];

/**
 * Phone number validation regex
 * E.164 format: 8 to 15 digits, optional leading '+'
 */
export const E164_PHONE_REGEX = /^\+?[1-9]\d{7,14}$/;

/**
 * Australian Mobile formats:
 * - 04XXXXXXXX (10 digits)
 * - +614XXXXXXXX or 614XXXXXXXX (9 digits after 61)
 */
export const AU_MOBILE_REGEX = /^(\+?61|0)4\d{8}$/;

