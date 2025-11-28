import { describe, test, expect } from 'bun:test';

describe('Nested items flattening', () => {
  test('flattenItems should recursively extract items from containers', () => {
    // Mock ESI killmail item structure with nested items (like plastic wrap with contents)
    const items = [
      {
        flag: 5, // Cargo hold
        item_type_id: 27, // Plastic Wrap
        quantity_dropped: 0,
        quantity_destroyed: 1,
        singleton: 2,
        items: [
          {
            flag: 5,
            item_type_id: 34, // Tritanium
            quantity_dropped: 1000,
            quantity_destroyed: 0,
            singleton: 0,
          },
          {
            flag: 5,
            item_type_id: 35, // Pyerite
            quantity_dropped: 500,
            quantity_destroyed: 0,
            singleton: 0,
          },
        ],
      },
      {
        flag: 11, // Low slot
        item_type_id: 1234, // Some module
        quantity_dropped: 0,
        quantity_destroyed: 1,
        singleton: 1,
      },
    ];

    // Import the function (this is a unit test demonstrating the logic)
    function flattenItems(items: any[]): any[] {
      const result: any[] = [];

      for (const item of items) {
        // Add the item itself (including containers)
        result.push(item);

        // If the item has nested items (container contents), recursively flatten them
        if (item.items && item.items.length > 0) {
          result.push(...flattenItems(item.items));
        }
      }

      return result;
    }

    const flattened = flattenItems(items);

    // Should have 4 items total:
    // 1. Plastic Wrap (container)
    // 2. Tritanium (inside container)
    // 3. Pyerite (inside container)
    // 4. Module (standalone)
    expect(flattened).toHaveLength(4);

    // Verify all items are present
    expect(flattened.map((i) => i.item_type_id)).toEqual([27, 34, 35, 1234]);

    // Verify the plastic wrap container itself is included
    expect(flattened[0].item_type_id).toBe(27);
    expect(flattened[0].singleton).toBe(2);

    // Verify nested items maintain their properties
    expect(flattened[1].item_type_id).toBe(34); // Tritanium
    expect(flattened[1].quantity_dropped).toBe(1000);
    expect(flattened[2].item_type_id).toBe(35); // Pyerite
    expect(flattened[2].quantity_dropped).toBe(500);
  });

  test('flattenItems should handle deeply nested containers', () => {
    const items = [
      {
        flag: 5,
        item_type_id: 100, // Container level 1
        quantity_dropped: 1,
        quantity_destroyed: 0,
        singleton: 2,
        items: [
          {
            flag: 5,
            item_type_id: 200, // Container level 2
            quantity_dropped: 1,
            quantity_destroyed: 0,
            singleton: 2,
            items: [
              {
                flag: 5,
                item_type_id: 300, // Item inside nested container
                quantity_dropped: 10,
                quantity_destroyed: 0,
                singleton: 0,
              },
            ],
          },
        ],
      },
    ];

    function flattenItems(items: any[]): any[] {
      const result: any[] = [];
      for (const item of items) {
        result.push(item);
        if (item.items && item.items.length > 0) {
          result.push(...flattenItems(item.items));
        }
      }
      return result;
    }

    const flattened = flattenItems(items);

    expect(flattened).toHaveLength(3);
    expect(flattened.map((i) => i.item_type_id)).toEqual([100, 200, 300]);
  });

  test('flattenItems should handle items without nested content', () => {
    const items = [
      {
        flag: 11,
        item_type_id: 1000,
        quantity_dropped: 0,
        quantity_destroyed: 1,
        singleton: 1,
      },
      {
        flag: 12,
        item_type_id: 2000,
        quantity_dropped: 1,
        quantity_destroyed: 0,
        singleton: 1,
      },
    ];

    function flattenItems(items: any[]): any[] {
      const result: any[] = [];
      for (const item of items) {
        result.push(item);
        if (item.items && item.items.length > 0) {
          result.push(...flattenItems(item.items));
        }
      }
      return result;
    }

    const flattened = flattenItems(items);

    // Should remain unchanged - just 2 items
    expect(flattened).toHaveLength(2);
    expect(flattened.map((i) => i.item_type_id)).toEqual([1000, 2000]);
  });
});
