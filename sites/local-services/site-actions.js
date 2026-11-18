/**
 * CivicFix Local Services — Official Open Agentic Web Actions Module
 * Exposes website_get_services_and_estimate, website_configure_service_estimate,
 * and website_confirm_dispatch_request.
 */

import { App } from './script.js';

class SiteActions {
  static registerActions(actions) {
    actions.register(SiteActions.getServicesAndEstimateAction());
    actions.register(SiteActions.configureServiceEstimateAction());
    actions.register(SiteActions.confirmDispatchRequestAction());
  }

  static getServicesAndEstimateAction() {
    return {
      name: 'get_services_and_estimate',
      description:
        'Read all CivicFix local repair, cleaning, plumbing, electrical, and errand services, hourly rates, arrival windows, current estimate draft, state version, and scheduled work orders.',
      effect: 'read',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false
      },
      execute: () => App.page.getState()
    };
  }

  static configureServiceEstimateAction() {
    return {
      name: 'configure_service_estimate',
      description:
        'Prepare or update a live service estimate draft on the page (service type, estimated hours, arrival window, standard vs urgent_same_day, and issue notes). Reversible write; does not dispatch a technician yet.',
      effect: 'write',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['serviceId', 'estimatedHours'],
        properties: {
          serviceId: {
            type: 'string',
            enum: App.page.serviceIds(),
            description: 'Exact service id from website_get_services_and_estimate.'
          },
          estimatedHours: {
            type: 'integer',
            minimum: 1,
            maximum: 8,
            description: 'Estimated hours needed (must satisfy the service minHours, up to 8).'
          },
          preferredWindow: {
            type: 'string',
            maxLength: 80,
            description: 'One of the service arrival windows from website_get_services_and_estimate.'
          },
          urgency: {
            type: 'string',
            enum: ['standard', 'urgent_same_day'],
            description: 'Use "urgent_same_day" (+$35 surcharge) only if the visitor asks for urgent priority.'
          },
          issueNotes: {
            type: 'string',
            maxLength: 200,
            description: 'Short description of the repair, cleaning, or errand task.'
          }
        }
      },
      execute: (args) => App.page.configureServiceDraft(args)
    };
  }

  static confirmDispatchRequestAction() {
    return {
      name: 'confirm_dispatch_request',
      description:
        'Confirm and book the currently configured service estimate draft. Irreversible action: browser prompts the visitor to confirm before dispatching. Refuses stale expectedVersion.',
      effect: 'irreversible',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['customerName', 'serviceAddress', 'expectedVersion'],
        properties: {
          customerName: {
            type: 'string',
            minLength: 2,
            maxLength: 80,
            description: 'Visitor name for the work order.'
          },
          serviceAddress: {
            type: 'string',
            minLength: 5,
            maxLength: 160,
            description: 'Local street address where the technician or runner should arrive.'
          },
          contactPhone: {
            type: 'string',
            maxLength: 30,
            description: 'Optional callback number if provided by the visitor.'
          },
          expectedVersion: {
            type: 'integer',
            minimum: 1,
            description: 'Latest version from website_get_services_and_estimate or website_configure_service_estimate in this turn.'
          }
        }
      },
      execute: (args) => App.page.confirmDispatch(args)
    };
  }
}

export const registerActions = SiteActions.registerActions;