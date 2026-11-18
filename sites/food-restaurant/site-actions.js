/**
 * Hearth & Crumb Kitchen — Official Open Agentic Web Actions Module
 * Loaded via agent-manifest.json -> actions.module.
 * Exposes website_get_menu_and_cart, website_add_cart_item,
 * website_update_cart_item, and website_submit_order.
 */

import { App } from './script.js';

class SiteActions {
  static registerActions(actions) {
    actions.register(SiteActions.getMenuAndCartAction());
    actions.register(SiteActions.addCartItemAction());
    actions.register(SiteActions.updateCartItemAction());
    actions.register(SiteActions.submitOrderAction());
  }

  static getMenuAndCartAction() {
    return {
      name: 'get_menu_and_cart',
      description:
        'Read the full Hearth & Crumb menu (prices, prep times, dietary tags), restaurant info, live cart items, current cart version, totals, and latest order receipt on this page.',
      effect: 'read',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false
      },
      execute: () => App.page.getState()
    };
  }

  static addCartItemAction() {
    return {
      name: 'add_cart_item',
      description:
        'Add a quantity of one menu item to the visible cart on the page, keeping existing items. Reversible write; does not place an order. Returns updated cart state and new version.',
      effect: 'write',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'quantity'],
        properties: {
          id: {
            type: 'string',
            enum: App.page.catalogIds(),
            description: 'Exact menu item id from website_get_menu_and_cart.'
          },
          quantity: {
            type: 'integer',
            minimum: 1,
            maximum: 25,
            description: 'How many of this item to add (1–25).'
          },
          specialNote: {
            type: 'string',
            maxLength: 120,
            description: 'Optional kitchen preparation note (e.g. light cheese, extra crispy).'
          }
        }
      },
      execute: (args) => App.page.addItem(args.id, args.quantity, args.specialNote || '')
    };
  }

  static updateCartItemAction() {
    return {
      name: 'update_cart_item',
      description:
        'Set a cart item quantity (use 0 to remove the item) or switch fulfillment mode ("pickup" or "delivery"). Reversible write.',
      effect: 'write',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: {
            type: 'string',
            enum: App.page.catalogIds(),
            description: 'Menu item id currently in the cart.'
          },
          quantity: {
            type: 'integer',
            minimum: 0,
            maximum: 25,
            description: 'New quantity for the item (0 removes it from the cart).'
          },
          fulfillment: {
            type: 'string',
            enum: ['pickup', 'delivery'],
            description: 'Optional fulfillment method update ("pickup" or "delivery").'
          }
        }
      },
      execute: (args) => {
        let lastRes = { ok: true, state: App.page.getState() };
        if (args.fulfillment) {
          lastRes = App.page.setFulfillment(args.fulfillment);
          if (!lastRes.ok) return lastRes;
        }
        if (args.id !== undefined && args.quantity !== undefined) {
          lastRes = App.page.updateItemQuantity(args.id, args.quantity);
        }
        return lastRes;
      }
    };
  }

  static submitOrderAction() {
    return {
      name: 'submit_order',
      description:
        'Place the kitchen order for the current cart. Irreversible action: the browser asks the visitor to confirm before executing. Refuses stale expectedVersion.',
      effect: 'irreversible',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['customerName', 'fulfillment', 'expectedVersion'],
        properties: {
          customerName: {
            type: 'string',
            minLength: 2,
            maxLength: 80,
            description: 'Customer name provided by the visitor for the order.'
          },
          fulfillment: {
            type: 'string',
            enum: ['pickup', 'delivery'],
            description: 'Either "pickup" or "delivery".'
          },
          deliveryAddress: {
            type: 'string',
            maxLength: 160,
            description: 'Required local street address when fulfillment is "delivery".'
          },
          expectedVersion: {
            type: 'integer',
            minimum: 1,
            description: 'Latest cart version returned by website_get_menu_and_cart or cart update in this turn.'
          }
        }
      },
      execute: (args) => App.page.submitOrder(args)
    };
  }
}

export const registerActions = SiteActions.registerActions;