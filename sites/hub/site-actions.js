/**
 * Neighborhood Hub — Official Open Agentic Web Actions Module
 * Exposes website_get_hub_directory_and_plan, website_add_plan_handoff,
 * and website_remove_plan_item.
 */

import { App } from './script.js';

class SiteActions {
  static registerActions(actions) {
    actions.register(SiteActions.getDirectoryAndPlanAction());
    actions.register(SiteActions.addPlanHandoffAction());
    actions.register(SiteActions.removePlanItemAction());
  }

  static getDirectoryAndPlanAction() {
    return {
      name: 'get_hub_directory_and_plan',
      description:
        'Read the live Oakwood Neighborhood Business Directory (online statuses, categories, site URLs, capabilities), shared resident preferences, and saved items on the resident’s Neighborhood Action Plan.',
      effect: 'read',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false
      },
      execute: () => App.page.getPublicStateForAgent()
    };
  }

  static addPlanHandoffAction() {
    return {
      name: 'add_plan_handoff',
      description:
        'Pin a structured neighborhood task card with a 1-click handoff link onto the resident’s Action Plan on this page so they can jump straight to the partner site with a prefilled prompt.',
      effect: 'write',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['businessTitle', 'category', 'targetSiteUrl', 'summary'],
        properties: {
          businessTitle: {
            type: 'string',
            minLength: 2,
            maxLength: 80,
            description: 'Partner business name from website_get_hub_directory_and_plan.'
          },
          category: {
            type: 'string',
            enum: ['food', 'services', 'appointments'],
            description: 'Business category.'
          },
          targetSiteUrl: {
            type: 'string',
            enum: ['https://hearth-crumb-food.vercel.app', 'https://civicfix-services.vercel.app', 'https://oakwood-booking.vercel.app'],
            description: 'Exact partner siteUrl from website_get_hub_directory_and_plan.'
          },
          summary: {
            type: 'string',
            minLength: 5,
            maxLength: 260,
            description: 'Concise summary of the option, price/time facts returned by the partner, and next step.'
          },
          suggestedPrompt: {
            type: 'string',
            maxLength: 220,
            description: 'Optional plain-language request to prefill on the partner website when the visitor clicks Continue.'
          }
        }
      },
      execute: (args) => App.page.addPlanHandoff(args)
    };
  }

  static removePlanItemAction() {
    return {
      name: 'remove_plan_item',
      description: 'Remove an item from the resident’s Neighborhood Action Plan by id.',
      effect: 'write',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            minLength: 3,
            maxLength: 60,
            description: 'Exact plan item id from website_get_hub_directory_and_plan.'
          }
        }
      },
      execute: (args) => App.page.removePlanItem(args.id)
    };
  }
}

export const registerActions = SiteActions.registerActions;