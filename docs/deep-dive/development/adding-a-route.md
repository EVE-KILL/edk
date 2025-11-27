# How to Add a New Route

Nitro uses a file-based routing system, which makes adding new routes straightforward.

## Creating a New Route

To create a new route, you create a new file in the `server/routes/` directory. The file's name and location in the directory determine the route's URL.

### Example: Creating a Simple "Hello World" Route

1.  **Create the file:**

    Create a new file at `server/routes/hello.get.ts`. The `.get` suffix indicates that this route will respond to HTTP GET requests.

2.  **Add the route handler:**

    Open the new file and add the following code:

    ```typescript
    export default defineEventHandler(() => {
      return {
        message: 'Hello, world!',
      };
    });
    ```

    This creates a simple event handler that returns a JSON object.

3.  **Access the route:**

    Start the development server (`bun dev`) and navigate to `http://localhost:3000/hello` in your browser or with a tool like `curl`. You should see the following JSON response:

    ```json
    {
      "message": "Hello, world!"
    }
    ```

## Route Parameters

To create a route with a dynamic parameter, you can use square brackets in the filename.

### Example: A Route with a Parameter

1.  **Create the file:**

    Create a file at `server/routes/users/[id].get.ts`.

2.  **Add the handler:**

    ```typescript
    export default defineEventHandler((event) => {
      const id = getRouterParam(event, 'id');
      return {
        userId: id,
      };
    });
    ```

    The `getRouterParam` helper is used to extract the `id` parameter from the URL.

3.  **Access the route:**

    Navigate to `http://localhost:3000/users/123`. The response will be:

    ```json
    {
      "userId": "123"
    }
    ```

## Handling Different HTTP Methods

You can handle different HTTP methods (POST, PUT, DELETE, etc.) by changing the suffix in the filename:

- `hello.get.ts` -> `GET /hello`
- `hello.post.ts` -> `POST /hello`
- `hello.put.ts` -> `PUT /hello`
- `hello.delete.ts` -> `DELETE /hello`

If you create a file without a method suffix (e.g., `hello.ts`), it will respond to all HTTP methods.
