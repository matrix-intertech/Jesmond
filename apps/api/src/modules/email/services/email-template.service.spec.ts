import { BadRequestException } from '@nestjs/common';
import { EmailEvent } from '../constants/email.constants';
import { EmailTemplateService, escapeHtml } from './email-template.service';

describe('EmailTemplateService', () => {
  let service: EmailTemplateService;

  beforeEach(() => {
    service = new EmailTemplateService();
  });

  describe('escapeHtml', () => {
    it('should escape dangerous characters to prevent XSS', () => {
      const input = '<script>alert("xss & \'injection\'")</script>';
      const escaped = escapeHtml(input);
      expect(escaped).toBe(
        '&lt;script&gt;alert(&quot;xss &amp; &#39;injection&#39;&quot;)&lt;/script&gt;',
      );
    });

    it('should return empty string for null/undefined', () => {
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
    });
  });

  describe('All 19 Events Coverage', () => {
    const allEvents: EmailEvent[] = Object.values(EmailEvent);

    it('should have exactly 19 registered email events', () => {
      expect(allEvents).toHaveLength(19);
    });

    it.each(allEvents)('should successfully retrieve template for event %s', (event) => {
      const template = service.getTemplate(event);
      expect(template).toBeDefined();
      expect(template.requiredVariables).toBeInstanceOf(Array);
      expect(typeof template.subject).toBe('function');
      expect(typeof template.renderText).toBe('function');
      expect(typeof template.renderHtmlBody).toBe('function');
    });

    // 1. AUTH_REGISTER_OTP
    it('should correctly render AUTH_REGISTER_OTP', () => {
      const res = service.render(EmailEvent.AUTH_REGISTER_OTP, { otp: '123456' });
      expect(res.subject).toBe('Verify your Jesmond account');
      expect(res.text).toContain('Use this code to verify your Jesmond account:');
      expect(res.text).toContain('123456');
      expect(res.text).toContain('expires in 10 minutes');
      expect(res.html).toContain('123456');
      expect(res.html).toContain('Jesmond');
    });

    // 2. AUTH_LOGIN_OTP
    it('should correctly render AUTH_LOGIN_OTP', () => {
      const res = service.render(EmailEvent.AUTH_LOGIN_OTP, { otp: '654321' });
      expect(res.subject).toBe('Your Jesmond login code');
      expect(res.text).toContain('Your Jesmond login verification code is:');
      expect(res.text).toContain('654321');
      expect(res.text).toContain('expires in 10 minutes');
      expect(res.html).toContain('654321');
    });

    // 3. AUTH_PASSWORD_RESET_OTP
    it('should correctly render AUTH_PASSWORD_RESET_OTP', () => {
      const res = service.render(EmailEvent.AUTH_PASSWORD_RESET_OTP, { otp: '789012' });
      expect(res.subject).toBe('Reset your Jesmond password');
      expect(res.text).toContain('Use this code to continue resetting your Jesmond password:');
      expect(res.text).toContain('789012');
      expect(res.text).toContain('expires in 15 minutes');
      expect(res.html).toContain('789012');
    });

    // 4. ORDER_CONFIRMED
    it('should correctly render ORDER_CONFIRMED', () => {
      const res = service.render(EmailEvent.ORDER_CONFIRMED, {
        order_number: 'ORD-101',
        customer_name: 'Jane Doe',
      });
      expect(res.subject).toBe('Your Jesmond order ORD-101 is confirmed');
      expect(res.text).toContain('Hi Jane Doe');
      expect(res.text).toContain('Your order ORD-101 has been confirmed');
      expect(res.html).toContain('Jane Doe');
      expect(res.html).toContain('ORD-101');
    });

    // 5. ORDER_PACKED
    it('should correctly render ORDER_PACKED', () => {
      const res = service.render(EmailEvent.ORDER_PACKED, {
        order_number: 'ORD-102',
      });
      expect(res.subject).toBe('Your Jesmond order ORD-102 has been packed');
      expect(res.text).toContain('Your order ORD-102 has been packed and is getting ready');
      expect(res.html).toContain('ORD-102');
    });

    // 6. ORDER_DELIVERED
    it('should correctly render ORDER_DELIVERED', () => {
      const res = service.render(EmailEvent.ORDER_DELIVERED, {
        order_number: 'ORD-103',
      });
      expect(res.subject).toBe('Your Jesmond order ORD-103 has been delivered');
      expect(res.text).toContain('Your order ORD-103 has been marked as delivered.');
      expect(res.html).toContain('ORD-103');
    });

    // 7. ORDER_TAKEN_AWAY
    it('should correctly render ORDER_TAKEN_AWAY', () => {
      const res = service.render(EmailEvent.ORDER_TAKEN_AWAY, {
        order_number: 'ORD-104',
      });
      expect(res.subject).toBe('Your Jesmond order ORD-104 has been picked up');
      expect(res.text).toContain('Your order ORD-104 has been marked as picked up.');
      expect(res.html).toContain('ORD-104');
    });

    // 8. PROPERTY_LISTING_CONFIRMED
    it('should correctly render PROPERTY_LISTING_CONFIRMED', () => {
      const res = service.render(EmailEvent.PROPERTY_LISTING_CONFIRMED, {
        property_title: 'Jesmond Student House',
      });
      expect(res.subject).toBe('Your property listing is now published on Jesmond');
      expect(res.text).toContain('Your property listing “Jesmond Student House” has been approved');
      expect(res.html).toContain('Jesmond Student House');
    });

    // 9. PROPERTY_QUERY_RECEIVED
    it('should correctly render PROPERTY_QUERY_RECEIVED', () => {
      const res = service.render(EmailEvent.PROPERTY_QUERY_RECEIVED, {
        property_title: 'Jesmond Student House',
        sender_name: 'Alice Cooper',
      });
      expect(res.subject).toBe('New enquiry for Jesmond Student House');
      expect(res.text).toContain('You have received a new enquiry about “Jesmond Student House” from Alice Cooper.');
      expect(res.html).toContain('Alice Cooper');
    });

    // 10. PROPERTY_MESSAGE_RECEIVED
    it('should correctly render PROPERTY_MESSAGE_RECEIVED and not contain message body', () => {
      const res = service.render(EmailEvent.PROPERTY_MESSAGE_RECEIVED, {
        property_title: 'Jesmond Student House',
        sender_name: 'Bob Marley',
        privateBody: 'secret text that must not be in email',
      });
      expect(res.subject).toBe('You have a new message about Jesmond Student House');
      expect(res.text).toContain('Bob Marley sent you a new message about “Jesmond Student House” on Jesmond.');
      expect(res.text).not.toContain('secret text');
      expect(res.html).not.toContain('secret text');
    });

    // 11. APPOINTMENT_REQUEST_RECEIVED
    it('should explicitly state awaiting business approval and never confirmed for APPOINTMENT_REQUEST_RECEIVED', () => {
      const res = service.render(EmailEvent.APPOINTMENT_REQUEST_RECEIVED, {
        customer_name: 'Charlie Brown',
        service_name: 'Haircut',
        appointment_time: 'Fri, Nov 6, 2:00 PM',
      });
      expect(res.subject).toBe('We received your appointment request');
      expect(res.text).toContain('Your appointment is awaiting business approval.');
      expect(res.text).not.toContain('Your appointment has been confirmed');
      expect(res.html).toContain('Awaiting business approval');
    });

    // 12. APPOINTMENT_CONFIRMED
    it('should correctly render APPOINTMENT_CONFIRMED', () => {
      const res = service.render(EmailEvent.APPOINTMENT_CONFIRMED, {
        customer_name: 'Charlie Brown',
        service_name: 'Haircut',
        appointment_time: 'Fri, Nov 6, 2:00 PM',
      });
      expect(res.subject).toBe('Your appointment is confirmed');
      expect(res.text).toContain('Your appointment for Haircut on Fri, Nov 6, 2:00 PM has been confirmed.');
    });

    // 13. APPOINTMENT_REMINDER
    it('should correctly render APPOINTMENT_REMINDER', () => {
      const res = service.render(EmailEvent.APPOINTMENT_REMINDER, {
        customer_name: 'Charlie Brown',
        service_name: 'Haircut',
        appointment_time: 'Fri, Nov 6, 2:00 PM',
      });
      expect(res.subject).toBe('Reminder: your upcoming Jesmond appointment');
      expect(res.text).toContain('This is a reminder of your Haircut appointment on Fri, Nov 6, 2:00 PM.');
    });

    // 14. APPOINTMENT_CANCELLED
    it('should correctly render APPOINTMENT_CANCELLED with reason', () => {
      const res = service.render(EmailEvent.APPOINTMENT_CANCELLED, {
        customer_name: 'Charlie Brown',
        service_name: 'Haircut',
        reason: 'Staff unwell',
      });
      expect(res.subject).toBe('Your appointment has been cancelled');
      expect(res.text).toContain('Reason: Staff unwell');
    });

    // 15. APPOINTMENT_RESCHEDULED
    it('should correctly render APPOINTMENT_RESCHEDULED', () => {
      const res = service.render(EmailEvent.APPOINTMENT_RESCHEDULED, {
        customer_name: 'Charlie Brown',
        service_name: 'Haircut',
        old_time: 'Fri, Nov 6, 2:00 PM',
        new_time: 'Sat, Nov 7, 3:00 PM',
      });
      expect(res.subject).toBe('Your appointment has been rescheduled');
      expect(res.text).toContain('Previous time: Fri, Nov 6, 2:00 PM');
      expect(res.text).toContain('New time: Sat, Nov 7, 3:00 PM');
    });

    // 16. SERVICE_PROVIDER_NEW_APPOINTMENT
    it('should correctly render SERVICE_PROVIDER_NEW_APPOINTMENT without implying confirmation', () => {
      const res = service.render(EmailEvent.SERVICE_PROVIDER_NEW_APPOINTMENT, {
        provider_name: 'Dr. Sarah',
        service_name: 'Consultation',
        appointment_time: 'Mon, Nov 9, 10:00 AM',
      });
      expect(res.subject).toBe('New appointment request received');
      expect(res.text).toContain('It is awaiting business approval.');
      expect(res.text).not.toContain('has been confirmed');
    });

    // 17. SERVICE_PROVIDER_APPOINTMENT_CONFIRMED
    it('should correctly render SERVICE_PROVIDER_APPOINTMENT_CONFIRMED', () => {
      const res = service.render(EmailEvent.SERVICE_PROVIDER_APPOINTMENT_CONFIRMED, {
        provider_name: 'Dr. Sarah',
        service_name: 'Consultation',
        appointment_time: 'Mon, Nov 9, 10:00 AM',
      });
      expect(res.subject).toBe('Appointment assigned to you');
      expect(res.text).toContain('has been confirmed and assigned to you.');
    });

    // 18. SERVICE_PROVIDER_APPOINTMENT_REMINDER
    it('should correctly render SERVICE_PROVIDER_APPOINTMENT_REMINDER', () => {
      const res = service.render(EmailEvent.SERVICE_PROVIDER_APPOINTMENT_REMINDER, {
        provider_name: 'Dr. Sarah',
        service_name: 'Consultation',
        appointment_time: 'Mon, Nov 9, 10:00 AM',
      });
      expect(res.subject).toBe('Reminder: upcoming assigned appointment');
      expect(res.text).toContain('This is a reminder that your Consultation appointment is scheduled');
    });

    // 19. SERVICE_PROVIDER_APPOINTMENT_CANCELLED
    it('should correctly render SERVICE_PROVIDER_APPOINTMENT_CANCELLED', () => {
      const res = service.render(EmailEvent.SERVICE_PROVIDER_APPOINTMENT_CANCELLED, {
        provider_name: 'Dr. Sarah',
        service_name: 'Consultation',
        appointment_time: 'Mon, Nov 9, 10:00 AM',
      });
      expect(res.subject).toBe('An assigned appointment has been cancelled');
      expect(res.text).toContain('The appointment for Consultation scheduled at Mon, Nov 9, 10:00 AM has been cancelled.');
    });
  });

  describe('Validation and Missing Variables', () => {
    it('should throw BadRequestException when a required variable is missing', () => {
      expect(() => {
        service.render(EmailEvent.ORDER_CONFIRMED, { order_number: 'ORD-123' });
      }).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for unknown event', () => {
      expect(() => {
        service.render('UNKNOWN_EVENT' as any, {});
      }).toThrow(BadRequestException);
    });
  });
});
