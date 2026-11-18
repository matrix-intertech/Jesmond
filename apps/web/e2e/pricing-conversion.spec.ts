import { test, expect } from '@playwright/test';
import { convertCentsToAud, formatAudPrice } from '../utils/pricing';

test.describe('Pricing Conversion (Cents to AUD)', () => {
  test('converts whole dollar amounts in cents to AUD', () => {
    expect(convertCentsToAud(35000)).toBe(350);
    expect(convertCentsToAud(29900)).toBe(299);
    expect(convertCentsToAud(100)).toBe(1);
  });

  test('preserves fractional dollar precision without lossy rounding', () => {
    // 35,050 cents = $350.50 AUD
    expect(convertCentsToAud(35050)).toBe(350.5);
    // 35,025 cents = $350.25 AUD
    expect(convertCentsToAud(35025)).toBe(350.25);
    // 1 cent = $0.01 AUD
    expect(convertCentsToAud(1)).toBe(0.01);
    // 99 cents = $0.99 AUD
    expect(convertCentsToAud(99)).toBe(0.99);
  });

  test('handles zero, negative, missing, non-finite, and invalid values gracefully', () => {
    expect(convertCentsToAud(0)).toBeUndefined();
    expect(convertCentsToAud(-100)).toBeUndefined();
    expect(convertCentsToAud(-5000)).toBeUndefined();
    expect(convertCentsToAud(null)).toBeUndefined();
    expect(convertCentsToAud(undefined)).toBeUndefined();
    expect(convertCentsToAud(NaN)).toBeUndefined();
    expect(convertCentsToAud(Infinity)).toBeUndefined();
    expect(convertCentsToAud(-Infinity)).toBeUndefined();
    expect(convertCentsToAud('35000' as any)).toBeUndefined();
    expect(convertCentsToAud({} as any)).toBeUndefined();
  });

  test('formatAudPrice accurately formats Services and Mechanics pricing without 100x bug', () => {
    // Critical Services and Mechanics prices
    expect(formatAudPrice(8900)).toBe('$89.00');
    expect(formatAudPrice(7900)).toBe('$79.00');
    expect(formatAudPrice(14900)).toBe('$149.00');
    expect(formatAudPrice(8000)).toBe('$80.00');
    expect(formatAudPrice(18000)).toBe('$180.00');
    expect(formatAudPrice(29900)).toBe('$299.00');

    // Fractional cents
    expect(formatAudPrice(35050)).toBe('$350.50');
    expect(formatAudPrice(35025)).toBe('$350.25');
    expect(formatAudPrice(100)).toBe('$1.00');
    expect(formatAudPrice(50)).toBe('$0.50');
    expect(formatAudPrice(99)).toBe('$0.99');

    // String input support
    expect(formatAudPrice('8900')).toBe('$89.00');
    expect(formatAudPrice('14900')).toBe('$149.00');

    // Optional prefix formatting
    expect(formatAudPrice(8900, { showPrefix: true })).toBe('AUD $89.00');
    expect(formatAudPrice(7900, { showPrefix: true })).toBe('AUD $79.00');
  });

  test('formatAudPrice accurately calculates sums for multiple selected services', () => {
    const safetyInspection = 8900;
    const diagnosticScan = 7900;
    const prePurchaseCheck = 14900;

    const twoServicesSum = safetyInspection + diagnosticScan; // 16800 cents = $168.00
    expect(formatAudPrice(twoServicesSum)).toBe('$168.00');

    const allThreeSum = safetyInspection + diagnosticScan + prePurchaseCheck; // 31700 cents = $317.00
    expect(formatAudPrice(allThreeSum)).toBe('$317.00');
  });

  test('formatAudPrice handles edge cases, zero and invalid inputs safely', () => {
    expect(formatAudPrice(0)).toBe('$0.00');
    expect(formatAudPrice(null)).toBe('$0.00');
    expect(formatAudPrice(undefined)).toBe('$0.00');
    expect(formatAudPrice(-100)).toBe('$0.00');
    expect(formatAudPrice(NaN)).toBe('$0.00');
    expect(formatAudPrice(Infinity)).toBe('$0.00');
    expect(formatAudPrice('invalid')).toBe('$0.00');

    expect(formatAudPrice(0, { showPrefix: true })).toBe('AUD $0.00');
    expect(formatAudPrice(null, { showPrefix: true })).toBe('AUD $0.00');
  });

  test('simulates BusinessAppointments component pricing flow preventing 100x bug', () => {
    // Exact seed data models from Mechanics & Services demo businesses
    const services = [
      { id: 'srv-1', name: 'Comprehensive Vehicle Safety Inspection', price: 8900, durationMins: 45 },
      { id: 'srv-2', name: 'Engine Diagnostic & Fault Code Scan', price: 7900, durationMins: 30 },
      { id: 'srv-3', name: 'Pre-Purchase Vehicle Mechanical Inspection', price: 14900, durationMins: 60 },
      { id: 'srv-4', name: 'Residential Home Cleaning (Standard)', price: 8000, durationMins: 60 },
      { id: 'srv-5', name: 'End of Lease & Deep Cleaning', price: 18000, durationMins: 120 },
      { id: 'srv-6', name: 'Major Scheduled Logbook Service', price: 29900, durationMins: 90 },
    ];

    // 1. Service Cards price display
    const renderedCardPrices = services.map((svc) => ({
      name: svc.name,
      displayedPrice: formatAudPrice(svc.price),
    }));

    expect(renderedCardPrices).toEqual([
      { name: 'Comprehensive Vehicle Safety Inspection', displayedPrice: '$89.00' },
      { name: 'Engine Diagnostic & Fault Code Scan', displayedPrice: '$79.00' },
      { name: 'Pre-Purchase Vehicle Mechanical Inspection', displayedPrice: '$149.00' },
      { name: 'Residential Home Cleaning (Standard)', displayedPrice: '$80.00' },
      { name: 'End of Lease & Deep Cleaning', displayedPrice: '$180.00' },
      { name: 'Major Scheduled Logbook Service', displayedPrice: '$299.00' },
    ]);

    // Ensure none of the displayed prices contain 100x multiplication
    renderedCardPrices.forEach(({ displayedPrice }) => {
      expect(displayedPrice).not.toMatch(/\$8900/);
      expect(displayedPrice).not.toMatch(/\$7900/);
      expect(displayedPrice).not.toMatch(/\$14900/);
      expect(displayedPrice).not.toMatch(/\$8000/);
      expect(displayedPrice).not.toMatch(/\$18000/);
      expect(displayedPrice).not.toMatch(/\$29900/);
    });

    // 2. Booking Summary total calculation for single service selection
    for (const service of services) {
      const selectedService = service.id;
      const selectedServiceObj = services.find((s) => s.id === selectedService);
      const selectedServices = selectedServiceObj ? [selectedServiceObj] : [];
      const bookingTotalCents = selectedServices.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
      const displayedTotal = formatAudPrice(bookingTotalCents);

      // Total must exactly match the individual service card price
      expect(displayedTotal).toBe(formatAudPrice(service.price));
      // Total must NOT display 100x amount
      expect(displayedTotal).not.toBe(`$${(service.price).toFixed(2)}`);
    }

    // 3. Booking Summary multi-service bundle calculation
    const bundledServices = [services[0], services[1]]; // Safety Inspection (8900) + Fault Scan (7900)
    const bundleTotalCents = bundledServices.reduce((sum, s) => sum + (Number(s.price) || 0), 0); // 16800
    expect(bundleTotalCents).toBe(16800);
    expect(formatAudPrice(bundleTotalCents)).toBe('$168.00');

    // 4. Provider Portal prefix formatting
    expect(formatAudPrice(services[0].price, { showPrefix: true })).toBe('AUD $89.00');
    expect(formatAudPrice(services[1].price, { showPrefix: true })).toBe('AUD $79.00');
    expect(formatAudPrice(services[2].price, { showPrefix: true })).toBe('AUD $149.00');

    // 5. Provider Portal edit form dollar conversion (cents -> dollars)
    expect(Number(services[0].price) / 100).toBe(89);
    expect(Number(services[1].price) / 100).toBe(79);
    expect(Number(services[2].price) / 100).toBe(149);
    expect(Number(services[5].price) / 100).toBe(299);
  });
});
