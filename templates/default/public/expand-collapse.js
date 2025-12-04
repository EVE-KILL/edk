/**
 * Expand/Collapse Component Library
 *
 * A reusable library for creating expandable/collapsible sections.
 *
 * Usage:
 * 1. Add data-expand-trigger attribute to the clickable element
 * 2. Add data-expand-content attribute to the content to show/hide
 * 3. Optionally add data-expand-group to group multiple triggers/content pairs
 * 4. Call ExpandCollapse.init() when DOM is ready
 *
 * Example HTML:
 * <div data-expand-group="mygroup">
 *   <button data-expand-trigger>Show More</button>
 *   <div data-expand-content style="display: none;">Hidden content</div>
 * </div>
 */

(function (window) {
  'use strict';

  const ExpandCollapse = {
    /**
     * Initialize all expand/collapse components on the page
     */
    init: function () {
      this.bindEvents();
    },

    /**
     * Bind click events to all triggers
     */
    bindEvents: function () {
      document.addEventListener('click', function (e) {
        const trigger = e.target.closest('[data-expand-trigger]');
        if (!trigger) return;

        e.preventDefault();
        e.stopPropagation();

        ExpandCollapse.toggle(trigger);
      });
    },

    /**
     * Toggle the visibility of content associated with a trigger
     * @param {HTMLElement} trigger - The trigger element
     */
    toggle: function (trigger) {
      const content = this.findContent(trigger);
      if (!content) {
        console.warn('ExpandCollapse: No content found for trigger', trigger);
        return;
      }

      const isVisible =
        content.style.display !== 'none' && content.style.display !== '';

      if (isVisible) {
        this.collapse(trigger, content);
      } else {
        this.expand(trigger, content);
      }
    },

    /**
     * Expand content and update trigger state
     * @param {HTMLElement} trigger - The trigger element
     * @param {HTMLElement} content - The content element
     */
    expand: function (trigger, content) {
      content.style.display = 'block';
      trigger.classList.add('expanded');
      trigger.setAttribute('aria-expanded', 'true');

      // Dispatch custom event
      const event = new CustomEvent('expandcollapse:expanded', {
        detail: { trigger, content },
      });
      trigger.dispatchEvent(event);
    },

    /**
     * Collapse content and update trigger state
     * @param {HTMLElement} trigger - The trigger element
     * @param {HTMLElement} content - The content element
     */
    collapse: function (trigger, content) {
      content.style.display = 'none';
      trigger.classList.remove('expanded');
      trigger.setAttribute('aria-expanded', 'false');

      // Dispatch custom event
      const event = new CustomEvent('expandcollapse:collapsed', {
        detail: { trigger, content },
      });
      trigger.dispatchEvent(event);
    },

    /**
     * Find the content element associated with a trigger
     * @param {HTMLElement} trigger - The trigger element
     * @returns {HTMLElement|null} The content element
     */
    findContent: function (trigger) {
      // First, try to find within the same group
      const group = trigger.closest('[data-expand-group]');
      if (group) {
        return group.querySelector('[data-expand-content]');
      }

      // Otherwise, look for the next sibling with data-expand-content
      let sibling = trigger.nextElementSibling;
      while (sibling) {
        if (sibling.hasAttribute('data-expand-content')) {
          return sibling;
        }
        sibling = sibling.nextElementSibling;
      }

      // Last resort: find by closest parent container
      const parent = trigger.parentElement;
      if (parent) {
        return parent.querySelector('[data-expand-content]');
      }

      return null;
    },

    /**
     * Programmatically expand a specific trigger
     * @param {string|HTMLElement} selector - CSS selector or HTMLElement
     */
    expandBySelector: function (selector) {
      const trigger =
        typeof selector === 'string'
          ? document.querySelector(selector)
          : selector;

      if (!trigger) return;

      const content = this.findContent(trigger);
      if (content) {
        this.expand(trigger, content);
      }
    },

    /**
     * Programmatically collapse a specific trigger
     * @param {string|HTMLElement} selector - CSS selector or HTMLElement
     */
    collapseBySelector: function (selector) {
      const trigger =
        typeof selector === 'string'
          ? document.querySelector(selector)
          : selector;

      if (!trigger) return;

      const content = this.findContent(trigger);
      if (content) {
        this.collapse(trigger, content);
      }
    },

    /**
     * Expand all triggers on the page or within a container
     * @param {string|HTMLElement} container - Optional container selector or element
     */
    expandAll: function (container) {
      const root = container
        ? typeof container === 'string'
          ? document.querySelector(container)
          : container
        : document;

      const triggers = root.querySelectorAll('[data-expand-trigger]');
      triggers.forEach((trigger) => {
        const content = this.findContent(trigger);
        if (content) {
          this.expand(trigger, content);
        }
      });
    },

    /**
     * Collapse all triggers on the page or within a container
     * @param {string|HTMLElement} container - Optional container selector or element
     */
    collapseAll: function (container) {
      const root = container
        ? typeof container === 'string'
          ? document.querySelector(container)
          : container
        : document;

      const triggers = root.querySelectorAll('[data-expand-trigger]');
      triggers.forEach((trigger) => {
        const content = this.findContent(trigger);
        if (content) {
          this.collapse(trigger, content);
        }
      });
    },
  };

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      ExpandCollapse.init();
    });
  } else {
    ExpandCollapse.init();
  }

  // Expose to global scope
  window.ExpandCollapse = ExpandCollapse;
})(window);
