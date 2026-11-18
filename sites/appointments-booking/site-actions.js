/**
 * Oakwood Community Scheduling — Official Open Agentic Web Actions Module
 * Exposes website_get_schedule_and_bookings, website_hold_slot_selection,
 * website_confirm_appointment_booking, and website_cancel_booking.
 */

import { App } from './script.js';

class SiteActions {
  static registerActions(actions) {
    actions.register(SiteActions.getScheduleAndBookingsAction());
    actions.register(SiteActions.holdSlotSelectionAction());
    actions.register(SiteActions.confirmAppointmentBookingAction());
    actions.register(SiteActions.cancelBookingAction());
  }

  static getScheduleAndBookingsAction() {
    return {
      name: 'get_schedule_and_bookings',
      description:
        'Read all Oakwood clinic, tutoring, and equipment rental providers, live open/booked time slots, currently held slot selection, state version, and confirmed bookings on this page.',
      effect: 'read',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false
      },
      execute: () => App.page.getState()
    };
  }

  static holdSlotSelectionAction() {
    return {
      name: 'hold_slot_selection',
      description:
        'Select and highlight an open appointment or equipment time slot on the page before final booking. Reversible write; does not finalize reservation yet.',
      effect: 'write',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['slotId'],
        properties: {
          slotId: {
            type: 'string',
            enum: App.page.allSlotIds(),
            description: 'Exact available slotId from website_get_schedule_and_bookings.'
          },
          visitReason: {
            type: 'string',
            maxLength: 180,
            description: 'Optional topic, project, or non-sensitive visit reason.'
          }
        }
      },
      execute: (args) => App.page.holdSlotSelection(args.slotId, args.visitReason || '')
    };
  }

  static confirmAppointmentBookingAction() {
    return {
      name: 'confirm_appointment_booking',
      description:
        'Confirm and lock in the currently selected time slot. Irreversible action: browser asks the visitor to confirm first. Refuses stale expectedVersion or already-booked slots.',
      effect: 'irreversible',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['attendeeName', 'expectedVersion'],
        properties: {
          attendeeName: {
            type: 'string',
            minLength: 2,
            maxLength: 80,
            description: 'Name of the person attending or picking up the equipment.'
          },
          attendeeContact: {
            type: 'string',
            maxLength: 80,
            description: 'Optional email or phone reminder contact if given by the visitor.'
          },
          visitReason: {
            type: 'string',
            maxLength: 180,
            description: 'Optional short note on tutoring topic, equipment project, or visit focus.'
          },
          expectedVersion: {
            type: 'integer',
            minimum: 1,
            description: 'Latest version from website_get_schedule_and_bookings or website_hold_slot_selection in this turn.'
          }
        }
      },
      execute: (args) => App.page.confirmBooking(args)
    };
  }

  static cancelBookingAction() {
    return {
      name: 'cancel_booking',
      description:
        'Cancel an existing booking on this page using its confirmationCode (e.g., OK-123456) and reopen the time slot.',
      effect: 'write',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['confirmationCode'],
        properties: {
          confirmationCode: {
            type: 'string',
            minLength: 4,
            maxLength: 20,
            description: 'Exact confirmationCode from website_get_schedule_and_bookings.'
          }
        }
      },
      execute: (args) => App.page.cancelBooking(args.confirmationCode)
    };
  }
}

export const registerActions = SiteActions.registerActions;